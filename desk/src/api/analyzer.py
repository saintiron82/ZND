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
        since: ISO 형식 시작 시간 (원본 발간시간 기준 필터)
    """
    state_filter = request.args.get('state')
    limit = int(request.args.get('limit', 100))
    include_text = request.args.get('include_text', 'false').lower() == 'true'
    since_str = request.args.get('since')
    
    # Parse time filter
    since_time = None
    if since_str:
        try:
            since_time = datetime.fromisoformat(since_str.replace('Z', '+00:00'))
        except ValueError:
            pass
    
    try:
        if state_filter:
            state = ArticleState(state_filter)
            articles = manager.find_by_state(state, limit * 2)  # 필터링 전 여유있게 조회
        else:
            # 기본: COLLECTED + ANALYZED 모두 조회
            collected = manager.find_by_state(ArticleState.COLLECTED, limit)
            analyzed = manager.find_by_state(ArticleState.ANALYZED, limit)
            articles = collected + analyzed
        
        # Apply time filter if provided
        if since_time:
            filtered = []
            for a in articles:
                original = a.get('_original', {})
                pub_at = original.get('published_at') or original.get('crawled_at')
                if pub_at:
                    try:
                        if isinstance(pub_at, str):
                            article_time = datetime.fromisoformat(pub_at.replace('Z', '+00:00'))
                        else:
                            article_time = pub_at  # Already datetime
                        if article_time >= since_time:
                            filtered.append(a)
                    except:
                        filtered.append(a)  # 파싱 실패 시 포함
                else:
                    filtered.append(a)  # 시간 정보 없으면 포함
            articles = filtered[:limit]
        else:
            articles = articles[:limit]
        
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
        # [FIX] Validate item type (skip " " or strings from LLM)
        if not isinstance(item, dict):
            # errors.append(f"Skipped invalid item type: {type(item)}")
            continue

        try:
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

            # 1. Use ScoreEngine for unified parsing (handles V1.0/Legacy/Fallbacks)
            from src.core.score_engine import process_raw_analysis
            processed = process_raw_analysis(item)
            
            print(f"   📊 [Analyzer] Processed result for {article_id}:")
            print(f"      - title_ko: {processed.get('title_ko', 'N/A')[:30] if processed.get('title_ko') else 'N/A'}...")
            print(f"      - impact_score: {processed.get('impact_score', 'N/A')}")
            print(f"      - zero_echo_score: {processed.get('zero_echo_score', 'N/A')}")
            
            # 2. Extract Fields from processed result
            title = processed.get('title_ko', '')
            summary = processed.get('summary', '')
            tags = processed.get('tags', [])
            category = processed.get('category', '')
            
            impact_score = processed.get('impact_score', 0.0)
            zero_echo_score = processed.get('zero_echo_score', 0.0) # Note: 0 is better if trusted? No, usually 5 is default. Engine handles it.
            
            evidence = processed.get('evidence', {})
            impact_evidence = processed.get('impact_evidence', {})

            analysis_data = {
                'title_ko': title,
                'summary': summary,
                'tags': tags,
                'impact_score': impact_score,
                'zero_echo_score': zero_echo_score,
                'evidence': evidence, # ZES Breakdown
                'impact_evidence': impact_evidence, # IS Breakdown
                'mll_raw': item # Preserve original raw data
            }
            
            if category:
                analysis_data['category'] = category
            
            print(f"   💾 [Analyzer] Calling update_analysis for {article_id}...")
            
            # Use Manager to update (Handles File + DB + State)
            if manager.update_analysis(article_id, analysis_data):
                saved_count += 1
                print(f"   ✅ [Analyzer] Successfully saved {article_id}")
            else:
                errors.append(f"Failed to update {article_id}")
                print(f"   ❌ [Analyzer] Failed to update {article_id}")
                
        except Exception as e:
            # article_id might be undefined if error occurs before assignment, but here logic ensures it's safeish
            # or we initialize it. Safe to use 'item' for identifier if needed.
            # actually article_id is defined inside try, if it fails before, we catch it.
            # but for logging, we need to be careful if article_id is not yet bound.
            aid = locals().get('article_id', 'unknown')
            print(f"❌ [Analyzer] Error saving {aid}: {e}")
            import traceback
            traceback.print_exc()
            errors.append(f"{aid}: {str(e)}")
            
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

