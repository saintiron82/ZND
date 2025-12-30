# -*- coding: utf-8 -*-
"""
Collector API - 수집 관련 API
"""
import os
import sys
import json
import threading
import queue
from datetime import datetime
from flask import Blueprint, jsonify, Response, stream_with_context

collector_bp = Blueprint('collector', __name__)


def _setup_paths():
    """크롤러 모듈 경로 설정 - 새 desk 폴더 기반"""
    # 현재 파일: desk/src/api/collector.py
    # desk 폴더: 3단계 위
    desk_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    project_root = os.path.dirname(desk_dir)
    crawler_path = os.path.join(project_root, 'crawler')
    src_path = os.path.join(desk_dir, 'src')  # src 폴더도 추가
    
    # 경로 추가 (desk 먼저, 그 다음 src, 그 다음 crawler)
    paths_to_add = [desk_dir, src_path, crawler_path]
    for path in paths_to_add:
        if path not in sys.path and os.path.exists(path):
            sys.path.insert(0, path)
            print(f"🔧 [Collector] Added to sys.path: {path}")
    
    return desk_dir, crawler_path


@collector_bp.route('/api/collector/run', methods=['POST'])
def run_collector():
    """
    즉시 수집 실행 (Streaming Response)
    """
    print("🚀 [Collector] API called - starting async collection...")
    
    q = queue.Queue()
    
    def progress_callback(data):
        """Worker 스레드에서 호출하여 메인 스레드로 데이터 전달"""
        q.put(data)
        
    def worker():
        try:
            desk_dir, crawler_path = _setup_paths()
            
            # .env 로드
            env_file = os.path.join(desk_dir, '.env')
            if os.path.exists(env_file):
                from dotenv import load_dotenv
                load_dotenv(env_file)
            
            # Initial Status
            progress_callback({'status': 'collecting', 'message': '🔍 링크 수집 시작...'})
            
            from core.extractor import run_full_pipeline
            
            # Run Pipeline with Callback
            result = run_full_pipeline(schedule_name="즉시 수집", progress_callback=progress_callback)
            
            # Registry Refresh
            try:
                from src.core.article_registry import get_registry
                registry = get_registry()
                registry.refresh()
            except Exception as e:
                print(f"⚠️ [Collector] Registry refresh failed: {e}")
            
            # Final Result
            collected = result.get('collected', 0)
            extracted = result.get('extracted', 0)
            
            progress_callback({
                'status': 'completed',
                'collected': collected,
                'extracted': extracted,
                'message': f'완료: 수집 {collected}, 추출 {extracted}'
            })
            
        except ImportError as e:
            q.put({'status': 'error', 'error': f'Import Failed: {e}'})
        except Exception as e:
            q.put({'status': 'error', 'error': str(e)})
            import traceback
            traceback.print_exc()
        finally:
            q.put(None) # Sentinel to stop generator

    # Start Worker Thread
    thread = threading.Thread(target=worker)
    thread.start()
    
    def generate():
        """Queue에서 데이터를 꺼내 클라이언트로 스트리밍"""
        while True:
            item = q.get()
            if item is None:
                break
            yield json.dumps(item) + '\n'
            
    return Response(stream_with_context(generate()), mimetype='application/json')


@collector_bp.route('/api/collector/status', methods=['GET'])
def get_status():
    """수집 상태 조회"""
    return jsonify({
        'success': True,
        'status': 'idle',
        'message': 'No collection running'
    })
