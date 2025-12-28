# -*- coding: utf-8 -*-
"""
DB Gateway - 데이터베이스 통신 중앙 집중화

모든 Firestore 접근의 단일 진입점
쿼리 로깅, 통계, 캐싱을 중앙에서 관리합니다.
"""
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any


class DBGateway:
    """
    DB 통신 게이트웨이 (싱글톤)
    
    모든 Firestore 조회/저장은 이 클래스를 통해야 합니다.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if DBGateway._initialized:
            return
        
        self._db = None
        self._stats = {
            'total_queries': 0,
            'total_writes': 0,
            'query_log': [],
            'initialized_at': None
        }
        
        DBGateway._initialized = True
    
    def initialize(self, db_client):
        """DB 클라이언트 설정"""
        self._db = db_client
        self._stats['initialized_at'] = datetime.now(timezone.utc).isoformat()
        print("✅ [DBGateway] Initialized")
    
    def is_ready(self) -> bool:
        """DB 사용 가능 여부"""
        return self._db is not None
    
    # =========================================================================
    # Query Operations (읽기)
    # =========================================================================
    
    def query(self, query_type: str, **kwargs) -> Any:
        """
        중앙 집중식 DB 조회
        
        Args:
            query_type: 쿼리 유형
                - articles_by_state: 상태별 기사 목록
                - edition: 특정 회차 기사
                - editions: 회차 목록
                - article: 단일 기사
            **kwargs: 쿼리별 파라미터
        
        Returns:
            쿼리 결과
        """
        start = time.time()
        result = None
        error = None
        
        try:
            if not self._db:
                print(f"⚠️ [DBGateway] No DB client for: {query_type}")
                return None
            
            result = self._execute_query(query_type, **kwargs)
            
        except Exception as e:
            error = str(e)
            print(f"❌ [DBGateway] Query failed: {query_type} - {e}")
        
        # 로깅
        elapsed = (time.time() - start) * 1000
        self._log_query('READ', query_type, kwargs, result, elapsed, error)
        
        return result
    
    def _execute_query(self, query_type: str, **kwargs) -> Any:
        """쿼리 실행 (내부용)"""
        if query_type == 'articles_by_state':
            state = kwargs.get('state')
            limit = kwargs.get('limit', 100)
            return self._db.list_articles_by_state(state, limit=limit)
        
        elif query_type == 'edition':
            edition_code = kwargs.get('edition_code')
            if hasattr(self._db, 'get_edition_articles'):
                return self._db.get_edition_articles(edition_code)
            return []
        
        elif query_type == 'editions':
            limit = kwargs.get('limit', 20)
            if hasattr(self._db, 'get_editions'):
                return self._db.get_editions(limit=limit)
            return []
        
        elif query_type == 'article':
            article_id = kwargs.get('article_id')
            if hasattr(self._db, 'get_article'):
                return self._db.get_article(article_id)
            return None
        
        else:
            print(f"⚠️ [DBGateway] Unknown query type: {query_type}")
            return None
    
    # =========================================================================
    # Write Operations (쓰기)
    # =========================================================================
    
    def write(self, write_type: str, **kwargs) -> bool:
        """
        중앙 집중식 DB 쓰기
        
        Args:
            write_type: 쓰기 유형
                - update_article: 기사 업데이트
                - save_article: 기사 저장
                - publish: 발행 처리
            **kwargs: 쓰기별 파라미터
        
        Returns:
            성공 여부
        """
        start = time.time()
        success = False
        error = None
        
        try:
            if not self._db:
                print(f"⚠️ [DBGateway] No DB client for: {write_type}")
                return False
            
            success = self._execute_write(write_type, **kwargs)
            
        except Exception as e:
            error = str(e)
            print(f"❌ [DBGateway] Write failed: {write_type} - {e}")
        
        # 로깅
        elapsed = (time.time() - start) * 1000
        self._log_query('WRITE', write_type, kwargs, success, elapsed, error)
        
        return success
    
    def _execute_write(self, write_type: str, **kwargs) -> bool:
        """쓰기 실행 (내부용)"""
        if write_type == 'update_article':
            article_id = kwargs.get('article_id')
            updates = kwargs.get('updates', {})
            self._db.update_article(article_id, updates)
            return True
        
        elif write_type == 'save_article':
            article_id = kwargs.get('article_id')
            data = kwargs.get('data', {})
            self._db.save_article(article_id, data)
            return True
        
        else:
            print(f"⚠️ [DBGateway] Unknown write type: {write_type}")
            return False
    
    # =========================================================================
    # Logging & Stats
    # =========================================================================
    
    def _log_query(self, operation: str, query_type: str, params: Dict, 
                   result: Any, elapsed_ms: float, error: Optional[str] = None):
        """쿼리 로깅"""
        result_count = 0
        if isinstance(result, list):
            result_count = len(result)
        elif isinstance(result, bool):
            result_count = 1 if result else 0
        elif result is not None:
            result_count = 1
        
        # 콘솔 로그
        status = "✅" if error is None else "❌"
        print(f"📡 [DBGateway] {status} {operation} | {query_type} | {result_count} results | {elapsed_ms:.1f}ms")
        
        # 통계 업데이트
        if operation == 'READ':
            self._stats['total_queries'] += 1
        else:
            self._stats['total_writes'] += 1
        
        # 로그 기록 (최근 100개만 유지)
        log_entry = {
            'operation': operation,
            'type': query_type,
            'params': str(params)[:200],  # 너무 길면 자름
            'count': result_count,
            'elapsed_ms': round(elapsed_ms, 1),
            'error': error,
            'at': datetime.now(timezone.utc).isoformat()
        }
        
        self._stats['query_log'].append(log_entry)
        if len(self._stats['query_log']) > 100:
            self._stats['query_log'] = self._stats['query_log'][-100:]
    
    def get_stats(self) -> Dict[str, Any]:
        """통계 반환"""
        return {
            'total_queries': self._stats['total_queries'],
            'total_writes': self._stats['total_writes'],
            'initialized_at': self._stats['initialized_at'],
            'recent_queries': self._stats['query_log'][-10:]  # 최근 10개
        }
    
    def get_full_log(self) -> List[Dict]:
        """전체 쿼리 로그 반환"""
        return self._stats['query_log']
    
    def reset_stats(self):
        """통계 리셋"""
        self._stats['total_queries'] = 0
        self._stats['total_writes'] = 0
        self._stats['query_log'] = []
        print("🔄 [DBGateway] Stats reset")


# =========================================================================
# Module-level Convenience Functions
# =========================================================================

def get_db_gateway() -> DBGateway:
    """DBGateway 인스턴스 반환"""
    return DBGateway()


def init_db_gateway(db_client) -> DBGateway:
    """DBGateway 초기화"""
    gateway = get_db_gateway()
    gateway.initialize(db_client)
    return gateway
