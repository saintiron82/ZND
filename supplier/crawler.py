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

TARGETS_FILE = os.path.join(BASE_DIR, 'config', 'targets.json')

def load_targets():
    """Loads target configurations from JSON."""
    with open(TARGETS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def is_recent(date_obj):
    """Checks if a date is within the last 3 days."""
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
    return delta <= timedelta(days=3)

def fetch_links(target):
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
                     if is_recent(date_parsed):
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
    
    targets = load_targets()
    
    for target in targets:
        print(f"\n🎯 [Target] Processing target: {target['id']}")
        
        # 1. Fetch Links
        article_links = fetch_links(target)
        
        # Apply limit
        limit = target.get('limit', 5)
        article_links = article_links[:limit]
        
        print(f"🔗 [Links] Found {len(article_links)} links (Limit: {limit}).")
        
        # 2. Filter duplicates (quick check)
        new_links = []
        for link in article_links:
            if db.check_history(link):
                print(f"⏭️ [Skip] Duplicate: {link[:50]}...")
            else:
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
