import asyncio
import logging
import random
from typing import Optional, Callable, Any

logger = logging.getLogger(__name__)

class Middleware:
    async def process_request(self, request):
        pass

    async def process_response(self, response):
        pass

class RetryMiddleware(Middleware):
    def __init__(self, max_retries=3, base_delay=1.0, max_delay=10.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay

    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        retries = 0
        while True:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if retries >= self.max_retries:
                    logger.error(f"Max retries reached. Last error: {e}")
                    raise e
                
                delay = min(self.max_delay, self.base_delay * (2 ** retries))
                # Add jitter
                delay = delay * random.uniform(0.8, 1.2)
                
                logger.warning(f"Attempt {retries + 1} failed: {e}. Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                retries += 1

# Placeholder for ProxyMiddleware
class ProxyMiddleware(Middleware):
    def __init__(self, proxy_list=None):
        self.proxy_list = proxy_list or []

    def get_proxy(self):
        if not self.proxy_list:
            return None
        return random.choice(self.proxy_list)
