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


def collect_links(progress_callback=None) -> dict:
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
        time_condition = settings.get('hours', 24)
        all_links = []
        
        # 캐시 체크용 함수
        from src.core_logic import load_from_cache
        
        total_found = 0
        total_added = 0
        total_skipped = 0
        
        for idx, target in enumerate(targets):
            target_id = target.get('id')
            target_name = target.get('name', target_id) # 이름이 있으면 이름 사용
            
            # UX를 위해 검색 정보 노출 (UI에서 볼 수 있도록 시간차 둠)
            if progress_callback:
                progress_callback({
                    'status': 'collecting',
                    'message': f"🔍 [{idx+1}/{len(targets)}] '{target_name}' 검색 중... ({time_condition}h)"
                })
            
            # 메시지가 UI에 렌더링될 시간을 줌
            time.sleep(0.3)

            print(f"📡 [Collect] Fetching from target: {target_id} ({target.get('url')})")
            links = desk_crawler.fetch_links(target)
            found_count = len(links)
            total_found += found_count
            print(f"   found {found_count} raw links")
            
            limit = target.get('limit', 5)
            links = links[:limit]
            
            skipped_history = 0
            skipped_cache = 0
            added_count = 0
            
            for link in links:
                # 1. 히스토리 체크 (이미 처리된 것 제외: ACCEPTED, REJECTED 등)
                is_in_history = db.check_history(link)
                if is_in_history:
                    skipped_history += 1
                    continue
                
                # 2. 캐시 체크 (이미 추출된 것 제외)
                cached = load_from_cache(link)
                if cached and cached.get('text'):
                    skipped_cache += 1
                    continue
                
                print(f"   ✅ [New] Adding link: {link}")
                all_links.append({
                    'url': link,
                    'source_id': target['id'],
                    'target_name': target.get('name', target['id'])
                })
                added_count += 1
            
            total_added += added_count
            total_skipped += skipped_history + skipped_cache
            
            print(f"   ⏭️ [{target['id']}] Result: Added={added_count}, SkipHistory={skipped_history}, SkipCache={skipped_cache}")
            
            # 각 타겟 완료 결과를 팝업에 표시
            if progress_callback:
                progress_callback({
                    'status': 'collecting',
                    'message': f"✅ [{idx+1}/{len(targets)}] '{target_name}': {found_count}개 발견 → {added_count}개 신규 (스킵: {skipped_history+skipped_cache})"
                })
        
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
        
        # 최종 수집 결과 요약을 팝업에 표시
        if progress_callback:
            progress_callback({
                'status': 'collecting',
                'message': f"📊 수집 완료: {len(targets)}개 소스에서 {total_found}개 발견 → {len(unique_links)}개 신규 확보"
            })
        
        return {
            'success': True,
            'links': unique_links,
            'total': len(unique_links),
            'total_found': total_found,
            'total_skipped': total_skipped,
            'message': msg
        }
        
    except Exception as e:
        duration = time.time() - start_time
        log_crawl_event("Collect", f"Error: {str(e)}", duration, success=False)
        print(f"❌ [Collect] Error: {e}")
        return {'success': False, 'error': str(e), 'links': []}
