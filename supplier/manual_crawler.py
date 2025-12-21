# -*- coding: utf-8 -*-
"""
ZND Manual Crawler - Flask Application Entry Point
모든 API 라우트는 src/routes/ 모듈에서 Blueprint로 분리됨
"""
import os
from flask import Flask

app = Flask(__name__)

# [Debugging] Force disable caching to ensure frontend updates
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response


# ============================================================================
# Blueprint 등록
# ============================================================================

from src.routes.automation import automation_bp
from src.routes.desk import desk_bp
from src.routes.publications import publications_bp
from src.routes.batch import batch_bp
from src.routes.crawler import crawler_bp
from src.routes.cleanup import cleanup_bp

app.register_blueprint(automation_bp)
app.register_blueprint(desk_bp)
app.register_blueprint(publications_bp)
app.register_blueprint(batch_bp)
app.register_blueprint(crawler_bp)
app.register_blueprint(cleanup_bp)


# ============================================================================
# 추가 유틸리티 라우트 (점수 검증, 품질 체크 - 작은 기능)
# ============================================================================

import json
import aiohttp
import asyncio
from flask import request, jsonify
from src.core_logic import normalize_field_names as _core_normalize_field_names


def normalize_field_names(data):
    return _core_normalize_field_names(data)


@app.route('/api/verify_score', methods=['POST'])
def verify_score():
    """점수 검증 API"""
    from src.score_engine import process_raw_analysis
    
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


@app.route('/api/inject_correction', methods=['POST'])
def inject_correction():
    """수동 교정값 주입"""
    from src.core_logic import load_from_cache, save_to_cache
    
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


@app.route('/api/mark_worthless', methods=['POST'])
def mark_worthless():
    """무가치 기사 표시"""
    from src.db_client import DBClient
    
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL required'}), 400
    
    db = DBClient()
    db.save_history(url, 'WORTHLESS', reason='manual_mark')
    return jsonify({'status': 'success'})


@app.route('/api/reload_history', methods=['POST'])
def reload_history():
    """히스토리 캐시 리로드"""
    from src.db_client import DBClient
    db = DBClient()
    db.reload_history()
    return jsonify({'status': 'success', 'message': 'History reloaded'})


@app.route('/api/check_quality', methods=['POST'])
def check_quality():
    """URL 품질 체크"""
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify([])
        
    async def check_urls(url_list):
        results = []
        async with aiohttp.ClientSession() as session:
            for url in url_list:
                try:
                    async with session.get(url, timeout=5, ssl=False) as response:
                        if response.status != 200:
                            results.append({'url': url, 'status': 'invalid'})
                            continue
                        
                        content = await response.content.read(10240)
                        text = content.decode('utf-8', errors='ignore')
                        
                        if len(text) < 500:
                            results.append({'url': url, 'status': 'invalid'})
                        else:
                            results.append({'url': url, 'status': 'valid'})
                except Exception:
                    results.append({'url': url, 'status': 'invalid'})
        return results

    try:
        results = asyncio.run(check_urls(urls))
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/find_duplicate_data')
def find_duplicate_data():
    """중복 데이터 파일 찾기"""
    from src.core_logic import normalize_url_for_dedupe
    
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
    
    try:
        url_to_files = {}
        
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                date_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json') or filename in ['daily_summary.json', 'index.json']:
                        continue
                    
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            url = data.get('url', '')
                            if url:
                                norm_url = normalize_url_for_dedupe(url)
                                if norm_url not in url_to_files:
                                    url_to_files[norm_url] = []
                                url_to_files[norm_url].append({
                                    'filename': filename,
                                    'date': date_folder,
                                    'path': filepath,
                                    'crawled_at': data.get('crawled_at', ''),
                                    'article_id': data.get('article_id', ''),
                                    'original_url': url
                                })
                    except:
                        pass
        
        duplicates = {k: v for k, v in url_to_files.items() if len(v) > 1}
        
        for _, files in duplicates.items():
            files.sort(key=lambda x: x.get('crawled_at', ''), reverse=True)
        
        return jsonify({
            'duplicates': duplicates,
            'total_duplicate_urls': len(duplicates),
            'total_duplicate_files': sum(len(f) - 1 for f in duplicates.values())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/refresh_article', methods=['POST'])
def refresh_article():
    """기사 새로고침 - 캐시 및 히스토리 리셋"""
    from src.core_logic import load_from_cache, save_to_cache
    from src.db_client import DBClient
    
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL required'}), 400
    
    try:
        db = DBClient()
        db.remove_from_history(url)
        
        cached = load_from_cache(url)
        if cached:
            # Clear analysis-related fields
            for field in ['mll_status', 'raw_analysis', 'zero_echo_score', 'impact_score', 
                         'staged', 'staged_at', 'published', 'published_at', 'rejected']:
                cached.pop(field, None)
            save_to_cache(url, cached)
        
        return jsonify({'status': 'success', 'message': 'Article refreshed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == '__main__':
    # Port 5500 as requested
    app.run(debug=True, port=5500)
