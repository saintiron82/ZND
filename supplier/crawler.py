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
    # 1. 클라이언트 초기화
    mll = MLLClient()
    db = DBClient()
    # Initialize AsyncCrawler (Playwright for robustness, or configurable)
    crawler = AsyncCrawler(use_playwright=True, max_concurrency=5)
    
    targets = load_targets()
    
    try:
        for target in targets:
            print(f"\n🎯 [Target] Processing target: {target['id']}")
            
            # 1. Fetch Links (Keep existing sync logic for discovery)
            # This could be made async later, but it's fast enough for now.
            article_links = fetch_links(target)
            
            # Apply limit
            limit = target.get('limit', 5)
            article_links = article_links[:limit]
            
            print(f"🔗 [Links] Found {len(article_links)} links (Limit: {limit}).")
            
            # 2. Filter duplicates
            new_links = []
            for link in article_links:
                if db.check_history(link):
                    print(f"⏭️ [Skip] Duplicate found in history: {link}")
                else:
                    new_links.append(link)
            
            if not new_links:
                print("✨ No new links to process.")
                continue

            # 3. Crawl (Fetch + Extract) in parallel
            print(f"🚀 [Crawl] Processing {len(new_links)} new links with AsyncCrawler...")
            results = await crawler.process_urls(new_links)
            
            # 4. Analyze & Save
            for data in results:
                url = data['url']
                text = data.get('text', '')
                title = data.get('title', '')
                published_at = data.get('published_at')

                # Filter by age
                if published_at:
                    # Parse if string (from JSON-LD maybe?) or usage object
                    # Extractor usually returns strings for JSON-LD, datetime for newspaper
                    # normalize to datetime
                    if isinstance(published_at, str):
                        try:
                            # Simple attempt or use dateparser if available. 
                            # For now, let's trust newspaper's datetime or simple ISO
                            published_at = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                        except:
                            pass # Failed to parse, keep it

                    if not is_recent(published_at):
                        print(f"⏳ [Skip] Article too old: {url} ({published_at})")
                        db.save_history(url, 'SKIPPED', reason='too_old')
                        continue
                
                if not text or len(text) < 200:
                    print(f"⚠️ [Skip] Content too short or failed extraction: {url}")
                    db.save_history(url, 'SKIPPED', reason='short_content_or_failed')
                    continue

                # Truncate text
                truncated_text = text[:3000]
                print(f"✂️ [Extract] Text truncated to {len(truncated_text)} chars.")

                # MLL Analysis
                print(f"🤖 [Analyze] Requesting MLL analysis for: {title}")
                try:
                    result_json = mll.analyze_text(truncated_text)
                    
                    if result_json:
                        zero_noise_score = result_json.get('zero_noise_score', 0)
                        impact_score = result_json.get('impact_score', 0)
                        
                        final_doc = {
                            **result_json,
                            "url": url,
                            "source_id": target['id'],
                            "crawled_at": datetime.now(timezone.utc),
                            "original_title": title,
                            "image": data.get('image'), # Add image from extractor
                            "summary_extracted": data.get('summary') # Add extracted summary if any
                        }
                        
                        print(f"💾 [Save] Saving article: {result_json.get('title_ko')} (ZS: {zero_noise_score})")
                        db.save_article(final_doc)
                        print(f"✅ [Success] Item processed successfully.")
                    else:
                        print("⚠️ [Analyze] MLL returned None.")
                        # We might want to save as failed or retry?
                        
                except Exception as e:
                    print(f"❌ [Error] MLL/Save failed for {url}: {e}")
                
                # Polite delay between analysis calls if needed (though MLL API handles it)
                # await asyncio.sleep(1) 

    finally:
        await crawler.close()

if __name__ == "__main__":
    run_crawler()
