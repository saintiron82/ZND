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

# Import dependencies directly
import requests
import feedparser
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from dateutil import parser as date_parser

def normalize_url(url: str) -> str:
    """
    URL 정규화: UTM 파라미터만 제거, 필수 파라미터는 유지
    """
    if not url:
        return ""

    # 1. 공백 제거
    url = url.strip()

    # 2. UTM/추적 파라미터만 선택적으로 제거 (필수 파라미터는 유지)
    if '?' in url:
        from urllib.parse import urlparse, parse_qs, urlencode
        parsed = urlparse(url)
        params = parse_qs(parsed.query)

        # 제거할 추적 파라미터 목록
        tracking_params = {'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                          'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'}

        # 추적 파라미터만 제거, 나머지는 유지
        filtered_params = {k: v[0] for k, v in params.items() if k.lower() not in tracking_params}

        if filtered_params:
            new_query = urlencode(filtered_params)
            url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{new_query}"
        else:
            url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

    # 3. 끝 슬래시 제거 (선택적)
    if url.endswith('/'):
        url = url[:-1]

    return url

def load_targets():
    """타겟 설정 로드 (desk/config/targets.json)"""
    config_path = os.path.join(DESK_DIR, 'config', 'targets.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('settings', {}), data.get('targets', [])
    except Exception as e:
        print(f"❌ [Collector] Failed to load targets: {e}")
        return {}, []

def is_recent(pub_date, days=2):
    """최신 기사 여부 확인"""
    if not pub_date:
        return True # 날짜 없으면 일단 수집
    
    try:
        if isinstance(pub_date, str):
            dt = date_parser.parse(pub_date)
        else:
            dt = pub_date
            
        # Timezone unaware -> aware (assuming KST if local)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
            
        now = datetime.now(dt.tzinfo)
        diff = now - dt
        return diff.days <= days
    except:
        return True # 파싱 실패 시 안전하게 수집

def fetch_links(target):
    """링크 수집 (RSS/HTML) - URL 정규화 적용"""
    t_type = target.get('type', 'rss')
    url = target.get('url')
    links = []
    
    if not url:
        return []
        
    try:
        if t_type == 'rss':
            feed = feedparser.parse(url)
            for entry in feed.entries:
                link = entry.get('link')
                if not link: continue
                
                # 날짜 필터링 (옵션)
                pub_date = entry.get('published') or entry.get('updated')
                if not is_recent(pub_date):
                    continue
                    
                norm_link = normalize_url(link)
                if norm_link:
                    links.append(norm_link)
                    
        elif t_type == 'html':
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            resp = requests.get(url, headers=headers, timeout=10)
            resp.encoding = resp.apparent_encoding
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            selector = target.get('selector', 'a')
            
            for tag in soup.select(selector):
                href = tag.get('href')
                if not href: continue
                
                # 상대 경로 처리
                if href.startswith('/'):
                    from urllib.parse import urljoin
                    href = urljoin(url, href)
                elif not href.startswith('http'):
                    continue
                    
                norm_link = normalize_url(href)
                if norm_link:
                    links.append(norm_link)
                    
    except Exception as e:
        print(f"⚠️ [Fetch] Error fetching {url}: {e}")
        
    return list(set(links)) # 중복 제거

def collect_links(progress_callback=None) -> dict:
    """
    모든 활성 타겟에서 새 링크를 수집합니다.
    
    Returns:
        dict: {success: bool, links: list, message: str}
    """
    start_time = time.time()
    db = FirestoreClient()
    
    try:
        # Desk config/targets.json 로드
        settings, targets = load_targets()
        time_condition = settings.get('hours', 24)
        all_links = []
        
        # 캐시 체크용 함수
        from src.core_logic import load_from_cache
        
        total_found = 0
        total_added = 0
        total_skipped = 0
        
        for idx, target in enumerate(targets):
            target_id = target.get('id')
            target_name = target.get('name', target_id) 
            
            if progress_callback:
                progress_callback({
                    'status': 'collecting',
                    'message': f"🔍 [{idx+1}/{len(targets)}] '{target_name}' 검색 중..."
                })
            
            time.sleep(0.3)

            print(f"📡 [Collect] Fetching from target: {target_id} ({target.get('url')})")
            
            # [Refactored] Use internal fetch_links
            links = fetch_links(target)
            
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
                
                # 2. 캐시 체크
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
            
            if progress_callback:
                progress_callback({
                    'status': 'collecting',
                    'message': f"✅ [{idx+1}/{len(targets)}] '{target_name}': {found_count}개 발견 → {added_count}개 신규"
                })
        
        # 중복 제거 (전체)
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
        
        if progress_callback:
            progress_callback({
                'status': 'collecting',
                'message': f"📊 수집 완료: {len(unique_links)}개 신규 확보"
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
