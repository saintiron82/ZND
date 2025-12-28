# -*- coding: utf-8 -*-
"""
Firestore Client for Article Management
Firestore 연동 클래스 - 모든 데이터의 SSOT(Single Source of Truth)
"""
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import firebase_admin
from firebase_admin import credentials, firestore


class FirestoreClient:
    """Firestore 데이터베이스 클라이언트"""
    
    _instance = None
    _usage_stats = {
        'reads': 0,
        'writes': 0,
        'deletes': 0,
        'session_start': None
    }
    
    def __new__(cls):
        """싱글톤 패턴"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self.db = self._initialize_firebase()
        self._initialized = True
        FirestoreClient._usage_stats['session_start'] = datetime.now(timezone.utc).isoformat()
    
    def _initialize_firebase(self):
        """Firebase 초기화"""
        if not firebase_admin._apps:
            # 서비스 계정 키 경로 탐색 (여러 위치 확인)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            project_root = os.path.dirname(base_dir)  # ZND 루트
            
            key_paths = [
                os.path.join(base_dir, 'zeroechodaily-serviceAccountKey.json'),
                os.path.join(base_dir, 'serviceAccountKey.json'),
                os.path.join(project_root, 'desk_arcive', 'zeroechodaily-serviceAccountKey.json'),
                os.path.join(project_root, 'zeroechodaily-serviceAccountKey.json'),
            ]
            
            key_path = None
            for path in key_paths:
                if os.path.exists(path):
                    key_path = path
                    print(f"✅ Firebase key found: {path}")
                    break
            
            if key_path:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred)
            else:
                raise FileNotFoundError(f"Firebase service account key not found. Searched: {key_paths}")
        
        return firestore.client()
    
    def get_env_name(self) -> str:
        """환경 설정 반환 (dev 또는 release)"""
        return os.getenv('ZND_ENV', 'dev')

    def _get_env(self) -> str:
        return self.get_env_name()
    
    def _get_collection(self, collection_name: str):
        """환경별 컬렉션 참조 반환"""
        env = self._get_env()
        return self.db.collection(env).document('data').collection(collection_name)
    
    # =========================================================================
    # Usage Tracking
    # =========================================================================
    
    @classmethod
    def _track_read(cls, count: int = 1):
        cls._usage_stats['reads'] += count
    
    @classmethod
    def _track_write(cls, count: int = 1):
        cls._usage_stats['writes'] += count
    
    @classmethod
    def _track_delete(cls, count: int = 1):
        cls._usage_stats['deletes'] += count
    
    @classmethod
    def get_usage_stats(cls) -> Dict[str, Any]:
        return cls._usage_stats.copy()
    
    @classmethod
    def reset_usage_stats(cls):
        cls._usage_stats = {
            'reads': 0,
            'writes': 0,
            'deletes': 0,
            'session_start': datetime.now(timezone.utc).isoformat()
        }
    
    # =========================================================================
    # Articles Collection CRUD
    # =========================================================================
    
    def get_article(self, article_id: str) -> Optional[Dict[str, Any]]:
        """기사 조회 (Local Cache 우선, 후 Firestore)"""
        
        # 1. Try Local Cache First
        try:
            import glob
            import json
            
            # Resolve Cache Path
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            cache_root = os.path.join(base_dir, 'cache')
            
            # fast search: check if we can guess the date? No, simple glob is fast enough for specific ID
            search_pattern = os.path.join(cache_root, '*', f'{article_id}.json')
            found_paths = glob.glob(search_pattern)
            
            if found_paths:
                # Use the most recently modified one if multiple (unlikely with ID)
                found_paths.sort(key=os.path.getmtime, reverse=True)
                target_path = found_paths[0]
                
                with open(target_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    print(f"📂 [FirestoreClient] Found in local cache: {article_id}")
                    return data
        except Exception as e:
            print(f"⚠️ [FirestoreClient] Local cache lookup failed: {e}")

        # 2. Fallback to Firestore
        doc_ref = self._get_collection('articles').document(article_id)
        doc = doc_ref.get()
        self._track_read()
        
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None

    def list_recent_articles(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """최근 기사 목록 조회 (중복 검사용)"""
        # Firestore Query
        query = self._get_collection('articles')\
            .order_by('_header.created_at', direction=firestore.Query.DESCENDING)\
            .limit(limit)
            
        docs = query.stream()
        # self._track_read(limit) # Stream reads count individually? No, batch approx.
        # Actually stream counts as 1 read per doc.
        
        results = []
        count = 0
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            results.append(data)
            count += 1
            
        self._track_read(count)
        return results
    
    def upsert_article_state(self, article_id: str, updates: Dict[str, Any]) -> tuple[bool, str]:
        """
        기사 상태 업데이트 (없으면 생성, 로컬 파일도 동기화 시도)
        Args:
            article_id: 문서 ID
            updates: 업데이트할 필드 딕셔너리
        """
        # 1. Local Cache Update
        try:
            import glob
            import json
            
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            cache_root = os.path.join(base_dir, 'cache')
            
            # Robust search pattern
            search_pattern = os.path.join(cache_root, '**', f'*{article_id}.json')
            files = glob.glob(search_pattern, recursive=True)
            
            if files:
                target_file = files[0]
                with open(target_file, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                # Apply dot-notation updates
                for key, value in updates.items():
                    parts = key.split('.')
                    target = content
                    for part in parts[:-1]:
                        if part not in target:
                             if isinstance(target, dict):
                                 target[part] = {}
                             target = target[part]
                    if isinstance(target, dict):
                        target[parts[-1]] = value
                
                with open(target_file, 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                print(f"✅ [FirestoreClient] Local file updated during upsert: {target_file}")
        except Exception as e:
            print(f"⚠️ [FirestoreClient] Local upsert failed: {e}")

        # 2. Firestore Upsert
        try:
            doc_ref = self._get_collection('articles').document(article_id)
            doc_ref.set(updates, merge=True)
            self._track_write()
            print(f"✏️ [FirestoreClient] Firestore Upserted: {article_id}")
            return True, f"Upsert successful: {article_id}"
        except Exception as e:
            print(f"❌ [FirestoreClient] Firestore Upsert Failed: {e}")
            return False, str(e)

    def _expand_dot_notation(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert dot.notation keys to nested dictionaries"""
        expanded = {}
        for key, value in data.items():
            parts = key.split('.')
            target = expanded
            for part in parts[:-1]:
                if part not in target:
                    target[part] = {}
                target = target[part]
                if not isinstance(target, dict): # Safety check
                     # If conflicting structure exists (e.g. valid string value replaced by dict), 
                     # we can't easily resolve without data loss. Overwrite.
                     target = {} 
            target[parts[-1]] = value
            
        # Merge logic to handle deep merges if needed? 
        # For 'set' on new doc, simplest expansion is defined above.
        # But wait, if multiple keys share path? e.g. 'a.b':1, 'a.c':2
        # My loop handles this because 'target' points to the same inner dict.
        return expanded

    def upsert_article_state(self, article_id: str, updates: Dict[str, Any]) -> tuple[bool, str]:
        """
        기사 상태 업데이트 (없으면 생성 - Upsert)
        Args:
            article_id: 문서 ID
            updates: 업데이트할 필드 딕셔너리
        """
        # 1. Local Cache Update
        try:
            import glob
            import json
            
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            cache_root = os.path.join(base_dir, 'cache')
            
            # Robust search pattern (With or without underscore prefix)
            search_pattern = os.path.join(cache_root, '**', f'*{article_id}.json')
            files = glob.glob(search_pattern, recursive=True)
            
            if files:
                target_file = files[0]
                with open(target_file, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                # Apply dot-notation locally
                # We can reuse _expand_dot_notation logic concept, but we need to merge INTO content.
                # Let's keep existing explicit merge logic for file safety.
                for key, value in updates.items():
                    parts = key.split('.')
                    target = content
                    for part in parts[:-1]:
                        if part not in target:
                            if isinstance(target, dict):
                                target[part] = {}
                            target = target[part]
                        elif isinstance(target[part], dict):
                            target = target[part]
                        else:
                            # Conflict: Trying to traverse non-dict
                            pass 
                    if isinstance(target, dict):
                         target[parts[-1]] = value
                
                # Ensure updated_at exists
                if '_header' in content:
                    content['_header']['updated_at'] = datetime.now(timezone.utc).isoformat()

                with open(target_file, 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                print(f"✅ [FirestoreClient] Local file updated during upsert: {target_file}")
        except Exception as e:
            print(f"⚠️ [FirestoreClient] Local upsert failed: {e}")

        # 2. Firestore Upsert
        # Critical Fix: 'set(merge=True)' does NOT support dot-notation for nesting.
        # MUST use 'update()' for dots, or expand dict for 'set()'.
        try:
            doc_ref = self._get_collection('articles').document(article_id)
            
            try:
                # Attempt UPDATE (Supports dot notation natively)
                doc_ref.update(updates)
                self._track_write()
                print(f"✏️ [FirestoreClient] Firestore Updated: {article_id}")
                return True, f"Update successful: {article_id}"
                
            except Exception as e:
                # Use string check for NotFound as commonly import might imply extra dependency
                if "404" in str(e) or "Not Found" in str(e) or "not found" in str(e):
                    # Document doesn't exist -> CREATE (Set)
                    # Must expand dots manually because set() interprets "a.b" as literal key.
                    expanded_data = self._expand_dot_notation(updates)
                    doc_ref.set(expanded_data)
                    self._track_write()
                    print(f"✨ [FirestoreClient] Firestore Created (Set): {article_id}")
                    return True, f"Created successful: {article_id}"
                else:
                    raise e
                    
        except Exception as e:
            print(f"❌ [FirestoreClient] Firestore Upsert Failed: {e}")
            return False, str(e)

    def save_article(self, article_id: str, data: Dict[str, Any]) -> bool:
        """기사 저장 (생성 또는 업데이트)"""
        doc_ref = self._get_collection('articles').document(article_id)
        doc_ref.set(data, merge=True)
        self._track_write()
        return True
    
    def update_article(self, article_id: str, updates: Dict[str, Any]) -> bool:
        """기사 부분 업데이트 (Firestore + Local Cache) - 둘 다 업데이트"""
        
        local_success = False
        firestore_success = False
        
        # 1. Try Local Cache Update first
        try:
            import glob
            import json
            from datetime import datetime
            
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            cache_root = os.path.join(base_dir, 'cache')
            
            search_pattern = os.path.join(cache_root, '*', f'{article_id}.json')
            files = glob.glob(search_pattern)
            
            if files:
                target_file = files[0]
                print(f"📂 [FirestoreClient] Updating local file: {target_file}")
                
                with open(target_file, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                # Apply dot-notation updates
                for key, value in updates.items():
                    parts = key.split('.')
                    target = content
                    for i, part in enumerate(parts[:-1]):
                        if part not in target:
                            target[part] = {}
                        target = target[part]
                    target[parts[-1]] = value
                
                with open(target_file, 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                
                print(f"✅ [FirestoreClient] Local file updated: {article_id}")
                local_success = True
                
        except Exception as e:
            print(f"⚠️ [FirestoreClient] Local update failed: {e}")

        # 2. Always try Firestore update (not just fallback)
        try:
            doc_ref = self._get_collection('articles').document(article_id)
            doc_ref.update(updates)
            self._track_write()
            firestore_success = True
            print(f"✅ [FirestoreClient] Firestore updated: {article_id}")
        except Exception as e:
            print(f"⚠️ [FirestoreClient] Firestore update failed: {e}")
        
        return local_success or firestore_success
    
    def delete_article(self, article_id: str) -> bool:
        """기사 삭제"""
        doc_ref = self._get_collection('articles').document(article_id)
        doc_ref.delete()
        self._track_delete()
        return True
    
    def list_articles_by_state(self, state: str, limit: int = 100) -> List[Dict[str, Any]]:
        """상태별 기사 목록 조회 (로컬 읽기 + Firestore, updated_at 기준 최신 우선)"""
        local_articles = {}  # article_id -> article
        firestore_articles = {}
        
        # 1. Local Cache 검색 (읽기 전용)
        if state in ['COLLECTED', 'ANALYZED', 'CLASSIFIED', 'PUBLISHED', 'REJECTED']:
            try:
                import glob
                import json
                
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                cache_root = os.path.join(base_dir, 'cache')
                
                if os.path.exists(cache_root):
                    files = glob.glob(os.path.join(cache_root, '*', '*.json'))
                    files.sort(key=os.path.getmtime, reverse=True)
                    
                    for fpath in files[:limit * 2]:  # 여유있게 로드
                        try:
                            with open(fpath, 'r', encoding='utf-8') as f:
                                content = json.load(f)
                                
                            if '_header' in content:
                                file_state = content['_header'].get('state')
                                article_id = content['_header'].get('article_id')
                                if file_state == state and article_id:
                                    local_articles[article_id] = content
                        except Exception:
                            continue
                    print(f"📂 [Local] Loaded {len(local_articles)} articles for state {state}")
            except Exception as e:
                print(f"⚠️ Local cache search failed: {e}")

        # 2. Firestore 검색
        try:
            query = self._get_collection('articles').where(
                '_header.state', '==', state
            ).limit(limit * 2)
            
            docs = query.stream()
            self._track_read()
            
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                article_id = data.get('_header', {}).get('article_id') or doc.id
                firestore_articles[article_id] = data
            print(f"☁️ [Firestore] Loaded {len(firestore_articles)} articles for state {state}")
        except Exception as e:
            print(f"⚠️ Firestore search failed: {e}")
        
        # 3. 병합: updated_at 기준 최신 데이터 우선
        merged = {}
        all_ids = set(local_articles.keys()) | set(firestore_articles.keys())
        
        for aid in all_ids:
            local = local_articles.get(aid)
            remote = firestore_articles.get(aid)
            
            if local and remote:
                # 둘 다 있으면 updated_at 비교
                local_time = local.get('_header', {}).get('updated_at', '')
                remote_time = remote.get('_header', {}).get('updated_at', '')
                merged[aid] = remote if remote_time >= local_time else local
            elif remote:
                merged[aid] = remote
            elif local:
                merged[aid] = local
        
        # 4. 정렬 및 제한
        result = list(merged.values())
        result.sort(key=lambda x: x.get('_header', {}).get('updated_at', ''), reverse=True)
        
        return result[:limit]
    
    def list_recent_articles(self, limit: int = 100) -> List[Dict[str, Any]]:
        """최근 기사 목록 조회"""
        query = self._get_collection('articles').order_by(
            '_header.updated_at', direction=firestore.Query.DESCENDING
        ).limit(limit)
        
        docs = query.stream()
        self._track_read()
        
        articles = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            articles.append(data)
        
        return articles
    
    # =========================================================================
    # History Collection (URL → article_id 매핑)
    # =========================================================================
    
    def get_history_index(self) -> Dict[str, Any]:
        """히스토리 인덱스 조회"""
        doc_ref = self._get_collection('history').document('_index')
        doc = doc_ref.get()
        self._track_read()
        
        if doc.exists:
            return doc.to_dict()
        return {'urls': {}}
    
    def update_history(self, url: str, article_id: str, status: str):
        """히스토리 업데이트"""
        doc_ref = self._get_collection('history').document('_index')
        doc_ref.set({
            f'urls.{self._url_to_key(url)}': {
                'article_id': article_id,
                'status': status,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
        }, merge=True)
        self._track_write()
    
    def check_url_exists(self, url: str) -> Optional[Dict[str, Any]]:
        """URL이 이미 처리되었는지 확인"""
        history = self.get_history_index()
        url_key = self._url_to_key(url)
        return history.get('urls', {}).get(url_key)
    
    def _url_to_key(self, url: str) -> str:
        """URL을 Firestore 키로 변환 (특수문자 제거)"""
        import hashlib
        return hashlib.md5(url.encode()).hexdigest()[:12]
    
    # =========================================================================
    # Publications Collection
    # =========================================================================
    
    def get_publication(self, edition_code: str) -> Optional[Dict[str, Any]]:
        """발행 정보 조회"""
        doc_ref = self._get_collection('publications').document(edition_code)
        doc = doc_ref.get()
        self._track_read()
        
        if doc.exists:
            return doc.to_dict()
        return None
    
    def save_publication(self, edition_code: str, data: Dict[str, Any]) -> bool:
        """발행 정보 저장"""
        doc_ref = self._get_collection('publications').document(edition_code)
        doc_ref.set(data, merge=True)
        self._track_write()
        return True
    
    def get_publications_meta(self) -> Optional[Dict[str, Any]]:
        """발행 메타 정보 조회"""
        doc_ref = self._get_collection('publications').document('_meta')
        doc = doc_ref.get()
        self._track_read()
        
        if doc.exists:
            return doc.to_dict()
        return None

    def get_issues_from_meta(self, status_filter=None) -> List[Dict[str, Any]]:
        """
        _meta 문서에서 회차 목록 조회 (1 READ로 최적화)
        Args:
            status_filter: 'preview' 또는 'released' (None이면 전체)
        Returns: list of issue dicts [{code, name, count, updated_at, status}, ...]
        """
        meta = self.get_publications_meta()
        if not meta:
            return []
        
        issues = meta.get('issues', [])
        
        # status 필터 적용
        if status_filter:
            issues = [i for i in issues if i.get('status') == status_filter]
        
        # 시스템 문서 필터링 (edition_code가 '_'로 시작하는 항목 제외)
        issues = [i for i in issues if not (i.get('edition_code') or i.get('code', '')).startswith('_')]
        
        # edition_code 기준 내림차순 정렬 (발행순 유지)
        issues.sort(key=lambda x: x.get('edition_code') or x.get('code', ''), reverse=True)
        
        # API 응답 형식에 맞게 변환 (id 필드 추가, 호환성 보장)
        result = []
        for iss in issues:
            code = iss.get('edition_code') or iss.get('code')  # edition_code 우선
            name = iss.get('edition_name') or iss.get('name')  # edition_name 우선
            count = iss.get('count', 0)
            if 'article_count' in iss: # fallback if count missing
                 count = iss.get('article_count', count)

            result.append({
                'id': code,
                'code': code,
                'edition_code': code,
                'name': name,
                'edition_name': name,
                'count': count,
                'article_count': count,
                'updated_at': iss.get('updated_at'),
                'status': iss.get('status', 'preview'),
                'schema_version': iss.get('schema_version')
            })
        
        print(f"📋 [Firestore] Loaded {len(result)} issues from _meta (1 READ)")
        return result
    
    def update_publications_meta(self, data: Dict[str, Any]) -> bool:
        """발행 메타 정보 업데이트"""
        doc_ref = self._get_collection('publications').document('_meta')
        doc_ref.set(data, merge=True)
        self._track_write()
        return True

    def list_publications(self, limit: int = 20) -> List[Dict[str, Any]]:
        """발행 회차 목록 조회 (최신순)"""
        query = self._get_collection('publications')\
            .order_by('published_at', direction=firestore.Query.DESCENDING)\
            .limit(limit)
        
        docs = query.stream()
        self._track_read()
        
        return [doc.to_dict() for doc in docs]

    def list_articles_by_edition(self, edition_code: str) -> List[Dict[str, Any]]:
        """회차별 기사 목록 조회 (publications/{edition_code} 문서의 articles 필드)"""
        # publications/{edition_code} 문서에서 articles 배열 읽기
        pub_doc = self.get_publication(edition_code)
        if pub_doc and 'articles' in pub_doc:
            self._track_read()
            return pub_doc['articles']
        
        # Fallback: articles 컬렉션에서 쿼리 (구버전 호환)
        query = self._get_collection('articles').where(
            '_publication.edition_code', '==', edition_code
        )
        
        docs = query.stream()
        self._track_read()
        
        articles = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            articles.append(data)
        return articles
