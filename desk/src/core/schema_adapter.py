# -*- coding: utf-8 -*-
"""
Schema Adapter - 버전별 스키마 해석기

각 버전의 데이터 구조를 통일된 인터페이스로 접근할 수 있게 해줍니다.
"""
from typing import Dict, Any, Optional
import hashlib


class SchemaAdapter:
    """
    버전별 스키마 해석기 (Lazy Migration 지원)
    
    Usage:
        adapter = SchemaAdapter(article_data)
        article_id = adapter.article_id
        url = adapter.url
        source_id = adapter.source_id
        
        # 자동 업그레이드
        if adapter.needs_upgrade:
            upgraded_data = adapter.upgrade_to_latest()
    """
    
    LATEST_VERSION = '3.1'
    
    def __init__(self, data: Dict[str, Any], auto_upgrade: bool = False):
        self._data = data
        self._header = data.get('_header', {})
        self._original = data.get('_original', {})
        self._analysis = data.get('_analysis') or {}
        self._classification = data.get('_classification') or {}
        self._publication = data.get('_publication') or {}
        self._rejection = data.get('_rejection') or {}
        
        # 버전 자동 감지
        self._version = self._detect_version()
        
        # 자동 업그레이드 (옵션) - 모든 내부 참조 갱신
        if auto_upgrade and self.needs_upgrade:
            self._data = self.upgrade_to_latest()
            self._header = self._data.get('_header', {})
            self._original = self._data.get('_original', {})
            self._version = self.LATEST_VERSION


    
    def _detect_version(self) -> str:
        """스키마 버전 자동 감지"""
        explicit_version = self._header.get('version', '')
        
        # 명시적 버전이 있으면 사용
        if explicit_version:
            return explicit_version
        
        # v3.1 특징: _header에 url, source_id 있음
        if 'url' in self._header and 'source_id' in self._header:
            return '3.1'
        
        # v3.0 특징: _original에 url, source_id 있음
        if 'url' in self._original:
            return '3.0'
        
        # v2.x 이하 (레거시)
        return '2.0'
    
    @property
    def version(self) -> str:
        return self._version
    
    @property
    def needs_upgrade(self) -> bool:
        """최신 버전으로 업그레이드가 필요한지 확인"""
        return self._version < self.LATEST_VERSION
    
    def upgrade_to_latest(self) -> Dict[str, Any]:
        """
        데이터를 최신 버전 스키마로 업그레이드
        
        Returns:
            업그레이드된 데이터 딕셔너리
        """
        import copy
        upgraded = copy.deepcopy(self._data)
        header = upgraded.setdefault('_header', {})
        original = upgraded.get('_original', {})
        
        # url을 _header로 이동/복사
        if 'url' not in header:
            url = original.get('url') or self._data.get('url')
            if url:
                header['url'] = url
        
        # source_id를 _header로 이동/복사
        if 'source_id' not in header:
            sid = original.get('source_id') or self._data.get('source_id')
            if sid and sid != 'unknown':
                header['source_id'] = sid
            elif header.get('url'):
                # URL에서 추출
                header['source_id'] = self._extract_source_from_url(header['url'])
        
        # article_id가 없으면 URL에서 생성
        if 'article_id' not in header:
            url = header.get('url') or original.get('url')
            if url:
                header['article_id'] = hashlib.md5(url.encode()).hexdigest()[:12]
        
        # 버전 업데이트
        header['version'] = self.LATEST_VERSION
        
        return upgraded
    
    def get_upgraded_data(self) -> Dict[str, Any]:
        """업그레이드된 데이터 반환 (이미 최신이면 원본 반환)"""
        if self.needs_upgrade:
            return self.upgrade_to_latest()
        return self._data

    
    @property
    def article_id(self) -> Optional[str]:
        """article_id 추출 (버전 무관)"""
        # 우선순위: _header > root > 생성
        aid = (
            self._header.get('article_id') or
            self._data.get('article_id') or
            self._data.get('id')
        )
        
        # 없으면 URL에서 생성
        if not aid:
            url = self.url
            if url:
                aid = hashlib.md5(url.encode()).hexdigest()[:12]
        
        return aid
    
    @property
    def url(self) -> Optional[str]:
        """URL 추출 (버전별 위치 다름)"""
        if self._version >= '3.1':
            return self._header.get('url') or self._original.get('url')
        else:
            # v3.0 이하: _original에 있음
            return self._original.get('url') or self._header.get('url')
    
    @property
    def source_id(self) -> Optional[str]:
        """source_id 추출 (모든 가능한 위치에서 검색)"""
        # 모든 가능한 위치에서 source_id 찾기 (버전 무관)
        sid = (
            self._header.get('source_id') or
            self._original.get('source_id') or
            self._data.get('source_id')
        )
        
        # unknown이거나 없으면 URL에서 추출
        if not sid or sid == 'unknown':
            url = self.url
            if url:
                sid = self._extract_source_from_url(url)
        
        return sid or 'unknown'

    
    @property
    def state(self) -> Optional[str]:
        return self._header.get('state')
    
    @property
    def title(self) -> str:
        """제목 추출 (분석 결과 우선)"""
        return (
            self._analysis.get('title_ko') or
            self._original.get('title') or
            ''
        )
    
    @property
    def summary(self) -> str:
        return self._analysis.get('summary', '')
    
    @property
    def impact_score(self) -> Optional[float]:
        return self._analysis.get('impact_score')
    
    @property
    def zero_echo_score(self) -> Optional[float]:
        return self._analysis.get('zero_echo_score')
    
    @property
    def category(self) -> Optional[str]:
        return self._classification.get('category')
    
    @property
    def rejected_reason(self) -> Optional[str]:
        return self._rejection.get('reason')
    
    @property
    def updated_at(self) -> Optional[str]:
        return self._header.get('updated_at')
    
    @property
    def created_at(self) -> Optional[str]:
        return self._header.get('created_at')
    
    @property
    def crawled_at(self) -> Optional[str]:
        return self._original.get('crawled_at')
    
    @property
    def published_at(self) -> Optional[str]:
        return self._original.get('published_at')
    
    @property
    def text(self) -> str:
        return self._original.get('text', '')
    
    @property
    def image(self) -> Optional[str]:
        return self._original.get('image')
    
    @property
    def tags(self) -> list:
        return self._analysis.get('tags', [])
    
    @property
    def mll_raw(self) -> Optional[dict]:
        return self._analysis.get('mll_raw')
    
    def _extract_source_from_url(self, url: str) -> str:
        """URL에서 source_id 추출"""
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc
            parts = domain.replace('www.', '').split('.')
            return parts[0] if parts else 'unknown'
        except:
            return 'unknown'
    
    def to_card_format(self) -> Dict[str, Any]:
        """칸반 카드용 딕셔너리 변환"""
        return {
            'article_id': self.article_id,
            'state': self.state,
            'title': self.title[:50] if self.title else '',
            'summary': self.summary,
            'source_id': self.source_id,
            'impact_score': self.impact_score,
            'zero_echo_score': self.zero_echo_score,
            'category': self.category,
            'rejected_reason': self.rejected_reason,
            'updated_at': self.updated_at
        }

    def to_publisher_format(self) -> Dict[str, Any]:
        """발행 목록용 딕셔너리 변환"""
        return {
            'article_id': self.article_id,
            'state': self.state,
            'title': self.title,
            'summary': self.summary,
            'source_id': self.source_id,
            'url': self.url,
            'impact_score': self.impact_score,
            'zero_echo_score': self.zero_echo_score,
            'tags': self.tags,
            'category': self.category,
            'rejected_reason': self.rejected_reason,
            'edition_code': self._publication.get('edition_code'),
            'published_at': self._publication.get('published_at'),
            'released_at': self._publication.get('released_at')
        }
    
    def to_flat_format(self) -> Dict[str, Any]:
        """플랫 구조 딕셔너리 변환 (UI 호환용)"""
        flat = {
            'article_id': self.article_id,
            'url': self.url,
            'source_id': self.source_id,
            'state': self.state,
            'title': self._original.get('title', ''),
            'title_ko': self._analysis.get('title_ko', ''),
            'text': self.text,
            'summary': self.summary,
            'impact_score': self.impact_score,
            'zero_echo_score': self.zero_echo_score,
            'category': self.category,
            'tags': self.tags,
            'image': self.image,
            'crawled_at': self.crawled_at,
            'published_at': self.published_at,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'version': self.version,
            # 원본 섹션들도 포함 (하위 호환)
            '_header': self._header,
            '_original': self._original,
            '_analysis': self._analysis,
            '_classification': self._classification,
            '_publication': self._publication,
            '_raw': self._data
        }
        return flat
