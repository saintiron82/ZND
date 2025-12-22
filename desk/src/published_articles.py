# -*- coding: utf-8 -*-
"""
발행된 기사 조회 유틸리티
- Firebase publications 컬렉션에서 발행된 article_ids 조회
- 캐싱을 통해 반복 조회 최소화
"""
from datetime import datetime, timezone, timedelta

# 캐시 (메모리)
_published_ids_cache = None
_published_urls_cache = None
_cache_updated_at = None
_CACHE_TTL_SECONDS = 300  # 5분 캐시


def get_db():
    """DB 클라이언트 가져오기 (지연 임포트)"""
    from src.pipeline import get_db as pipeline_get_db
    return pipeline_get_db()


def get_published_article_ids(force_refresh: bool = False) -> set:
    """
    Firebase publications 컬렉션에서 발행된 모든 article_id 조회
    
    Args:
        force_refresh: True면 캐시 무시하고 새로 조회
        
    Returns:
        set[str]: 발행된 article_id 집합
    """
    global _published_ids_cache, _cache_updated_at
    
    # 캐시 유효성 체크
    now = datetime.now(timezone.utc)
    if not force_refresh and _published_ids_cache is not None and _cache_updated_at:
        if (now - _cache_updated_at).total_seconds() < _CACHE_TTL_SECONDS:
            return _published_ids_cache
    
    db = get_db()
    if not db or not db.db:
        print("⚠️ [PublishedArticles] DB not connected")
        return _published_ids_cache or set()
    
    try:
        published_ids = set()
        
        # publications 컬렉션에서 모든 문서 조회
        docs = db.db.collection('publications').stream()
        
        for doc in docs:
            data = doc.to_dict()
            # released 상태인 것만 대상
            if data.get('status') != 'released':
                continue
                
            # article_ids 배열에서 ID 추출
            article_ids = data.get('article_ids', [])
            if article_ids:
                published_ids.update(article_ids)
            
            # 하위 호환: articles 배열에서도 ID 추출
            articles = data.get('articles', [])
            for art in articles:
                if art.get('id'):
                    published_ids.add(art['id'])
        
        _published_ids_cache = published_ids
        _cache_updated_at = now
        
        print(f"✅ [PublishedArticles] Loaded {len(published_ids)} published article IDs")
        return published_ids
        
    except Exception as e:
        print(f"❌ [PublishedArticles] Error: {e}")
        return _published_ids_cache or set()


def is_article_published(article_id: str) -> bool:
    """
    특정 기사가 이미 발행되었는지 확인
    
    Args:
        article_id: 확인할 기사 ID
        
    Returns:
        bool: 발행 여부
    """
    published_ids = get_published_article_ids()
    return article_id in published_ids


def invalidate_cache():
    """캐시 강제 무효화 (발행 후 호출)"""
    global _published_ids_cache, _published_urls_cache, _cache_updated_at
    _published_ids_cache = None
    _published_urls_cache = None
    _cache_updated_at = None
    print("🔄 [PublishedArticles] Cache invalidated")
