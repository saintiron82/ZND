# -*- coding: utf-8 -*-
"""
ZND 자동 크롤링 스케줄러
- 수집 → 추출 → 캐시 저장 (MLL 분석 스킵)
- index.json 자동 갱신
- 스케줄: 06:30, 12:30, 18:30, 00:30 (하루 4회)
"""
import os
import sys
import asyncio
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# Import core modules
from crawler import load_targets, fetch_links
from src.db_client import DBClient
from src.crawler.core import AsyncCrawler
from src.core_logic import (
    load_from_cache,
    save_to_cache,
    update_manifest,
)

# Discord 알림 모듈
import sys
sys.path.insert(0, os.path.join(BASE_DIR, '..', 'crawler'))
try:
    from core.discord_notifier import send_crawl_notification
    DISCORD_ENABLED = True
except ImportError:
    DISCORD_ENABLED = False
    print("⚠️ Discord notifier not available")


def serialize_datetime(obj):
    """datetime 객체를 ISO 문자열로 변환"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def sanitize_content(content: dict) -> dict:
    """datetime 객체를 JSON 직렬화 가능한 형태로 변환"""
    sanitized = {}
    for key, value in content.items():
        if isinstance(value, datetime):
            sanitized[key] = value.isoformat()
        elif isinstance(value, dict):
            sanitized[key] = sanitize_content(value)
        elif isinstance(value, list):
            sanitized[key] = [
                v.isoformat() if isinstance(v, datetime) else v
                for v in value
            ]
        else:
            sanitized[key] = value
    return sanitized


def log(msg: str):
    """타임스탬프 포함 로그 출력"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {msg}")


async def run_auto_crawl():
    """
    자동 크롤링 메인 함수
    1. 모든 타겟에서 새 링크 수집
    2. 콘텐츠 추출 및 캐시 저장
    3. index.json 갱신
    """
    log("🚀 자동 크롤링 시작")
    
    db = DBClient()
    targets = load_targets()
    
    collected_count = 0
    extracted_count = 0
    skipped_count = 0
    failed_count = 0
    
    # 1. 링크 수집
    log("📡 [1단계] 링크 수집 중...")
    all_links = []
    
    for target in targets:
        links = fetch_links(target)
        limit = target.get('limit', 5)
        links = links[:limit]
        
        for link in links:
            # 히스토리 체크 (이미 처리된 것 제외)
            if not db.check_history(link):
                all_links.append({
                    'url': link,
                    'source_id': target['id']
                })
    
    # 중복 제거
    seen = set()
    unique_links = []
    for item in all_links:
        if item['url'] not in seen:
            seen.add(item['url'])
            unique_links.append(item)
    
    collected_count = len(unique_links)
    log(f"📡 수집 완료: {collected_count}개 새 링크")
    
    if collected_count == 0:
        log("✨ 새로운 링크가 없습니다")
        return
    
    # 2. 콘텐츠 추출
    log("📥 [2단계] 콘텐츠 추출 중...")
    
    crawler = AsyncCrawler(use_playwright=True)
    try:
        await crawler.start()
        
        for item in unique_links:
            url = item['url']
            source_id = item['source_id']
            
            # 캐시 체크
            cached = load_from_cache(url)
            if cached and cached.get('text'):
                skipped_count += 1
                continue
            
            try:
                content = await crawler.process_url(url)
                if content and len(content.get('text', '')) >= 200:
                    content['source_id'] = source_id
                    content['status'] = 'RAW'  # [MODIFIED] 명시적 상태: 원문 수집 완료
                    # datetime 객체를 문자열로 변환
                    content = sanitize_content(content)
                    save_to_cache(url, content)
                    extracted_count += 1
                    log(f"  ✅ 추출: {url[:50]}...")
                else:
                    failed_count += 1
                    log(f"  ⚠️ 콘텐츠 부족: {url[:50]}...")
            except Exception as e:
                failed_count += 1
                log(f"  ❌ 실패: {url[:50]}... - {e}")
                
    finally:
        await crawler.close()
    
    log(f"📥 추출 완료: 성공 {extracted_count}, 스킵 {skipped_count}, 실패 {failed_count}")
    
    # 3. index.json 갱신
    log("📋 [3단계] index.json 갱신 중...")
    today_str = datetime.now().strftime('%Y-%m-%d')
    update_manifest(today_str)
    log(f"📋 index.json 갱신 완료: {today_str}")
    
    # 완료 요약
    log("=" * 50)
    log(f"🎉 자동 크롤링 완료!")
    log(f"   - 수집: {collected_count}개")
    log(f"   - 추출: {extracted_count}개")
    log(f"   - 스킵: {skipped_count}개")
    log(f"   - 실패: {failed_count}개")
    log("=" * 50)
    
    # 4. Discord 알림 전송
    if DISCORD_ENABLED:
        log("📨 [4단계] Discord 알림 전송 중...")
        result = {
            'success': failed_count == 0 or extracted_count > 0,
            'collected': collected_count,
            'extracted': extracted_count,
            'analyzed': 0,  # 자동 크롤링은 MLL 분석 스킵
            'cached': extracted_count,
            'failed': failed_count,
            'message': f'스킵: {skipped_count}개 (이미 캐시됨)'
        }
        send_crawl_notification(result, "자동 크롤링")
        log("📨 Discord 알림 전송 완료")


def main():
    """엔트리 포인트"""
    try:
        asyncio.run(run_auto_crawl())
    except KeyboardInterrupt:
        log("⚠️ 사용자에 의해 중단됨")
    except Exception as e:
        log(f"❌ 오류 발생: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
