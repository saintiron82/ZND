"""
Unified Crawling Pipeline for ZED

This module provides a single codebase for both automatic and manual crawling.
The only difference is orchestration:
- Auto: Loop through targets automatically
- Manual: User triggers via UI clicks

All processing logic is identical.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from src.core_logic import (
    get_kst_now, # [IMPORTS]
    get_article_id,
    get_config,
    load_from_cache,
    save_to_cache,
    normalize_field_names,
    update_manifest,
    HistoryStatus,
)
from src.core.firestore_client import FirestoreClient
from src.crawler.core import AsyncCrawler
from src.core.score_engine import process_raw_analysis


# Shared DB client instance
_db = None

def get_db() -> FirestoreClient:
    """Get or create shared DB client (FirestoreClient)."""
    global _db
    if _db is None:
        _db = FirestoreClient()
    return _db


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


def evaluate_article(data: dict) -> dict:
    """
    Evaluate article based on scores.
    
    Args:
        data: Article data with zero_echo_score and impact_score
    
    Returns:
        Evaluation result with status and reason
    """
    # Normalize field names first
    data = normalize_field_names(data)
    
    zero_echo_score = float(data.get('zero_echo_score', 0))
    # [MODIFIED] Correct Logic: High Score is GOOD (Not Noise).
    # ZS >= 7.0 is High Value (Low Noise).
    # ZS < 4.0 is worthless (High Noise).
    min_score_threshold = 4.0
    
    if zero_echo_score < min_score_threshold:
        return {
            'status': 'worthless',
            'reason': f'low_score ({zero_echo_score} < {min_score_threshold})',
            'data': data
        }
    
    return {
        'status': 'valid',
        'reason': None,
        'data': data
    }


def save_article(data: dict, source_id: str = None, skip_evaluation: bool = False) -> dict:
    """
    Save article to data folder (unified for auto/manual).
    
    Args:
        data: Article data to save
        source_id: Source identifier (optional, can be in data)
        skip_evaluation: If True, skip noise filtering (for batch inject)
    
    Returns:
        Result dict with status and file info
    """
    db = get_db()
    
    # Normalize field names
    data = normalize_field_names(data)
    
    # Required fields check (title_ko 또는 title 중 하나 필요)
    required_fields = ['url', 'summary', 'zero_echo_score', 'impact_score']
    for field in required_fields:
        if field not in data:
            return {'status': 'error', 'error': f'Missing field: {field}'}
    
    # title 필드 검증 (title_ko 또는 title 중 하나 필요)
    if not data.get('title_ko') and not data.get('title'):
        return {'status': 'error', 'error': 'Missing field: title_ko or title'}
    
    # Get or set source_id
    if source_id:
        data['source_id'] = source_id
    elif 'source_id' not in data:
        data['source_id'] = 'unknown'
    
    # Generate article_id (unified 6-char)
    url = data['url']
    article_id = get_article_id(url)
    data['article_id'] = article_id
    
    # Set crawled_at if not present
    if 'crawled_at' not in data:
        data['crawled_at'] = datetime.now(timezone.utc).isoformat()
    
    # Recalculate scores if raw_analysis is present (ensure freshness)
    if data.get('raw_analysis'):
        try:
            scores = process_raw_analysis(data['raw_analysis'])
            data['zero_echo_score'] = scores.get('zero_echo_score', data.get('zero_echo_score', 0))
            data['impact_score'] = scores.get('impact_score', data.get('impact_score', 0))
            print(f"🔄 [Save] Recalculated scores: ZES={data['zero_echo_score']}, IS={data['impact_score']}")
        except Exception as e:
            print(f"⚠️ [Save] Score recalculation failed: {e}")

    # [REMOVED] Value Judgment / Filtering Logic
    # check_logic is removed per user request. 
    # We save unconditionally. Filtering happens at the Desk UI.
    
    # Save to DB
    try:
        db.save_crawled_article(data)
        # Note: save_crawled_article already updates history if url is present
        # but the logic in DBClient separated them. Let's keep it clean.
        # save_crawled_article implements: self.save_history(url, 'ANALYZED', reason='mll_complete')
        
        # db.save_history(url, HistoryStatus.ACCEPTED) -> This is redundant if save_crawled_article does it.
        # But wait, save_crawled_article sets it to ANALYZED. 
        # HistoryStatus.ACCEPTED is basically analyzed/accepted.
        # Let's trust save_crawled_article.
        
        # Update cache with saved status
        save_to_cache(url, {**data, 'saved': True, 'saved_at': datetime.now(timezone.utc).isoformat()})
        
        # Update manifest
        date_str = data['crawled_at'].split('T')[0]
        update_manifest(date_str)
        
        return {
            'status': 'saved',
            'article_id': article_id,
            'date': date_str,
            'filename': f"{data['source_id']}_{get_article_id(url)}.json"
        }
    except Exception as e:
        print(f"❌ [Save] Error: {e}")
        return {'status': 'error', 'error': str(e)}


def mark_worthless(url: str, reason: str) -> dict:
    """
    Mark an article as worthless (unified for auto/manual).
    Saves to DB as REJECTED so it appears in Publisher.
    """
    db = get_db()
    # Update history
    db.save_history(url, HistoryStatus.WORTHLESS, reason=reason)
    
    # Load content from cache to save to DB
    from src.core.article_state import ArticleState
    cached = load_from_cache(url)
    
    if cached:
        # Save cache update
        save_to_cache(url, {**cached, 'status': 'worthless', 'reason': reason})
        
        # Determine source_id
        source_id = cached.get('source_id', 'unknown')
        
        # Construct DB Article
        article_id = get_article_id(url)
        now = datetime.now(timezone.utc).isoformat()
        
        article_data = {
            '_header': {
                'version': '1.0',
                'article_id': article_id,
                'state': ArticleState.REJECTED.value,
                'created_at': now,
                'updated_at': now,
                'state_history': [
                    {'state': ArticleState.REJECTED.value, 'at': now, 'by': 'pipeline', 'reason': reason}
                ]
            },
            '_original': {
                'url': url,
                'title': cached.get('title', ''),
                'text': cached.get('text', ''),
                'image': cached.get('image'),
                'source_id': source_id,
                'crawled_at': cached.get('crawled_at', now)
            },
            '_analysis': {
                'reason': reason,
                'status': 'worthless',
                # Keep scores if available
                'zero_echo_score': cached.get('zero_echo_score', 0),
                'impact_score': cached.get('impact_score', 0)
            },
            '_classification': None,
            '_publication': None
        }
        
        # Save to Firestore
        try:
            # Reusing save_crawled_article might be possible if we massage the data, 
            # but article_data here is already formatted V2.
            # FirestoreClient has .save_article(id, data) for direct saving.
            db.save_article(article_id, article_data)
            print(f"🚫 [Worthless] Saved as REJECTED: {url[:50]}... ({reason})")
        except Exception as e:
            print(f"❌ [Worthless] Failed to save DB: {e}")

    else:
        print(f"🚫 [Worthless] Marked (No Cache): {url[:50]}... ({reason})")
        
    return {'status': 'worthless', 'reason': reason}


def mark_skipped(url: str, reason: str) -> dict:
    """
    Mark an article as skipped (unified for auto/manual).
    
    Args:
        url: Article URL
        reason: Reason for skipping
    
    Returns:
        Result dict
    """
    db = get_db()
    db.save_history(url, HistoryStatus.SKIPPED, reason=reason)
    print(f"⏭️ [Skip] Marked: {url[:50]}... ({reason})")
    return {'status': 'skipped', 'reason': reason}


def mark_mll_failed(url: str, reason: str = 'no_response') -> dict:
    """
    Mark an article as MLL failed (unified for auto/manual).
    
    Args:
        url: Article URL
        reason: Reason for MLL failure
    
    Returns:
        Result dict
    """
    db = get_db()
    db.save_history(url, HistoryStatus.MLL_FAILED, reason=reason)
    
    # Update cache with mll_status
    cached = load_from_cache(url)
    if cached:
        save_to_cache(url, {**cached, 'mll_status': reason})
    
    print(f"⚠️ [MLL Failed] Marked: {url[:50]}... ({reason})")
    return {'status': 'mll_failed', 'reason': reason}


# ==============================================================================
# High-Level Process Functions
# ==============================================================================

async def process_article(
    url: str, 
    source_id: str, 
    mll_client=None,
    skip_mll: bool = False
) -> dict:
    """
    Full article processing pipeline (unified for auto/manual).
    
    Steps:
    1. Check cache/history
    2. Extract content
    3. Save to cache
    4. MLL analysis (if enabled)
    5. Evaluate scores
    6. Save or reject
    
    Args:
        url: Article URL
        source_id: Source identifier
        mll_client: MLL client instance (optional)
        skip_mll: If True, skip MLL analysis (for manual mode with pre-analyzed data)
    
    Returns:
        Processing result dict
    """
    db = get_db()
    
    # 1. Check if already processed
    if db.check_history(url):
        status = db.get_history_status(url)
        print(f"⏭️ [Skip] Already processed ({status}): {url[:50]}...")
        return {'status': 'already_processed', 'history_status': status}
    
    # 2. Check cache
    cached = load_from_cache(url)
    if cached and cached.get('text'):
        print(f"📦 [Cache] Using cached content for: {url[:50]}...")
        content = cached
    else:
        # 3. Extract content
        print(f"🌐 [Extract] Fetching: {url[:50]}...")
        content = await extract_article(url)
        
        if not content:
            return mark_worthless(url, 'extraction_failed')
        
        # Check text length
        text = content.get('text', '')
        min_text_length = get_config('crawler', 'min_text_length', default=200)
        if len(text) < min_text_length:
            return mark_worthless(url, f'text_too_short ({len(text)} < {min_text_length})')
        
        # 4. Save to cache
        cache_content = {
            'url': url,
            'source_id': source_id,
            'title': content.get('title', ''),
            'text': text[:get_config('crawler', 'cache_text_length', default=5000)],
            'image': content.get('image'),
            'summary': content.get('summary'),
            'published_at': content.get('published_at'),
        }
        save_to_cache(url, cache_content)
    
    # 5. MLL Analysis (if enabled and client provided)
    if not skip_mll and mll_client:
        max_text = get_config('crawler', 'max_text_length_for_analysis', default=3000)
        truncated_text = content.get('text', '')[:max_text]
        
        # Prepare data object for ZED V0.9 Analysis
        article_data = {
            'article_id': get_article_id(url),
            'title': content.get('title', 'Unknown'),
            'text': truncated_text
        }
        
        print(f"🤖 [MLL] Analyzing (V0.9): {content.get('title', '')[:50]}...")
        try:
            mll_result = mll_client.analyze_article(article_data)
            
            if not mll_result:
                return mark_mll_failed(url, 'no_response')
            
            # Merge MLL result with content
            mll_result = normalize_field_names(mll_result)
            content.update(mll_result)
            
        except Exception as e:
            return mark_mll_failed(url, f'error: {str(e)[:50]}')


    
    # 6. Prepare final document
    final_doc = {
        **content,
        'url': url,
        'source_id': source_id,
        'article_id': get_article_id(url),
        'crawled_at': get_kst_now().isoformat(),
        'original_title': content.get('title', content.get('original_title', '')),
        'mll_status': 'analyzed',
    }
    
    # 7. Save to Firestore (로컬 캐시 저장 제거)
    db.save_crawled_article(final_doc)
    
    return {
        'status': 'analyzed',
        'article_id': get_article_id(url),
        'message': 'Analysis complete. Saved to Firestore.'
    }


async def batch_process(
    urls: list[tuple[str, str]], 
    mll_client=None,
    skip_mll: bool = False
) -> list[dict]:
    """
    Process multiple articles (for auto crawler).
    
    Args:
        urls: List of (url, source_id) tuples
        mll_client: MLL client instance
        skip_mll: Whether to skip MLL analysis
    
    Returns:
        List of processing results
    """
    results = []
    for url, source_id in urls:
        result = await process_article(url, source_id, mll_client, skip_mll)
        results.append(result)
    return results
