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
        article_links = fetch_links(target)
        
        # Apply limit
        limit = target.get('limit', 5)
        article_links = article_links[:limit]
        
        print(f"Found {len(article_links)} links (Limit: {limit}).")
        
        for link in article_links:
            # Check duplicate before processing
            if db.check_history(link):
                print(f"Skipping duplicate: {link}")
                continue

            # 2. 본문 추출
            content_data = extract_content(link)
            if not content_data or len(content_data['text']) < 200: 
                print("  -> Content too short or failed extraction.")
                db.save_history(link, 'SKIPPED', reason='short_content_or_failed')
                continue

            print(f"Processing: {link}")

            # Truncate text to avoid MLL token limits or timeouts
            truncated_text = content_data['text'][:3000]

            # 3. [Real] MLL에게 분석 요청
            try:
                result_json = mll.analyze_text(truncated_text)
            except Exception as e:
                print(f"❌ MLL Critical Error: {e}")
                print("🛑 크롤러를 즉시 정지합니다.")
                return

            if result_json:
                # 4. 점수 필터링 (ZeroNoise 철학)
                score = result_json.get('score', 0)
                if score < 4:
                    print(f"🗑️ 저품질 기사 폐기 (Score: {score})")
                    db.save_history(link, 'REJECTED', reason=f'low_score_{score}')
                    continue
                
                # 5. 데이터 병합 및 저장
                final_doc = {
                    **result_json,          # MLL 분석 결과 (title_ko, summary...)
                    "url": link,            # 원본 링크
                    "source_id": target['id'],
                    "crawled_at": datetime.now(timezone.utc), # Use UTC
                    "original_title": content_data['title']
                }
                
                db.save_article(final_doc)
                print(f"💾 저장 완료: {result_json.get('title_ko')} (Score: {score})")
            else:
                print("⚠️ MLL 분석 실패 (None 반환).")
                print("🛑 크롤러를 즉시 정지합니다.")
                return
            
            time.sleep(1) # Be polite

if __name__ == "__main__":
    run_crawler()
