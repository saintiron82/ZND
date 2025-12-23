# -*- coding: utf-8 -*-
"""
Crawler Extractor - 콘텐츠 추출 모듈
AsyncCrawler를 사용한 본문 추출 및 캐시 저장
"""
import os
import sys
import time
import asyncio

# Path setup - must be done before imports
CORE_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLER_DIR = os.path.dirname(CORE_DIR)
ZND_ROOT = os.path.dirname(CRAWLER_DIR)
DESK_DIR = os.path.join(ZND_ROOT, 'desk')

# Add to sys.path
if CRAWLER_DIR not in sys.path:
    sys.path.insert(0, CRAWLER_DIR)
if DESK_DIR not in sys.path:
    sys.path.insert(0, DESK_DIR)

from core.logger import log_crawl_event
from core.collector import collect_links
from src.db_client import DBClient
from src.crawler.core import AsyncCrawler
from src.core_logic import (
    load_from_cache as _core_load_from_cache,
    save_to_cache as _core_save_to_cache
)


def load_from_cache(url):
    return _core_load_from_cache(url)

def save_to_cache(url, content):
    return _core_save_to_cache(url, content)


def extract_content(links: list = None) -> dict:
    """
    수집된 링크에서 콘텐츠를 추출합니다.
    links가 없으면 자동으로 collect_links() 호출
    
    Returns:
        dict: {success: bool, extracted: int, skipped: int, failed: int}
    """
    start_time = time.time()
    db = DBClient()  # 히스토리 저장용
    
    # 링크가 없으면 자동 수집
    if not links:
        result = collect_links()
        if not result['success']:
            return result
        links = result['links']
    
    extracted_count = 0
    skipped_count = 0
    failed_count = 0
    
    async def extract_all():
        nonlocal extracted_count, skipped_count, failed_count
        crawler = AsyncCrawler(use_playwright=True)
        try:
            await crawler.start()
            for item in links:
                url = item['url'] if isinstance(item, dict) else item
                source_id = item.get('source_id', 'unknown') if isinstance(item, dict) else 'unknown'
                
                # 캐시 체크
                cached = load_from_cache(url)
                if cached and cached.get('text'):
                    skipped_count += 1
                    continue
                
                try:
                    content = await crawler.process_url(url)
                    if content and len(content.get('text', '')) >= 200:
                        content['source_id'] = source_id
                        save_to_cache(url, content)
                        extracted_count += 1
                    else:
                        # 추출 실패 - 히스토리에 EXTRACT_FAILED 저장 (24시간 후 재시도 가능)
                        db.save_history(url, 'EXTRACT_FAILED', reason='short_content')
                        print(f"⚠️ [Extract] Failed (short content): {url[:50]}...")
                        failed_count += 1
                except Exception as e:
                    # 추출 예외 - 히스토리에 EXTRACT_FAILED 저장
                    db.save_history(url, 'EXTRACT_FAILED', reason=str(e)[:100])
                    print(f"⚠️ [Extract] Failed: {url[:50]}... - {e}")
                    failed_count += 1
        finally:
            await crawler.close()
    
    try:
        asyncio.run(extract_all())
        
        duration = time.time() - start_time
        msg = f"Extracted {extracted_count} (Skip:{skipped_count}, Fail:{failed_count})"
        log_crawl_event("Extract", msg, duration, success=True)
        
        print(f"📥 [Extract] 추출: {extracted_count}, 스킵: {skipped_count}, 실패: {failed_count}")
        return {
            'success': True,
            'extracted': extracted_count,
            'skipped': skipped_count,
            'failed': failed_count,
            'message': msg
        }
        
    except Exception as e:
        duration = time.time() - start_time
        log_crawl_event("Extract", f"Error: {str(e)}", duration, success=False)
        print(f"❌ [Extract] Error: {e}")
        return {'success': False, 'error': str(e)}


def run_full_pipeline():
    """
    전체 파이프라인 실행: Collect -> Extract
    스케줄러에서 호출용
    """
    print("🚀 [Pipeline] Starting full crawl pipeline...")
    
    # 1. Collect
    collect_result = collect_links()
    if not collect_result['success'] or collect_result['total'] == 0:
        print(f"📭 [Pipeline] No new links to process")
        return collect_result
    
    # 2. Extract
    extract_result = extract_content(collect_result['links'])
    
    return extract_result
