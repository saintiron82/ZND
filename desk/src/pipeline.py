"""
Unified Crawling Pipeline for ZED

This module provides a single codebase for both automatic and manual crawling.
The only difference is orchestration:
- Auto: Loop through targets automatically
- Manual: User triggers via UI clicks

All processing logic is identical.
"""

from src.core_logic import normalize_field_names
from src.crawler.core import AsyncCrawler


# ==============================================================================
# Core Pipeline Functions
# ==============================================================================

async def extract_article(url: str, use_playwright: bool = True) -> dict | None:
    """
    Extract article content from URL.
    
    Args:
        url: Article URL to extract
        use_playwright: Whether to use Playwright for extraction
    
    Returns:
        Extracted content dict or None if failed
    """
    crawler = AsyncCrawler(use_playwright=use_playwright)
    try:
        await crawler.start()
        result = await crawler.process_url(url)
        return result
    except Exception as e:
        print(f"❌ [Extract] Failed for {url}: {e}")
        return None
    finally:
        await crawler.close()


# evaluate_article removed to prevent logic duplication.
# Rejection logic is centralized in SchedulerPipeline._phase_reject / ArticleManager.


# Legacy functions removed.
# Refer to scheduler_pipeline.py for the new unified pipeline logic.
