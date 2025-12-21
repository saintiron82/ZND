import asyncio
import random
import logging
from abc import ABC, abstractmethod
import aiohttp
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# User-Agent list for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

class BaseFetcher(ABC):
    @abstractmethod
    async def fetch(self, url: str) -> str:
        """Fetches the content of the URL and returns HTML string."""
        pass

    @abstractmethod
    async def close(self):
        """Clean up resources."""
        pass

class HttpFetcher(BaseFetcher):
    def __init__(self):
        self.session = None

    async def get_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession()
        return self.session

    async def fetch(self, url: str) -> str:
        session = await self.get_session()
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        try:
            async with session.get(url, headers=headers, timeout=10, ssl=False) as response:
                response.raise_for_status()
                return await response.text()
        except Exception as e:
            logger.error(f"HttpFetcher error for {url}: {e}")
            return ""

    async def close(self):
        if self.session:
            await self.session.close()

class PlaywrightFetcher(BaseFetcher):
    def __init__(self, headless=True):
        self.headless = headless
        self.playwright = None
        self.browser = None

    async def start(self):
        if not self.playwright:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=self.headless)

    async def fetch(self, url: str) -> str:
        if not self.browser:
            await self.start()
        
        context = await self.browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={'width': 1920 + random.randint(-100, 100), 'height': 1080 + random.randint(-100, 100)}
        )
        page = await context.new_page()
        
        try:
            # Human-like delay
            await asyncio.sleep(random.uniform(0.5, 1.5))
            
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # Additional wait for dynamic content if needed
            # await page.wait_for_selector('body', timeout=5000)
            
            content = await page.content()
            return content
        except Exception as e:
            logger.error(f"PlaywrightFetcher error for {url}: {e}")
            return ""
        finally:
            await page.close()
            await context.close()

    async def close(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
