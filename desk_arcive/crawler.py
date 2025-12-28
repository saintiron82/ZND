import os
import json
import time
import requests
import feedparser
from bs4 import BeautifulSoup
from newspaper import Article
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Import custom clients
from src.mll_client import MLLClient
from src.db_client import DBClient
from src.crawler.utils import RobotsChecker

# Import shared core logic (source of truth for all crawlers)
from src.core_logic import (
    get_url_hash,
    get_article_id,
    load_from_cache,
    save_to_cache,
    normalize_field_names,
    update_manifest,
    HistoryStatus,
    get_data_filename,
)

# Load environment variables
# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, '.env')

# Load environment variables
load_dotenv(dotenv_path=ENV_PATH)

print(f"DEBUG: Loaded MLL_API_URL: {os.getenv('MLL_API_URL')}")

# 크롤링 설정 (환경변수 우선, 없으면 기본값)
TARGETS_FILE = os.path.join(BASE_DIR, os.getenv('TARGETS_FILE', 'config/targets.json'))
CRAWL_LIMIT = int(os.getenv('CRAWL_LIMIT', 999))  # 글로벌 크롤링 수량 제한

def load_targets():
    """
    Loads settings and targets from JSON.
    Returns: (settings_dict, targets_list) tuple
    """
    with open(TARGETS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 새 구조: {settings: {...}, targets: [...]} 또는 레거시: [...]
    if isinstance(data, dict):
        return data.get('settings', {}), data.get('targets', [])
    else:
        return {}, data  # 레거시 배열 형식

def is_recent(date_obj, max_age_hours=48):
    """Checks if a date is within the specified hours."""
    if not date_obj:
        return True # Keep if no date found (benefit of the doubt) but log warning? Actually standard usually is keep.
    
    now = datetime.now(timezone.utc)
    
    # Handle struct_time (from feedparser)
    if isinstance(date_obj, time.struct_time):
        dt = datetime.fromtimestamp(time.mktime(date_obj), tz=timezone.utc)
    elif isinstance(date_obj, datetime):
        if date_obj.tzinfo is None:
            date_obj = date_obj.replace(tzinfo=timezone.utc)
        dt = date_obj
    else:
        return True # Unknown format, keep it
        
    delta = now - dt
    return delta <= timedelta(hours=max_age_hours)

def fetch_links(target, max_age_hours=48):
    """Fetches links based on target type (rss or html)."""
    links = []
    print(f"Fetching from {target['id']}...")
    
    try:
        if target['type'] == 'rss':
            feed = feedparser.parse(target['url'])
            for entry in feed.entries:
                # Check date for RSS
                date_parsed = entry.get('published_parsed') or entry.get('updated_parsed')
                if date_parsed:
                     if is_recent(date_parsed, max_age_hours):
                        links.append(entry.link)
                     else:
                        # Optional: Print skipped? Might be too noisy for RSS
                        pass
                else:
                    links.append(entry.link)
        elif target['type'] == 'html':
            response = requests.get(target['url'])
            soup = BeautifulSoup(response.text, 'html.parser')
            elements = soup.select(target['selector'])
            for el in elements:
                link = el.get('href')
                if link:
                    # Handle relative URLs if necessary
                    if link.startswith('/'):
                        base_url = '/'.join(target['url'].split('/')[:3])
                        link = base_url + link
                    links.append(link)
    except Exception as e:
        print(f"Error fetching {target['id']}: {e}")
        
    return list(dict.fromkeys(links)) # Deduplicate preserving order

def extract_content(url):
    """Extracts article content using newspaper3k."""
    try:
        article = Article(url)
        article.download()
        article.parse()
        return {'text': article.text, 'title': article.title}
    except Exception as e:
        print(f"Error extracting {url}: {e}")
        return None

import asyncio
from src.crawler.core import AsyncCrawler

def run_crawler():
    asyncio.run(main())

async def main():
    """
    Auto Crawler - Orchestrates the unified pipeline.
    Only difference from manual: loops through targets automatically.
    """
    from src.pipeline import process_article, get_db
    from src.core_logic import get_config
    
    # 1. 클라이언트 초기화
    mll = MLLClient()
    db = get_db()
    
    settings, targets = load_targets()
    max_consecutive_duplicates = settings.get('max_consecutive_duplicates', 3)
    max_article_age_hours = settings.get('max_article_age_hours', 48)
    
    for target in targets:
        print(f"\n🎯 [Target] Processing target: {target['id']}")
        
        # 1. Fetch Links (with age filter)
        article_links = fetch_links(target, max_article_age_hours)
        
        # Apply limit (타겟 설정과 ENV 중 낮은 값 적용)
        target_limit = target.get('limit', 5)
        effective_limit = min(target_limit, CRAWL_LIMIT)
        
        # [NEW] 하이브리드 전략: limit까지는 안전, 이후는 연속 중복 감지
        # max_consecutive_duplicates는 targets.json의 settings에서 로드됨
        
        print(f"🔗 [Links] Found {len(article_links)} links (Limit: {effective_limit}, Extended mode after limit).")
        
        # 2. Filter duplicates with hybrid strategy
        new_links = []
        consecutive_duplicates = 0
        processed_count = 0
        
        for link in article_links:
            processed_count += 1
            
            if db.check_history(link):
                # Limit 이내: 스킵만 하고 계속 진행
                if processed_count <= effective_limit:
                    print(f"⏭️ [Skip] Duplicate (within limit): {link[:50]}...")
                    consecutive_duplicates = 0  # limit 이내에서는 리셋
                else:
                    # Limit 초과: 연속 중복 카운트
                    consecutive_duplicates += 1
                    print(f"⏭️ [Skip] Duplicate ({consecutive_duplicates}/{max_consecutive_duplicates}): {link[:50]}...")
                    
                    if consecutive_duplicates >= max_consecutive_duplicates:
                        print(f"🛑 [Stop] {target['id']}: 연속 {max_consecutive_duplicates}회 중복 감지 - 해당 소스 정지")
                        break
            else:
                consecutive_duplicates = 0  # 새 기사 발견 시 리셋
                new_links.append(link)
        
        if not new_links:
            print("✨ No new links to process.")
            continue

        # 3. Process each article using unified pipeline
        print(f"🚀 [Process] Processing {len(new_links)} new links...")
        
        for url in new_links:
            try:
                result = await process_article(
                    url=url,
                    source_id=target['id'],
                    mll_client=mll,
                    skip_mll=False  # Auto mode uses MLL
                )
                
                status = result.get('status', 'unknown')
                if status == 'saved':
                    print(f"✅ [Success] Saved: {result.get('article_id')}")
                elif status == 'worthless':
                    print(f"🚫 [Worthless] {result.get('reason')}")
                elif status == 'mll_failed':
                    print(f"⚠️ [MLL Failed] {result.get('reason')}")
                elif status == 'already_processed':
                    print(f"⏭️ [Skip] Already: {result.get('history_status')}")
                else:
                    print(f"❓ [Unknown] {status}: {result}")
                    
            except Exception as e:
                print(f"❌ [Error] Failed to process {url}: {e}")


if __name__ == "__main__":
    run_crawler()
