from flask import Blueprint, request, jsonify
import asyncio
from src.core_logic import (
    normalize_field_names, 
    check_url_quality, 
    find_duplicate_files,
    reset_article_cache,
    load_from_cache,
    save_to_cache
)
from src.score_engine import process_raw_analysis
from src.db_client import DBClient

utility_bp = Blueprint('utility', __name__)

@utility_bp.route('/api/verify_score', methods=['POST'])
def verify_score():
    """점수 검증 API"""
    data = normalize_field_names(request.json)
    
    # Use score_engine as source of truth
    result = process_raw_analysis(data)
    
    if not result:
        return jsonify({
            'zs_final': 5.0,
            'zs_raw': 5.0,
            'impact_score': 0.0,
            'breakdown': {'schema': 'Unknown', 'error': 'No valid data'}
        })
    
    schema = result.get('schema_version', 'Unknown')
    
    if schema == 'V1.0':
        impact_evidence = result.get('impact_evidence', {})
        evidence = result.get('evidence', {})
        breakdown = {
            'schema': 'V1.0',
            'is_components': impact_evidence.get('calculations', {}),
            'zes_metrics': evidence.get('breakdown', {}),
            'zs_clamped': result.get('zero_echo_score', 5.0),
            'impact_calc': result.get('impact_score', 0.0)
        }
    elif schema == 'V0.9':
        impact_evidence = result.get('impact_evidence', {})
        evidence = result.get('evidence', {})
        breakdown = {
            'schema': 'V0.9',
            'is_components': impact_evidence.get('scores', {}),
            'zes_vector': {
                'base': 5.0,
                'positive': evidence.get('score_vector', {}).get('Positive_Scores', []),
                'negative': evidence.get('score_vector', {}).get('Negative_Scores', [])
            },
            'zs_clamped': result.get('zero_echo_score', 5.0),
            'impact_calc': result.get('impact_score', 0.0)
        }
    else:
        evidence = result.get('evidence', {})
        breakdown = {
            'schema': 'Legacy',
            'base': 5.0,
            'credits': evidence.get('credits', []),
            'penalties': evidence.get('penalties', []),
            'modifiers': evidence.get('modifiers', []),
            'zs_clamped': result.get('zero_echo_score', 5.0),
            'impact_calc': result.get('impact_score', 0.0)
        }
    
    return jsonify({
        'zs_final': result.get('zero_echo_score', 5.0),
        'zs_raw': result.get('zero_echo_score', 5.0),
        'impact_score': result.get('impact_score', 0.0),
        'breakdown': breakdown
    })


@utility_bp.route('/api/inject_correction', methods=['POST'])
def inject_correction():
    """수동 교정값 주입"""
    data = request.json
    url = data.get('url')
    corrections = data.get('corrections', {})
    
    if not url:
        return jsonify({'error': 'URL required'}), 400
    
    try:
        cached = load_from_cache(url) or {}
        cached.update(corrections)
        save_to_cache(url, cached)
        return jsonify({'status': 'success', 'message': 'Correction applied'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@utility_bp.route('/api/mark_worthless', methods=['POST'])
def mark_worthless():
    """무가치 기사 표시"""
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL required'}), 400
    
    try:
        db = DBClient()
        db.save_history(url, 'WORTHLESS', reason='manual_mark')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@utility_bp.route('/api/reload_history', methods=['POST'])
def reload_history():
    """히스토리 캐시 리로드"""
    try:
        db = DBClient()
        db.reload_history()
        return jsonify({'status': 'success', 'message': 'History reloaded'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@utility_bp.route('/api/check_quality', methods=['POST'])
def check_quality():
    """URL 품질 체크"""
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify([])

    try:
        # Run async function in sync context
        results = asyncio.run(check_url_quality(urls))
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@utility_bp.route('/api/find_duplicate_data')
def find_duplicate_data():
    """중복 데이터 파일 찾기"""
    try:
        result = find_duplicate_files()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@utility_bp.route('/api/refresh_article', methods=['POST'])
def refresh_article():
    """기사 새로고침 - 캐시 및 히스토리 리셋"""
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL required'}), 400
    
    try:
        # 1. DB History Removal
        db = DBClient()
        db.remove_from_history(url)
        
        # 2. Cache Reset
        reset_article_cache(url)
        
        return jsonify({'status': 'success', 'message': 'Article refreshed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
