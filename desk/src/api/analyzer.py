# -*- coding: utf-8 -*-
"""
Analyzer API - AI 분석 뷰용 API 라우트
"""
import os
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, render_template

from src.core_logic import get_article_id
from src.core.article_manager import ArticleManager
from src.core.article_state import ArticleState
from src.mll_client import MLLClient
from src.core.score_engine import calculate_zes_v1 # Import score logic

analyzer_bp = Blueprint('analyzer', __name__)
manager = ArticleManager()


# =============================================================================
# Views
# =============================================================================

@analyzer_bp.route('/analyzer')
def analyzer_view():
    """AI 분석 뷰 (메인 화면)"""
    return render_template('analyzer.html')


# =============================================================================
# API Endpoints
# =============================================================================

@analyzer_bp.route('/api/analyzer/list', methods=['GET'])
def list_articles():
    """
    기사 목록 조회
    
    Query params:
        state: 상태 필터 (collected, analyzed, rejected)
        limit: 최대 개수 (기본 100)
    """
    state_filter = request.args.get('state')
    limit = int(request.args.get('limit', 100))
    include_text = request.args.get('include_text', 'false').lower() == 'true'
    
    try:
        if state_filter:
            state = ArticleState(state_filter)
            articles = manager.find_by_state(state, limit)
        else:
            # 기본: COLLECTED + ANALYZED 모두 조회
            collected = manager.find_by_state(ArticleState.COLLECTED, limit)
            analyzed = manager.find_by_state(ArticleState.ANALYZED, limit)
            articles = collected + analyzed
        
        # 응답 형식 변환
        result = []
        for article in articles:
            result.append(_format_article_for_list(article, include_text=include_text))
        
        return jsonify({
            'success': True,
            'articles': result,
            'count': len(result)
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@analyzer_bp.route('/api/analyzer/save_results', methods=['POST'])
def save_analysis_results():
    """
    Inspector V2: Save batch analysis results
    Body: { "results": [ { "Article_ID": "...", "Title_KO": "...", ... }, ... ] }
    """
    data = request.get_json()
    
    # Handle { "results": [...] } wrapper from Inspector V2
    if isinstance(data, dict) and 'results' in data:
        results = data['results']
    elif isinstance(data, list):
        results = data
    else:
        results = [data]
        
    print(f"📥 [Analyzer] Received save request: {len(results)} items")
    
    saved_count = 0
    errors = []
    
    print(f"💾 [Analyzer] Saving {len(results)} analysis results...")
    
    for item in results:
        # Flexible ID Lookup
        article_id = (
            item.get('Article_ID') or
            item.get('article_id') or
            item.get('id') or
            item.get('ArticleID') or
            item.get('Article ID')
        )
        print(f"🔹 [Analyzer] Processing Article ID: {article_id}")
        
        if not article_id:
            errors.append("Skipped item: Missing Article_ID field")
            continue
            
        try:
            # 1. Parse Nested Structure (V1 / Inspector Style)
            meta = item.get('Meta', {})
            is_analysis = item.get('IS_Analysis', {})
            calculations = is_analysis.get('Calculations', {})
            iw_data = calculations.get('IW_Analysis', {})
            ie_data = calculations.get('IE_Analysis', {})
            
            # 2. Extract Fields (Priority: Nested > Flat)
            title = meta.get('Headline') or item.get('Title_KO') or item.get('title_ko') or item.get('Title') or ''
            summary = meta.get('Summary') or item.get('summary') or item.get('Description') or ''
            tags = meta.get('Tags') or item.get('tags') or []
            
            # 3. Calculate Scores
            # Impact Score (IW + IE, typically max 10)
            iw_score = float(iw_data.get('IW_Score') or 0)
            ie_score = float(ie_data.get('IE_Score') or 0)
            # If flat scores exist, use them fallback
            if iw_score == 0 and ie_score == 0:
                impact_score = float(item.get('Impact_Score') or item.get('impact_score') or 0)
            else:
                impact_score = iw_score + ie_score

            # Zero Echo Score (Calculated from ZES_Raw_Metrics)
            zes_raw_metrics = item.get('ZES_Raw_Metrics')
            if zes_raw_metrics:
                zero_echo_score, zes_breakdown = calculate_zes_v1(zes_raw_metrics)
                evidence = {
                    'breakdown': zes_breakdown,
                    'raw_metrics': zes_raw_metrics
                }
            else:
                # Fallback to direct value or default
                zero_echo_score = float(item.get('Zero_Echo_Score') or item.get('zero_echo_score') or 0)
                evidence = {}

            analysis_data = {
                'title_ko': title,
                'summary': summary,
                'tags': tags,
                'impact_score': impact_score,
                'zero_echo_score': zero_echo_score,
                'evidence': evidence, # Save breakdown for UI
                'mll_raw': item
            }
            
            # Use Manager to update (Handles File + DB + State)
            if manager.update_analysis(article_id, analysis_data):
                saved_count += 1
            else:
                errors.append(f"Failed to update {article_id}")
                
        except Exception as e:
            print(f"❌ [Analyzer] Error saving {article_id}: {e}")
            errors.append(f"{article_id}: {str(e)}") # Corrected this line
            
    print(f"📊 [Analyzer] Save complete. Success: {saved_count}, Errors: {len(errors)}")
    if errors:
        print(f"❌ [Analyzer] Errors: {errors}")

    return jsonify({
        'success': True,
        'processed': len(results),
        'saved': saved_count,
        'errors': errors
    })


@analyzer_bp.route('/api/analyzer/reject', methods=['POST'])
def reject_articles():
    """
    기사 폐기 (Noise)
    
    Body:
        article_ids: 폐기할 기사 ID 목록
        reason: 폐기 사유 (선택)
    """
    data = request.get_json()
    article_ids = data.get('article_ids', [])
    reason = data.get('reason', 'noise')
    
    if not article_ids:
        return jsonify({
            'success': False,
            'error': 'article_ids required'
        }), 400
    
    results = []
    for article_id in article_ids:
        success = manager.reject(article_id, reason)
        results.append({
            'article_id': article_id,
            'success': success
        })
    
    return jsonify({
        'success': True,
        'results': results
    })


@analyzer_bp.route('/api/analyzer/restore', methods=['POST'])
def restore_articles():
    """
    폐기된 기사 복구 (재분석 대기 상태로)
    
    Body:
        article_ids: 복구할 기사 ID 목록
    """
    data = request.get_json()
    article_ids = data.get('article_ids', [])
    
    if not article_ids:
        return jsonify({
            'success': False,
            'error': 'article_ids required'
        }), 400
    
    results = []
    for article_id in article_ids:
        # REJECTED → ANALYZING 전이
        success = manager.update_state(
            article_id, 
            ArticleState.ANALYZING,
            by='analyzer'
        )
        results.append({
            'article_id': article_id,
            'success': success
        })
    
    return jsonify({
        'success': True,
        'results': results
    })


@analyzer_bp.route('/api/analyzer/detail/<article_id>', methods=['GET'])
def get_article_detail(article_id: str):
    """기사 상세 조회"""
    article = manager.get(article_id)
    
    if not article:
        return jsonify({
            'success': False,
            'error': 'Article not found'
        }), 404
    
    return jsonify({
        'success': True,
        'article': article
    })


# =============================================================================
# Helper Functions
# =============================================================================

def _format_article_for_list(article: dict, include_text: bool = False) -> dict:
    """기사 데이터를 목록 표시용으로 변환 (SchemaAdapter 사용)"""
    from src.core.schema_adapter import SchemaAdapter
    adapter = SchemaAdapter(article, auto_upgrade=True)
    
    data = {
        'article_id': adapter.article_id,
        'id': adapter.article_id,  # alias for convenience
        'state': adapter.state,
        'title': adapter.title,
        'source_id': adapter.source_id,
        'url': adapter.url,
        'crawled_at': adapter.crawled_at,
        'impact_score': adapter.impact_score,
        'zero_echo_score': adapter.zero_echo_score,
        'tags': adapter.tags
    }
    
    if include_text:
        data['_original'] = article.get('_original', {})
        
    return data

