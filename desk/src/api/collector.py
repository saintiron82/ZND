# -*- coding: utf-8 -*-
"""
Collector API - 수집 관련 API
"""
import os
import sys
from flask import Blueprint, jsonify

collector_bp = Blueprint('collector', __name__)


def _setup_paths():
    """크롤러 모듈 경로 설정 - 새 desk 폴더 기반"""
    # 현재 파일: desk/src/api/collector.py
    # desk 폴더: 3단계 위
    desk_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    project_root = os.path.dirname(desk_dir)
    crawler_path = os.path.join(project_root, 'crawler')
    src_path = os.path.join(desk_dir, 'src')  # src 폴더도 추가
    
    print(f"🔧 [Collector] desk_dir: {desk_dir}")
    print(f"🔧 [Collector] crawler_path: {crawler_path}")
    print(f"🔧 [Collector] src_path: {src_path}")
    
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
    즉시 수집 실행
    """
    print("🚀 [Collector] API called - starting collection...")
    
    try:
        desk_dir, crawler_path = _setup_paths()
        
        # .env 로드 (새 desk 폴더에서)
        env_file = os.path.join(desk_dir, '.env')
        print(f"🔧 [Collector] Loading .env from: {env_file}")
        if os.path.exists(env_file):
            from dotenv import load_dotenv
            load_dotenv(env_file)
            print("✅ [Collector] .env loaded")
        else:
            print("⚠️ [Collector] .env not found")
        
        # 크롤러 실행
        print("🔧 [Collector] Importing run_full_pipeline...")
        from core.extractor import run_full_pipeline
        
        print("🔧 [Collector] Calling run_full_pipeline...")
        result = run_full_pipeline(schedule_name="즉시 수집")
        print(f"✅ [Collector] Pipeline result: {result}")
        
        # 결과 추출
        collected = result.get('collected', 0) or result.get('total', 0)
        extracted = result.get('extracted', 0)
        
        return jsonify({
            'success': True,
            'collected': collected,
            'extracted': extracted,
            'message': f'수집 {collected}개, 추출 {extracted}개 완료'
        })
            
    except ImportError as e:
        print(f"❌ [Collector] Import error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Crawler module import failed: {e}'
        }), 500
    except Exception as e:
        print(f"❌ [Collector] Error: {e}")
        import traceback
        with open('debug_collector.log', 'a', encoding='utf-8') as f:
            f.write(f"\n[{datetime.now()}] Error:\n")
            traceback.print_exc(file=f)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@collector_bp.route('/api/collector/status', methods=['GET'])
def get_status():
    """수집 상태 조회"""
    return jsonify({
        'success': True,
        'status': 'idle',
        'message': 'No collection running'
    })
