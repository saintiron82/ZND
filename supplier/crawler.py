import os
import json
import time
import requests
import feedparser
from bs4 import BeautifulSoup
from newspaper import Article
from datetime import datetime, timezone
from dotenv import load_dotenv

# Import custom clients
from src.mll_client import MLLClient
from src.db_client import DBClient

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

def fetch_links(target):
    """Fetches links based on target type (rss or html)."""
    links = []
    print(f"Fetching from {target['id']}...")
    
    try:
        if target['type'] == 'rss':
            feed = feedparser.parse(target['url'])
            for entry in feed.entries:
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
        
    return list(set(links)) # Deduplicate

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

def run_crawler():
    # 1. 클라이언트 초기화
    mll = MLLClient()
    db = DBClient()
    
    targets = load_targets()
    
    consecutive_failures = 0
    MAX_CONSECUTIVE_FAILURES = 3


    for target in targets:
        print(f"\n🎯 [Target] Processing target: {target['id']}")
        article_links = fetch_links(target)
        
        # Apply limit
        limit = target.get('limit', 5)
        article_links = article_links[:limit]
        
        print(f"🔗 [Links] Found {len(article_links)} links (Limit: {limit}).")
        
        for i, link in enumerate(article_links):
            print(f"\n--------------------------------------------------")
            print(f"📄 [Item {i+1}/{len(article_links)}] Processing: {link}")
            
            try:
                # Check duplicate before processing
                if db.check_history(link):
                    print(f"⏭️ [Skip] Duplicate found in history.")
                    continue

                # 2. 본문 추출
                print(f"📰 [Extract] Extracting content...")
                content_data = extract_content(link)
                if not content_data or len(content_data['text']) < 200: 
                    print("⚠️ [Skip] Content too short or failed extraction.")
                    db.save_history(link, 'SKIPPED', reason='short_content_or_failed')
                    continue

                # Truncate text to avoid MLL token limits or timeouts
                truncated_text = content_data['text'][:3000]
                print(f"✂️ [Extract] Text truncated to {len(truncated_text)} chars.")

                # 3. [Real] MLL에게 분석 요청
                print(f"🤖 [Analyze] Requesting MLL analysis...")
                result_json = mll.analyze_text(truncated_text)

                if result_json:
                    # 4. 필터링 제거 (모든 데이터 저장)
                    # 사용자 요청에 따라 모든 응답을 저장하고, 노출 여부는 프론트엔드에서 결정함.
                    
                    zero_noise_score = result_json.get('zero_noise_score', 0)
                    impact_score = result_json.get('impact_score', 0)
                    
                    # 5. 데이터 병합 및 저장
                    final_doc = {
                        **result_json,          # MLL 분석 결과 (zero_noise_score, impact_score, title_ko, summary...)
                        "url": link,            # 원본 링크
                        "source_id": target['id'],
                        "crawled_at": datetime.now(timezone.utc), # Use UTC
                        "original_title": content_data['title']
                    }
                    
                    print(f"💾 [Save] Saving article: {result_json.get('title_ko')} (ZS: {zero_noise_score}, IS: {impact_score})")
                    db.save_article(final_doc)
                    
                    # Reset failure counter on success
                    consecutive_failures = 0
                    print(f"✅ [Success] Item processed successfully.")

                else:
                    print("⚠️ [Analyze] MLL returned None.")
                    consecutive_failures += 1
                    print(f"🚨 [Failure] Consecutive failures: {consecutive_failures}/{MAX_CONSECUTIVE_FAILURES}")
                
                time.sleep(1) # Be polite

            except Exception as e:
                print(f"❌ [Error] Failed to process item: {e}")
                consecutive_failures += 1
                print(f"🚨 [Failure] Consecutive failures: {consecutive_failures}/{MAX_CONSECUTIVE_FAILURES}")

            # Check if we should stop
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                print(f"\n🛑 [Stop] Too many consecutive failures ({consecutive_failures}). Stopping crawler.")
                return

if __name__ == "__main__":
    run_crawler()
