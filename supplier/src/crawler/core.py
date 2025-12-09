import asyncio
import logging
from typing import List, Dict, Optional
from urllib.parse import urlparse

from .fetcher import HttpFetcher, PlaywrightFetcher
from .extractor import CompositeExtractor
from .utils import RobotsChecker
from .middleware import RetryMiddleware
from .processor import CompositeProcessor

logger = logging.getLogger(__name__)

class AsyncCrawler:
    def __init__(self, use_playwright=False, headless=True, max_concurrency=5):
        self.use_playwright = use_playwright
        self.fetcher = PlaywrightFetcher(headless=headless) if use_playwright else HttpFetcher()
        self.extractor = CompositeExtractor()
        self.robots_checker = RobotsChecker()
        self.retry_middleware = RetryMiddleware()
        self.processor = CompositeProcessor()
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.seen_urls = set()

    async def start(self):
        if hasattr(self.fetcher, 'start'):
            await self.fetcher.start()

    async def close(self):
        await self.fetcher.close()

    async def process_url(self, url: str) -> Optional[Dict]:
        if url in self.seen_urls:
            return None
        self.seen_urls.add(url)

        # Robots.txt check
        if not self.robots_checker.can_fetch(url):
            logger.warning(f"Disallowed by robots.txt: {url}")
            return None

        async with self.semaphore:
            try:
                logger.info(f"Fetching: {url}")
                
                # Use retry middleware for fetching
                html = await self.retry_middleware.execute(self.fetcher.fetch, url)
                
                if not html:
                    logger.warning(f"Failed to fetch or empty content: {url}")
                    return None

                logger.info(f"Extracting: {url}")
                data = self.extractor.extract(html, url)
                data['url'] = url
                
                # Process data (clean/normalize)
                data = self.processor.process(data)
                
                return data
            except Exception as e:
                logger.error(f"Error processing {url}: {e}")
                return None

    async def process_urls(self, urls: List[str]) -> List[Dict]:
        await self.start()
        try:
            tasks = [self.process_url(url) for url in urls]
            results = await asyncio.gather(*tasks)
            return [r for r in results if r]
        finally:
            await self.close()
