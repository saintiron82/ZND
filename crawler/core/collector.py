# -*- coding: utf-8 -*-
"""
Crawler Collector - 링크 수집 모듈
targets.json 기반 새 링크 수집
"""
import os
import sys
import json
import time

# Path setup - must be done before imports
CORE_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLER_DIR = os.path.dirname(CORE_DIR)
ZND_ROOT = os.path.dirname(CRAWLER_DIR)
DESK_DIR = os.path.join(ZND_ROOT, 'desk')
DESK_SRC_CORE_DIR = os.path.join(DESK_DIR, 'src', 'core')  # firestore_client.py 위치

# Add to sys.path
if CRAWLER_DIR not in sys.path:
    sys.path.insert(0, CRAWLER_DIR)
if DESK_DIR not in sys.path:
    sys.path.insert(0, DESK_DIR)
if DESK_SRC_CORE_DIR not in sys.path:
    sys.path.insert(0, DESK_SRC_CORE_DIR)  # firestore_client 임포트용

from core.logger import log_crawl_event
from firestore_client import FirestoreClient

# Import from desk/desk_crawler.py
import desk_crawler as desk_crawler


def collect_links() -> dict:
    """
    모든 활성 타겟에서 새 링크를 수집합니다.
    
    Returns:
        dict: {success: bool, links: list, message: str}
    """
    start_time = time.time()
    db = FirestoreClient()
    
    try:
        # load_targets returns (settings, targets_list) tuple
        settings, targets = desk_crawler.load_targets()
        all_links = []
        
        # 캐시 체크용 함수
        from src.core_logic import load_from_cache
        
        for target in targets:
            print(f"📡 [Collect] Fetching from target: {target.get('id')} ({target.get('url')})")
            links = desk_crawler.fetch_links(target)
            print(f"   found {len(links)} raw links")
            
            limit = target.get('limit', 5)
            links = links[:limit]
            
            skipped_history = 0
            skipped_cache = 0
            
            for link in links:
                # 1. 히스토리 체크 (이미 처리된 것 제외: ACCEPTED, REJECTED 등)
                is_in_history = db.check_history(link)
                if is_in_history:
                    # print(f"   [Skip] History: {link}")
                    skipped_history += 1
                    continue
                
                # 2. 캐시 체크 (이미 추출된 것 제외)
                cached = load_from_cache(link)
                if cached and cached.get('text'):
                    # print(f"   [Skip] Cache: {link}")
                    skipped_cache += 1
                    continue
                
                print(f"   ✅ [New] Adding link: {link}")
                all_links.append({
                    'url': link,
                    'source_id': target['id'],
                    'target_name': target.get('name', target['id'])
                })
            
            print(f"   ⏭️ [{target['id']}] Result: Added={len(links)-skipped_history-skipped_cache}, SkipHistory={skipped_history}, SkipCache={skipped_cache}")
        
        # 중복 제거
        seen = set()
        unique_links = []
        for item in all_links:
            if item['url'] not in seen:
                seen.add(item['url'])
                unique_links.append(item)
        
        duration = time.time() - start_time
        msg = f"Collected {len(unique_links)} new links"
        log_crawl_event("Collect", msg, duration, success=True)
        
        print(f"📡 [Collect] 수집 완료: {len(unique_links)} 새 링크")
        return {
            'success': True,
            'links': unique_links,
            'total': len(unique_links),
            'message': msg
        }
        
    except Exception as e:
        duration = time.time() - start_time
        log_crawl_event("Collect", f"Error: {str(e)}", duration, success=False)
        print(f"❌ [Collect] Error: {e}")
        return {'success': False, 'error': str(e), 'links': []}
