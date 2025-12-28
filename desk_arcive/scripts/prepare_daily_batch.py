import os
import sys
import json
import asyncio
import argparse
from datetime import datetime

# Allow importing from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from crawler import load_targets, fetch_links
from src.crawler.core import AsyncCrawler
from src.db_client import DBClient
from src.core_logic import get_article_id, save_to_cache

# Configuration
BATCH_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cache', 'batches')
os.makedirs(BATCH_DIR, exist_ok=True)
db = DBClient()

async def process_target(target, date_str):
    """Process a single target and return a batch of articles."""
    print(f"Target: {target['id']} ({target.get('name', 'Unknown')})")
    
    # 1. Fetch Links
    try:
        links = fetch_links(target)
        print(f"  - Found {len(links)} links")
    except Exception as e:
        print(f"  - Error fetching links: {e}")
        return []

    # 2. Filter New Articles
    new_links = []
    for link in links:
        # Check History
        if db.check_history(link):
            continue
        new_links.append(link)
    
    print(f"  - New articles: {len(new_links)}")
    if not new_links:
        return []

    # 3. Crawl Content
    crawler = AsyncCrawler(use_playwright=True) # Use Playwright for best results
    articles = []
    
    try:
        await crawler.start()
        
        for url in new_links:
            try:
                print(f"  - Crawling: {url}")
                content = await crawler.process_url(url)
                
                if not content or len(content.get('text', '')) < 200:
                    print(f"    -> Skipped (Short/Empty)")
                    continue
                
                # Save to Main Cache (Important for Injection step)
                save_to_cache(url, content)
                
                # Format for Prompt Bundle
                # We need simple ID and Content for the LLM
                articles.append({
                    "id": new_links.index(url) + 1, # Simple 1-based index for visual reference
                    "article_id": get_article_id(url), # Real ID for tracking
                    "url": url,
                    "source_id": target['id'],
                    "content": content.get('text', '')[:3000] # Cap length for token limits
                })
                
            except Exception as e:
                print(f"    -> Failed: {e}")
                
    finally:
        await crawler.close()
        
    return articles

async def main():
    parser = argparse.ArgumentParser(description='Prepare daily article batches')
    parser.add_argument('--target', help='Specific target ID to process')
    args = parser.parse_args()
    
    _, targets = load_targets()
    if args.target:
        targets = [t for t in targets if t['id'] == args.target]
        
    date_str = datetime.now().strftime('%Y-%m-%d')
    total_articles = 0
    
    print(f"=== Starting Batch Preparation [{date_str}] ===")
    
    all_batch_data = []

    for target in targets:
        articles = await process_target(target, date_str)
        
        if articles:
            # Save individual target batch or combined? 
            # Let's save individually for flexibility, but also could verify later.
            # Strategy: Save one file per target for easier copying.
            
            batch_filename = f"{date_str}_{target['id']}_batch.json"
            batch_path = os.path.join(BATCH_DIR, batch_filename)
            
            # Simplified structure for LLM Prompt
            # We want to minimize tokens, so maybe just id and text?
            # But we need metadata for injection later.
            
            # Let's create the "Prompt Ready" format directly inside?
            # Or just save raw data and let UI format it?
            # Saving raw data is safer.
            
            with open(batch_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "target_id": target['id'],
                    "date": date_str,
                    "created_at": datetime.now().isoformat(),
                    "count": len(articles),
                    "articles": articles
                }, f, ensure_ascii=False, indent=2)
                
            print(f"  -> Saved batch: {batch_filename} ({len(articles)} articles)")
            total_articles += len(articles)
            
    print(f"=== Completed. Total Articles: {total_articles} ===")

if __name__ == '__main__':
    asyncio.run(main())
