# -*- coding: utf-8 -*-
"""
로컬 캐시 기사를 Firestore로 강제 동기화하는 스크립트
"""
import os
import sys
import glob
import json

# Path setup
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DESK_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, DESK_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(DESK_DIR, '.env'))

from src.core.article_manager import ArticleManager
from src.core.firestore_client import FirestoreClient

def sync_local_to_firestore():
    """로컬 캐시의 모든 기사를 Firestore에 동기화"""
    manager = ArticleManager()
    db = FirestoreClient()
    
    # 캐시 경로
    env = os.getenv('ZND_ENV', 'dev')
    cache_root = os.path.join(DESK_DIR, 'cache', env)
    
    print(f"🔍 캐시 경로: {cache_root}")
    
    if not os.path.exists(cache_root):
        print("❌ 캐시 폴더가 존재하지 않습니다.")
        return
    
    # 24시간 이내 날짜 폴더만 대상
    from datetime import datetime, timedelta
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    target_dates = [today.strftime('%Y-%m-%d'), yesterday.strftime('%Y-%m-%d')]
    print(f"📅 대상 날짜: {target_dates}")
    
    # 해당 날짜 폴더의 JSON 파일만 찾기
    json_files = []
    for date_str in target_dates:
        folder = os.path.join(cache_root, date_str)
        if os.path.exists(folder):
            json_files.extend(glob.glob(os.path.join(folder, '*.json')))
    print(f"📂 발견된 파일: {len(json_files)}개")
    
    synced = 0
    skipped = 0
    failed = 0
    
    for fpath in json_files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # article_id 추출
            article_id = data.get('_header', {}).get('article_id')
            if not article_id:
                # 파일명에서 추출
                article_id = os.path.basename(fpath).replace('.json', '')
            
            # 상태 확인 - COLLECTED만 대상
            state = data.get('_header', {}).get('state', '')
            if state != 'COLLECTED':
                skipped += 1
                continue
            
            # Firestore에 저장
            url = data.get('_original', {}).get('url') or data.get('url')
            if url:
                # V2 스키마로 변환하여 저장
                if '_header' in data:
                    # 이미 V2 형식
                    db.save_article(article_id, data)
                else:
                    # V1 형식 → ArticleManager.create()로 변환
                    manager.create(url, data)
                
                synced += 1
                print(f"✅ 동기화: {article_id}")
            else:
                failed += 1
                print(f"⚠️ URL 없음: {fpath}")
                
        except Exception as e:
            failed += 1
            print(f"❌ 실패: {fpath} - {e}")
    
    print(f"\n{'='*50}")
    print(f"📊 결과: 동기화={synced}, 스킵={skipped}, 실패={failed}")
    print(f"{'='*50}")

if __name__ == '__main__':
    sync_local_to_firestore()
