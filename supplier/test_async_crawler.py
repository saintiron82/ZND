import asyncio
import logging
from src.crawler.core import AsyncCrawler

# Configure logging
logging.basicConfig(level=logging.INFO)

async def test_crawler():
    urls = [
        "https://www.wikipedia.org/",
        "https://www.bbc.com/news", # Often has schema.org
        "https://news.ycombinator.com/"
    ]

    print("--- Testing HTTP Fetcher ---")
    crawler = AsyncCrawler(use_playwright=False)
    results = await crawler.process_urls(urls)
    
    for res in results:
        print(f"URL: {res['url']}")
        print(f"Title: {res.get('title')}")
        print(f"Summary: {res.get('summary')}")
        print("-" * 20)

    print("\n--- Testing Playwright Fetcher ---")
    # Only test one URL for speed
    crawler_pw = AsyncCrawler(use_playwright=True)
    results_pw = await crawler_pw.process_urls(urls[:1])
    
    for res in results_pw:
        print(f"URL: {res['url']}")
        print(f"Title: {res.get('title')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(test_crawler())
