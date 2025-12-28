# -*- coding: utf-8 -*-
"""
Article Registry - 중앙 기사 정보 시스템
모든 기사 메타데이터의 SSOT (Single Source of Truth)

서버 시작 시 로컬 캐시와 Firestore에서 기사를 로드하여
인메모리 색인을 구축하고, 모든 상태 변경을 중앙에서 관리합니다.
"""
import os
import glob
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Any
from enum import Enum

from .db_gateway import get_db_gateway, init_db_gateway


@dataclass
class ArticleInfo:
    """기사 메타데이터 (경량화된 인덱스용)"""
    article_id: str
    url: str
    state: str
    title: str
    source_id: str
    created_at: str
    updated_at: str
    # 점수 정보 (조회/정렬용)
    impact_score: float = 0.0
    zero_echo_score: float = 0.0
    # 분류 정보
    category: str = ""
    # 원본 데이터 경로 (상세 조회 시 사용)
    cache_path: Optional[str] = None
    firestore_synced: bool = False
    # 발행 정보
    edition_code: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ArticleRegistry:
    """
    중앙 기사 레지스트리 (싱글톤)
    
    모든 기사 조회/변경은 이 클래스를 통해 수행합니다.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if ArticleRegistry._initialized:
            return
        
        # 인덱스 구조
        self._articles: Dict[str, ArticleInfo] = {}  # article_id -> ArticleInfo
        self._by_state: Dict[str, Set[str]] = {}     # state -> Set[article_id]
        self._by_url: Dict[str, str] = {}            # url_hash -> article_id
        self._by_edition: Dict[str, Set[str]] = {}   # edition_code -> Set[article_id]
        
        # 설정
        self._max_age_days = int(os.getenv('REGISTRY_MAX_AGE_DAYS', 7))
        self._cache_root = None
        self._db = None
        self._gateway = None  # DB Gateway
        
        # 통계
        self._stats = {
            'local_loaded': 0,
            'firestore_loaded': 0,
            'duplicates_merged': 0,
            'initialized_at': None
        }
    
    # =========================================================================
    # Initialization
    # =========================================================================
    
    def initialize(self, cache_root: str = None, db_client = None):
        """
        레지스트리 초기화 - 서버 시작 시 한 번 호출
        
        Args:
            cache_root: 로컬 캐시 루트 경로
            db_client: FirestoreClient 인스턴스
        """
        if ArticleRegistry._initialized:
            print("⚠️ [Registry] Already initialized, skipping.")
            return
        
        print("🚀 [Registry] Initializing Article Registry...")
        start_time = datetime.now()
        
        # 경로 설정
        if cache_root:
            self._cache_root = cache_root
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self._cache_root = os.path.join(base_dir, 'cache')
        
        self._db = db_client
        
        # DB Gateway 초기화
        if db_client:
            self._gateway = init_db_gateway(db_client)
        
        # 1. 로컬 캐시 로드 (크롤링 원본 백업용)
        self._load_from_local_cache()
        
        # 2. Firestore에서 미발행 기사 동기화 (필수)
        # - 미발행 기사는 서버와 항상 동기화되어야 함
        # - REGISTRY_SKIP_FIRESTORE=true 로 강제 비활성화 가능 (개발/테스트용)
        skip_firestore = os.getenv('REGISTRY_SKIP_FIRESTORE', 'false').lower() == 'true'
        
        if self._db and not skip_firestore:
            self._load_from_firestore()
        
        # 완료
        elapsed = (datetime.now() - start_time).total_seconds()
        self._stats['initialized_at'] = datetime.now(timezone.utc).isoformat()
        
        ArticleRegistry._initialized = True
        
        print(f"✅ [Registry] Initialized in {elapsed:.2f}s")
        print(f"   📂 Local: {self._stats['local_loaded']} articles")
        print(f"   ☁️ Firestore: {self._stats['firestore_loaded']} articles")
        print(f"   🔄 Merged Duplicates: {self._stats['duplicates_merged']}")
        print(f"   📊 Total: {len(self._articles)} unique articles")
    
    def _load_from_local_cache(self):
        """로컬 캐시에서 기사 로드 (시간 제한 적용)"""
        if not os.path.exists(self._cache_root):
            print(f"⚠️ [Registry] Cache root not found: {self._cache_root}")
            return
        
        cutoff_date = datetime.now() - timedelta(days=self._max_age_days)
        cutoff_str = cutoff_date.strftime('%Y-%m-%d')
        
        # 날짜별 폴더 순회
        date_folders = glob.glob(os.path.join(self._cache_root, '*'))
        
        for folder in sorted(date_folders, reverse=True):  # 최신순
            folder_name = os.path.basename(folder)
            
            # 날짜 형식 체크 및 시간 제한 적용
            if folder_name < cutoff_str:
                print(f"   ⏭️ [Registry] Skipping old folder: {folder_name}")
                continue
            
            # 폴더 내 JSON 파일 로드
            json_files = glob.glob(os.path.join(folder, '*.json'))
            
            for fpath in json_files:
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    info = self._parse_article_data(data, cache_path=fpath)
                    if info:
                        self._register_article(info, source='local')
                        self._stats['local_loaded'] += 1
                        
                except Exception as e:
                    print(f"⚠️ [Registry] Error loading {fpath}: {e}")
    
    def _load_from_firestore(self):
        """Firestore에서 미발행 기사만 로드 (PUBLISHED는 Lazy Load)"""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=self._max_age_days)
        cutoff_iso = cutoff_date.isoformat()
        
        # 미발행 상태만 로드 (PUBLISHED는 요청 시 Lazy Load)
        states_to_load = ['COLLECTED', 'ANALYZED', 'CLASSIFIED', 'REJECTED']
        print(f"   📡 [Registry] Loading unpublished from Firestore: {states_to_load}")
        
        for state in states_to_load:
            try:
                # DB Gateway를 통한 조회 (로깅 포함)
                articles = self._gateway.query('articles_by_state', state=state, limit=500) or []
                
                for data in articles:
                    # 시간 체크
                    created_at = data.get('_header', {}).get('created_at', '')
                    if created_at and created_at < cutoff_iso:
                        continue  # 오래된 기사 스킵
                    
                    info = self._parse_article_data(data)
                    if info:
                        existing = self._articles.get(info.article_id)
                        if existing:
                            # 이미 로컬에서 로드됨 - Firestore 상태로 갱신
                            existing.firestore_synced = True
                            
                            # REJECTED는 최우선 적용 (폐기된 기사는 복구 불가)
                            if info.state == 'REJECTED' and existing.state != 'REJECTED':
                                self._update_article_state(existing, 'REJECTED')
                                print(f"   ⚠️ [Registry] Synced REJECTED: {info.article_id}")
                            # Firestore 상태가 더 진행된 경우 적용
                            elif self._is_more_advanced_state(info.state, existing.state):
                                self._update_article_state(existing, info.state)
                                print(f"   🔄 [Registry] Synced state: {info.article_id} ({existing.state} → {info.state})")
                            
                            self._stats['duplicates_merged'] += 1
                        else:
                            info.firestore_synced = True
                            self._register_article(info, source='firestore')
                            self._stats['firestore_loaded'] += 1
                            
            except Exception as e:
                print(f"⚠️ [Registry] Firestore load error for {state}: {e}")
    
    def _parse_article_data(self, data: Dict, cache_path: str = None) -> Optional[ArticleInfo]:
        """원시 데이터를 ArticleInfo로 변환"""
        try:
            # V2 Schema (with _header)
            if '_header' in data:
                header = data['_header']
                original = data.get('_original', {})
                analysis = data.get('_analysis', {}) or {}
                classification = data.get('_classification', {}) or {}
                
                # Extract edition_code from various possible locations
                edition_code = (
                    header.get('edition_code', '') or
                    data.get('edition_code', '') or
                    classification.get('edition_code', '')
                )
                
                return ArticleInfo(
                    article_id=header.get('article_id', ''),
                    url=original.get('url', ''),
                    state=header.get('state', 'UNKNOWN'),
                    title=original.get('title', '') or analysis.get('title_ko', ''),
                    source_id=original.get('source_id', 'unknown'),
                    created_at=header.get('created_at', ''),
                    updated_at=header.get('updated_at', ''),
                    impact_score=float(analysis.get('impact_score', 0) or 0),
                    zero_echo_score=float(analysis.get('zero_echo_score', 0) or 0),
                    category=classification.get('category', ''),
                    cache_path=cache_path,
                    firestore_synced=False,
                    edition_code=edition_code
                )
            
            # V1 Schema (Legacy flat structure)
            else:
                return ArticleInfo(
                    article_id=data.get('article_id', ''),
                    url=data.get('url', ''),
                    state=data.get('state', 'COLLECTED'),
                    title=data.get('title_ko', '') or data.get('title', ''),
                    source_id=data.get('source_id', 'unknown'),
                    created_at=data.get('crawled_at', ''),
                    updated_at=data.get('crawled_at', ''),
                    impact_score=float(data.get('impact_score', 0) or 0),
                    zero_echo_score=float(data.get('zero_echo_score', 0) or 0),
                    category=data.get('category', ''),
                    cache_path=cache_path,
                    firestore_synced=False,
                    edition_code=data.get('edition_code', '')
                )
        except Exception as e:
            print(f"⚠️ [Registry] Parse error: {e}")
            return None
    
    def _register_article(self, info: ArticleInfo, source: str = 'unknown'):
        """기사를 인덱스에 등록"""
        if not info.article_id:
            return
        
        # 메인 인덱스
        self._articles[info.article_id] = info
        
        # 상태별 인덱스
        if info.state not in self._by_state:
            self._by_state[info.state] = set()
        self._by_state[info.state].add(info.article_id)
        
        # URL 인덱스
        if info.url:
            url_hash = self._url_to_hash(info.url)
            self._by_url[url_hash] = info.article_id
        
        # 회차 인덱스
        if info.edition_code:
            if info.edition_code not in self._by_edition:
                self._by_edition[info.edition_code] = set()
            self._by_edition[info.edition_code].add(info.article_id)
    
    def _url_to_hash(self, url: str) -> str:
        """URL을 해시로 변환"""
        import hashlib
        return hashlib.md5(url.encode()).hexdigest()[:12]
    
    def _is_more_advanced_state(self, new_state: str, current_state: str) -> bool:
        """새 상태가 현재 상태보다 더 진행된 상태인지 확인"""
        # 상태 진행 순서 (높을수록 더 진행됨)
        state_order = {
            'COLLECTED': 1,
            'ANALYZED': 2,
            'CLASSIFIED': 3,
            'PUBLISHED': 4,
            'REJECTED': 0  # REJECTED는 별도 처리 (최우선)
        }
        return state_order.get(new_state, 0) > state_order.get(current_state, 0)
    
    def _update_article_state(self, info: ArticleInfo, new_state: str):
        """기사 상태 인덱스 업데이트 (내부용)"""
        old_state = info.state
        
        # 이전 상태 인덱스에서 제거
        if old_state in self._by_state:
            self._by_state[old_state].discard(info.article_id)
        
        # 새 상태 설정
        info.state = new_state
        
        # 새 상태 인덱스에 추가
        if new_state not in self._by_state:
            self._by_state[new_state] = set()
        self._by_state[new_state].add(info.article_id)
    
    # =========================================================================
    # Query Operations
    # =========================================================================
    
    def get(self, article_id: str) -> Optional[ArticleInfo]:
        """기사 조회 (ID로)"""
        return self._articles.get(article_id)

    def find_and_register(self, article_id: str) -> Optional[ArticleInfo]:
        """
        [Lazy Load] Registry에 없는 기사를 디스크(cache)에서 찾아 등록.
        (초기화되지 않았거나 아직 로드되지 않은 경우 대비)
        """
        import glob
        import json
        import os
        
        # Cache Root 찾기 (미초기화 대비)
        if self._cache_root:
            cache_root = self._cache_root
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            cache_root = os.path.join(base_dir, 'cache')
            
        if not os.path.exists(cache_root):
            return None
            
        # Recursive Search
        # [Fix] 파일명 패턴 유연화 (source_id 유무 상관없이 매칭)
        # 기존: *_{article_id}.json -> 수정: *{article_id}.json
        pattern = f"*{article_id}.json"
        search_pattern = os.path.join(cache_root, "**", pattern)
        files = glob.glob(search_pattern, recursive=True)
        
        if not files:
            return None
            
        target_file = files[0]
        
        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            info = self._parse_article_data(data, cache_path=target_file)
            if info:
                self._register_article(info, source='lazy_disk')
                print(f"📦 [Registry] Lazy loaded: {article_id} from {target_file}")
                return info
        except Exception as e:
            print(f"⚠️ [Registry] Lazy load failed for {article_id}: {e}")
            
        return None
    
    def get_by_url(self, url: str) -> Optional[ArticleInfo]:
        """기사 조회 (URL로)"""
        url_hash = self._url_to_hash(url)
        article_id = self._by_url.get(url_hash)
        if article_id:
            return self._articles.get(article_id)
        return None
    
    def find_by_state(self, state: str, limit: int = 100) -> List[ArticleInfo]:
        """상태별 기사 목록 조회"""
        article_ids = self._by_state.get(state, set())
        
        # 최신순 정렬
        articles = [self._articles[aid] for aid in article_ids if aid in self._articles]
        articles.sort(key=lambda x: x.updated_at or '', reverse=True)
        
        return articles[:limit]
    
    def find_by_states(self, states: List[str], limit: int = 100) -> List[ArticleInfo]:
        """여러 상태의 기사 목록 조회"""
        all_articles = []
        for state in states:
            all_articles.extend(self.find_by_state(state, limit))
        
        # 중복 제거 및 정렬
        seen = set()
        unique = []
        for a in all_articles:
            if a.article_id not in seen:
                seen.add(a.article_id)
                unique.append(a)
        
        unique.sort(key=lambda x: x.updated_at or '', reverse=True)
        return unique[:limit]
    
    def get_all(self, limit: int = 500) -> List[ArticleInfo]:
        """전체 기사 목록"""
        articles = list(self._articles.values())
        articles.sort(key=lambda x: x.updated_at or '', reverse=True)
        return articles[:limit]
    
    def count(self) -> int:
        """전체 기사 수"""
        return len(self._articles)
    
    def count_by_state(self, state: str) -> int:
        """상태별 기사 수"""
        return len(self._by_state.get(state, set()))
    
    def get_by_edition(self, edition_code: str) -> List[ArticleInfo]:
        """회차별 기사 목록 조회"""
        article_ids = self._by_edition.get(edition_code, set())
        articles = [self._articles[aid] for aid in article_ids if aid in self._articles]
        articles.sort(key=lambda x: x.updated_at or '', reverse=True)
        return articles
    
    def get_stats(self) -> Dict[str, Any]:
        """레지스트리 통계"""
        return {
            **self._stats,
            'total_articles': len(self._articles),
            'by_state': {state: len(ids) for state, ids in self._by_state.items()}
        }
    
    # =========================================================================
    # Write Operations
    # =========================================================================
    
    def register(self, data: Dict[str, Any], cache_path: str = None) -> Optional[ArticleInfo]:
        """새 기사 등록 (크롤링/분석 완료 시)"""
        info = self._parse_article_data(data, cache_path)
        if info:
            self._register_article(info, source='new')
            return info
        return None
    
    def update_state(self, article_id: str, new_state: str, by: str = 'system') -> bool:
        """
        기사 상태 변경 (레지스트리 + 저장소 동시 업데이트)
        
        Args:
            article_id: 기사 ID
            new_state: 새 상태
            by: 변경 주체
            
        Returns:
            성공 여부
        """
        info = self._articles.get(article_id)
        if not info:
            print(f"⚠️ [Registry] Article not found: {article_id}")
            return False
        
        old_state = info.state
        now = datetime.now(timezone.utc).isoformat()
        
        # 1. 레지스트리 업데이트
        # 이전 상태 인덱스에서 제거
        if old_state in self._by_state:
            self._by_state[old_state].discard(article_id)
        
        # 새 상태 설정
        info.state = new_state
        info.updated_at = now
        
        # 새 상태 인덱스에 추가
        if new_state not in self._by_state:
            self._by_state[new_state] = set()
        self._by_state[new_state].add(article_id)
        
        # 2. Firestore 업데이트 (로컬 캐시 쓰기 제거)
        firestore_success = self._update_firestore(article_id, new_state, by, now)
        
        if firestore_success:
            print(f"✅ [Registry] State changed: {article_id} ({old_state} → {new_state})")
            return True
        else:
            # 롤백
            info.state = old_state
            if old_state not in self._by_state:
                self._by_state[old_state] = set()
            self._by_state[old_state].add(article_id)
            self._by_state[new_state].discard(article_id)
            print(f"❌ [Registry] State change failed, rolled back: {article_id}")
            return False
    
    def _update_local_cache(self, article_id: str, new_state: str, by: str, timestamp: str) -> bool:
        """로컬 캐시 파일 업데이트"""
        info = self._articles.get(article_id)
        if not info or not info.cache_path:
            return False
        
        try:
            if os.path.exists(info.cache_path):
                with open(info.cache_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # V2 Schema 업데이트
                if '_header' in data:
                    data['_header']['state'] = new_state
                    data['_header']['updated_at'] = timestamp
                    
                    # state_history 추가
                    if 'state_history' not in data['_header']:
                        data['_header']['state_history'] = []
                    data['_header']['state_history'].append({
                        'state': new_state,
                        'at': timestamp,
                        'by': by
                    })
                else:
                    # V1 Schema
                    data['state'] = new_state
                    data['updated_at'] = timestamp
                
                with open(info.cache_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                return True
        except Exception as e:
            print(f"⚠️ [Registry] Local cache update failed: {e}")
        
        return False
    
    def _update_firestore(self, article_id: str, new_state: str, by: str, timestamp: str) -> bool:
        """Firestore 업데이트"""
        if not self._db:
            return False
        
        try:
            updates = {
                '_header.state': new_state,
                '_header.updated_at': timestamp
            }
            self._db.update_article(article_id, updates)
            return True
        except Exception as e:
            print(f"⚠️ [Registry] Firestore update failed: {e}")
            return False
    
    # =========================================================================
    # Utility
    # =========================================================================
    
    def is_initialized(self) -> bool:
        """초기화 여부"""
        return ArticleRegistry._initialized
    
    def reset(self):
        """레지스트리 리셋 (테스트용)"""
        self._articles.clear()
        self._by_state.clear()
        self._by_url.clear()
        ArticleRegistry._initialized = False
        print("🔄 [Registry] Reset completed.")


# =========================================================================
# Module-level Convenience Functions
# =========================================================================

def get_registry() -> ArticleRegistry:
    """레지스트리 인스턴스 반환"""
    return ArticleRegistry()


def init_registry(cache_root: str = None, db_client = None):
    """레지스트리 초기화 (서버 시작 시 호출)"""
    registry = get_registry()
    registry.initialize(cache_root, db_client)
    return registry
