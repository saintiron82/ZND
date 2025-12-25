# -*- coding: utf-8 -*-
"""
Batch Processing API - 하이브리드 배치 처리, 배치 관리
"""
import os
import json
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify

# 공통 인증 모듈
from src.routes.auth import requires_auth

from src.core_logic import (
    load_from_cache as _core_load_from_cache,
    save_to_cache as _core_save_to_cache,
    normalize_field_names as _core_normalize_field_names,
    get_data_filename
)
from src.batch_logic import create_batch, get_batches, publish_batch, discard_batch

batch_bp = Blueprint('batch', __name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')
BATCH_DIR = os.path.join(CACHE_DIR, 'batches')


def _find_cache_by_article_id(article_id):
    """cache 폴더에서 article_id로 캐시 검색 (최근 7일)"""
    for i in range(8):
        date_str = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        date_dir = os.path.join(CACHE_DIR, date_str)
        
        if not os.path.exists(date_dir):
            continue
            
        for filename in os.listdir(date_dir):
            if not filename.endswith('.json'):
                continue
                
            filepath = os.path.join(date_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                if str(data.get('article_id')) == str(article_id):
                    return data
            except:
                continue
    return None


@batch_bp.route('/api/batch/list_ready')
@requires_auth
def list_ready_batches():
    """배치 파일 목록 조회"""
    try:
        if not os.path.exists(BATCH_DIR):
            return jsonify({'batches': []})
            
        batches = []
        for filename in os.listdir(BATCH_DIR):
            if not filename.endswith('.json'):
                continue
                
            filepath = os.path.join(BATCH_DIR, filename)
            try:
                stat = os.stat(filepath)
                parts = filename.replace('.json', '').split('_')
                date_str = parts[0] if len(parts) > 0 else 'Unknown'
                target_id = parts[1] if len(parts) > 1 else 'Unknown'
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    data_meta = json.load(f)
                    count = data_meta.get('count', 0)
                
                batches.append({
                    'filename': filename,
                    'date': date_str,
                    'target_id': target_id,
                    'count': count,
                    'size': stat.st_size,
                    'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
            except:
                pass
                
        batches.sort(key=lambda x: x['filename'], reverse=True)
        return jsonify({'batches': batches})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_bp.route('/api/batch/get_content')
@requires_auth
def get_batch_content():
    """배치 파일 내용 조회"""
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
        
    filepath = os.path.join(BATCH_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_bp.route('/api/batch/inject', methods=['POST'])
@requires_auth
def inject_batch_results():
    """외부 분석 결과 주입"""
    try:
        from src.score_engine import process_raw_analysis
        
        results = request.json
        
        if not isinstance(results, list):
            return jsonify({'error': 'Input must be a JSON list'}), 400
            
        processed_count = 0
        accepted_count = 0
        errors = []
        
        for item in results:
            try:
                article_id = item.get('article_id') or item.get('Article_ID')
                
                if not article_id:
                    errors.append(f"Missing article_id")
                    continue
                    
                url = item.get('url')
                
                cached_data = None
                if url:
                    cached_data = _core_load_from_cache(url)
                
                if not cached_data:
                    found = _find_cache_by_article_id(article_id)
                    if found:
                        cached_data = found
                        if not url: url = cached_data.get('url')
                
                if not cached_data:
                    errors.append(f"Cache not found for {article_id}")
                    continue
                
                # 점수 계산
                engine_result = process_raw_analysis(item)
                
                if engine_result:
                    if 'title_ko' in engine_result: cached_data['title_ko'] = engine_result['title_ko']
                    if 'summary' in engine_result: cached_data['summary'] = engine_result['summary']
                    
                    cached_data['zero_echo_score'] = engine_result.get('zero_echo_score', 0.0)
                    cached_data['impact_score'] = engine_result.get('impact_score', 0.0)
                    
                    if 'evidence' in engine_result: cached_data['evidence'] = engine_result['evidence']
                    if 'impact_evidence' in engine_result: cached_data['impact_evidence'] = engine_result['impact_evidence']
                    cached_data['raw_analysis'] = item
                    
                else:
                    errors.append(f"ScoreEngine failed: {article_id}")
                    continue
                    
                cached_data = _core_normalize_field_names(cached_data)
                
                # Staging에 저장
                date_folder = datetime.now().strftime('%Y-%m-%d')
                staging_dir = os.path.join(CACHE_DIR, date_folder)
                os.makedirs(staging_dir, exist_ok=True)
                
                filename = get_data_filename(cached_data.get('source_id', 'batch'), cached_data['url'])
                filepath = os.path.join(staging_dir, filename)
                
                cached_data['mll_status'] = 'analyzed'
                cached_data['analyzed_at'] = datetime.now(timezone.utc).isoformat()
                cached_data['staged'] = True
                cached_data['staged_at'] = datetime.now(timezone.utc).isoformat()
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(cached_data, f, ensure_ascii=False, indent=2)
                
                _core_save_to_cache(cached_data['url'], cached_data)
                
                processed_count += 1
                accepted_count += 1
                
            except Exception as inner_e:
                errors.append(f"Error: {inner_e}")
        
        return jsonify({
            'status': 'success',
            'processed': processed_count,
            'accepted': accepted_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_bp.route('/api/batch/create', methods=['POST'])
@requires_auth
def api_create_batch():
    """새 배치 생성"""
    try:
        batch_id, message = create_batch()
        if not batch_id:
            return jsonify({'error': message}), 400
        return jsonify({'status': 'success', 'batch_id': batch_id, 'message': message})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_bp.route('/api/batch/list', methods=['GET'])
@requires_auth
def api_list_batches():
    """배치 목록 조회"""
    try:
        batches = get_batches()
        return jsonify({'batches': batches, 'count': len(batches)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_bp.route('/api/batch/publish', methods=['POST'])
@requires_auth
def api_publish_batch():
    """배치 발행"""
    data = request.json
    batch_id = data.get('batch_id')
    if not batch_id:
        return jsonify({'error': 'batch_id is required'}), 400
        
    try:
        success, message = publish_batch(batch_id)
        if success:
            return jsonify({'status': 'success', 'message': message})
        else:
            return jsonify({'error': message}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_bp.route('/api/batch/discard', methods=['POST'])
@requires_auth
def api_discard_batch():
    """배치 폐기"""
    data = request.json
    batch_id = data.get('batch_id')
    if not batch_id:
        return jsonify({'error': 'batch_id is required'}), 400
        
    try:
        success, message = discard_batch(batch_id)
        if success:
            return jsonify({'status': 'success', 'message': message})
        else:
            return jsonify({'error': message}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
