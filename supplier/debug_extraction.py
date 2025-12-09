import sys
import os
import asyncio
sys.path.append(os.getcwd())
from src.crawler.fetcher import HttpFetcher
from src.crawler.extractor import CompositeExtractor

async def main():
    url = "https://www.aitimes.com/news/articleView.html?idxno=204531"
    fetcher = HttpFetcher()
    extractor = CompositeExtractor()

    print(f"Fetching {url}...")
    html = await fetcher.fetch(url)
    
    if not html:
        print("Failed to fetch HTML")
        return

    with open("debug_aitimes.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Saved HTML to debug_aitimes.html")

    print(f"HTML length: {len(html)}")
    
    print("Extracting content...")
    data = extractor.extract(html, url)
    
    print("-" * 20)
    print(f"Title: {data.get('title')}")
    print(f"Text length: {len(data.get('text', ''))}")
    print(f"Text preview: {data.get('text', '')[:200]}")
    print("-" * 20)

    # Test custom selector
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    content_div = soup.select_one('#article-view-content-div')
    if content_div:
        text = content_div.get_text(strip=True, separator='\n')
        print(f"Custom Selector Text length: {len(text)}")
        print(f"Custom Selector Text preview: {text[:200]}")
    else:
        print("Custom selector #article-view-content-div not found")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
