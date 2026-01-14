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
from src.core_logic import get_kst_now # [IMPORTS]


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
        
        # History Setup
        self.history = self._load_history()  # Local: URL -> timestamp
        self._remote_hashes = set()          # Remote: Hash set
        self._load_remote_history_hashes()   # Load remote hashes
        
        # Initialize usage stats
        self.reset_usage_stats()
        FirestoreClient._usage_stats['session_start'] = get_kst_now()
    
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
    
    @staticmethod
    def get_schema_version() -> str:
        """스키마 버전 반환 (환경변수에서 읽음)"""
        return os.getenv('SCHEMA_VERSION', '3.0')

    def _get_env(self) -> str:
        return self.get_env_name()
    
    def _get_collection(self, collection_name: str):
        """환경별 컬렉션 참조 반환"""
        env = self._get_env()
        return self.db.collection(env).document('data').collection(collection_name)
    
    # =========================================================================
    # Helpers
    # =========================================================================



    def _get_cache_dir(self):
        """캐시 디렉토리 경로 반환 (환경별 분리)"""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        env = os.getenv('ZND_ENV', 'dev')
        return os.path.join(base_dir, 'cache', env)

    def _load_history(self):
        """crawling_history.json 로드 (로컬 전용)"""
        import json
        file_path = os.path.join(self._get_cache_dir(), 'crawling_history.json')
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}
    
    def _load_remote_history_hashes(self):
        """Firestore 히스토리 인덱스 로드 (Hash Set)"""
        try:
            doc_ref = self._get_collection('history').document('_index')
            doc = doc_ref.get()
            self._track_read()

            if doc.exists:
                data = doc.to_dict()

                # Case 1: 중첩 객체 형태 {'urls': {'hash1': {...}, 'hash2': {...}}}
                urls_map = data.get('urls', {})
                if urls_map:
                    self._remote_hashes = set(urls_map.keys())
                else:
                    # Case 2: 플랫 키 형태 {'urls.hash1': {...}, 'urls.hash2': {...}}
                    self._remote_hashes = set()
                    for key in data.keys():
                        if key.startswith('urls.'):
                            hash_part = key[5:]  # 'urls.' 제거
                            self._remote_hashes.add(hash_part)

                print(f"📥 [History] Loaded {len(self._remote_hashes)} remote hashes")
        except Exception as e:
            print(f"⚠️ [History] Remote hash load failed: {e}")

    def _save_history_file(self):
        """crawling_history.json 저장 (최근 5000개 유지)"""
        import json
        file_path = os.path.join(self._get_cache_dir(), 'crawling_history.json')
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Limit to last 5000 entries
        if len(self.history) > 5000:
            keys_to_keep = list(self.history.keys())[-5000:]
            self.history = {k: self.history[k] for k in keys_to_keep}

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)

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
    def reset_usage_stats(cls):
        cls._usage_stats = {
            'reads': 0,
            'writes': 0,
            'deletes': 0,
            'session_start': get_kst_now() # [FIX] Use KST
        }
    
    # =========================================================================
    # Articles Collection CRUD
    # =========================================================================
    
    def get_article(self, article_id: str) -> Optional[Dict[str, Any]]:
        """
        기사 조회 (updated_at 기준 최신 데이터)
        - 로컬/Firestore 둘 다 조회 후 updated_at 비교
        - 최신 데이터가 정본
        """
        import glob
        import json
        
        local_data = None
        remote_data = None
        
        # 1. Local Cache 조회
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            env = os.getenv('ZND_ENV', 'dev')
            cache_root = os.path.join(base_dir, 'cache', env)
            
            search_pattern = os.path.join(cache_root, '*', f'{article_id}.json')
            found_paths = glob.glob(search_pattern)
            
            # DEBUG
            if not found_paths:
                print(f"🔍 [DEBUG get_article] pattern='{search_pattern}', found={len(found_paths)}")
            
            if found_paths:
                found_paths.sort(key=os.path.getmtime, reverse=True)
                target_path = found_paths[0]
                
                with open(target_path, 'r', encoding='utf-8') as f:
                    local_data = json.load(f)
        except Exception as e:
            print(f"⚠️ [FirestoreClient] Local cache lookup failed: {e}")

        # 2. Firestore 조회
        try:
            doc_ref = self._get_collection('articles').document(article_id)
            doc = doc_ref.get()
            self._track_read()
            
            if doc.exists:
                remote_data = doc.to_dict()
                remote_data['id'] = doc.id
        except Exception as e:
            print(f"⚠️ [FirestoreClient] Firestore lookup failed: {e}")
        
        # 3. Smart Merge (지능형 병합)
        # 단순히 최신 것을 선택하는 것이 아니라, "정보의 총량"을 보존하며 최신 상태를 반영
        
        if local_data and remote_data:
            local_header = local_data.get('_header', {})
            remote_header = remote_data.get('_header', {})
            
            local_time = local_header.get('updated_at', '')
            remote_time = remote_header.get('updated_at', '')
            
            remote_is_newer = remote_time >= local_time
            
            # 데이터 완전성 체크 (_original 필수)
            local_complete = bool(local_data.get('_original'))
            remote_complete = bool(remote_data.get('_original'))
            
            # =========================================================
            # Smart Sync: 뒤쳐진 쪽만 업데이트 (Optimization)
            # =========================================================
            
            if remote_is_newer:
                if remote_complete:
                    # Case 1: Remote가 정본 -> Local만 업데이트 (Cache Refresh)
                    try:
                        if target_path:
                            with open(target_path, 'w', encoding='utf-8') as f:
                                json.dump(remote_data, f, ensure_ascii=False, indent=2)
                            # print(f"📥 [Sync] Local cache updated from Firestore: {article_id}")
                    except Exception as e:
                        print(f"⚠️ [Sync] Local update failed: {e}")
                    return remote_data
                    
                elif local_complete:
                    # Case 2: Remote가 최신이나 불완전 -> Merge -> 둘 다 업데이트 (Repair & Sync)
                    print(f"🛠️ [Sync] Reconstructing sparse data for {article_id}")
                    merged = local_data.copy()
                    
                    if '_header' not in merged: merged['_header'] = {}
                    merged['_header'].update(remote_header)
                    
                    for key, val in remote_data.items():
                        if key not in ['_header', '_original'] and val:
                            merged[key] = val
                            
                    # 1. Fix Firestore
                    try:
                        self.save_article(article_id, merged)
                    except Exception as e:
                        print(f"⚠️ [Sync] Firestore repair failed: {e}")
                        
                    # 2. Update Local
                    try:
                        if target_path:
                            with open(target_path, 'w', encoding='utf-8') as f:
                                json.dump(merged, f, ensure_ascii=False, indent=2)
                    except Exception as e:
                        print(f"⚠️ [Sync] Local update failed: {e}")
                            
                    return merged
                else:
                    # Case 3: 둘 다 불완전 -> Remote 사용 (복구 불가)
                    return remote_data
            else:
                # Case 4: Local이 정본 -> Firestore만 업데이트 (Server Sync)
                # [최적화] 실제로 데이터가 다를 때만 쓰기 수행
                # updated_at 차이가 미미하거나 상태가 같으면 스킵

                local_state = local_header.get('state', '')
                remote_state = remote_header.get('state', '')

                # [FIX] 상태 역전 방지: PUBLISHED/RELEASED를 낮은 상태로 덮어쓰지 않음
                # 자동 동기화에서만 차단, 수동 UI 변경(update_state)은 별도 경로로 허용됨
                protected_states = {'PUBLISHED', 'RELEASED'}
                lower_states = {'COLLECTED', 'ANALYZED', 'CLASSIFIED', 'REJECTED'}

                if remote_state in protected_states and local_state in lower_states:
                    print(f"🛡️ [Sync] State downgrade blocked: {article_id} (Remote={remote_state}, Local={local_state})")
                    # Remote 데이터 유지, Local 캐시만 업데이트
                    try:
                        if target_path:
                            with open(target_path, 'w', encoding='utf-8') as f:
                                json.dump(remote_data, f, ensure_ascii=False, indent=2)
                            print(f"   📥 Local cache corrected to {remote_state}")
                    except Exception as e:
                        print(f"⚠️ [Sync] Local cache correction failed: {e}")
                    return remote_data

                # 상태가 같고 시간 차이가 1초 미만이면 쓰기 스킵 (불필요한 동기화 방지)
                time_diff_negligible = abs(len(local_time) - len(remote_time)) < 2 if local_time and remote_time else False
                same_state = local_state == remote_state

                if same_state and (local_time == remote_time or time_diff_negligible):
                    # 이미 동기화됨 - 쓰기 스킵
                    pass
                else:
                    try:
                        print(f"📤 [Sync] Pushing local changes to Firestore: {article_id} ({remote_state} -> {local_state})")
                        self.save_article(article_id, local_data)
                    except Exception as e:
                        print(f"⚠️ [Sync] Firestore update failed: {e}")

                return local_data
                
        elif local_data:
            return local_data
        elif remote_data:
            return remote_data
        
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
            env = os.getenv('ZND_ENV', 'dev')
            cache_root = os.path.join(base_dir, 'cache', env)
            
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
            env = os.getenv('ZND_ENV', 'dev')
            cache_root = os.path.join(base_dir, 'cache', env)
            
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
                    content['_header']['updated_at'] = get_kst_now()

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
            env = os.getenv('ZND_ENV', 'dev')
            cache_root = os.path.join(base_dir, 'cache', env)
            
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
                env = os.getenv('ZND_ENV', 'dev')
                cache_root = os.path.join(base_dir, 'cache', env)
                
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
        
        # 3. 병합: updated_at 기준 최신 데이터 우선 + 데이터 완전성 검사
        merged = {}
        all_ids = set(local_articles.keys()) | set(firestore_articles.keys())
        
        def is_complete(article):
            """데이터 완전성 검사: _original.url 필수"""
            if not article:
                return False
            original = article.get('_original', {})
            return bool(original.get('url'))
        
        for aid in all_ids:
            local = local_articles.get(aid)
            remote = firestore_articles.get(aid)
            
            if local and remote:
                # 둘 다 있으면: 완전성과 updated_at 함께 고려
                local_complete = is_complete(local)
                remote_complete = is_complete(remote)
                
                if local_complete and not remote_complete:
                    # Local만 완전 -> Local 사용
                    merged[aid] = local
                elif remote_complete and not local_complete:
                    # Remote만 완전 -> Remote 사용
                    merged[aid] = remote
                else:
                    # 둘 다 완전하거나 둘 다 불완전 -> updated_at 비교
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
        """히스토리 업데이트 (Firestore + 런타임 캐시)"""
        url_hash = self._url_to_key(url)

        # 1. Firestore 업데이트
        doc_ref = self._get_collection('history').document('_index')
        doc_ref.set({
            f'urls.{url_hash}': {
                'article_id': article_id,
                'status': status,
                'updated_at': get_kst_now()
            }
        }, merge=True)
        self._track_write()

        # 2. 런타임 해시 캐시에도 추가 (중복 수집 방지)
        self._remote_hashes.add(url_hash)

        # 3. 로컬 히스토리에도 추가 (세션 간 중복 방지)
        self.history[url] = get_kst_now()
        self._save_history_file()
    
    def check_url_exists(self, url: str) -> Optional[Dict[str, Any]]:
        """URL이 이미 처리되었는지 확인"""
        history = self.get_history_index()
        url_key = self._url_to_key(url)
        return history.get('urls', {}).get(url_key)
    
    def _url_to_key(self, url: str) -> str:
        """URL을 Firestore 키로 변환 (정규화 후 해시)"""
        import hashlib
        # URL 정규화: 끝 슬래시 제거하여 일관된 키 생성
        normalized_url = url.rstrip('/')
        return hashlib.md5(normalized_url.encode()).hexdigest()[:12]
    
    # =========================================================================
    # Local History Management (Ported from DBClient)
    # =========================================================================

    def check_history(self, url: str) -> bool:
        """
        URL 처리 여부 확인 (로컬 + 원격 해시 체크)
        """
        # 1. Local Check (Frequency: High, Cost: Low)
        if url in self.history:
            return True
            
        # 2. Remote Hash Check (Frequency: Low, Cost: Low - InMemory Set)
        url_hash = self._url_to_key(url)
        if url_hash in self._remote_hashes:
            return True
            
        return False

    def get_history_status(self, url: str) -> Optional[str]:
        """(Deprecated) 히스토리 상태 반환 - 호환성 유지용"""
        if url in self.history:
            return "VISITED"
        return None

    def save_history(self, url: str, status: str = None, reason: str = None, article_id: str = None):
        """히스토리 저장 (URL 방문 기록) - 로컬 + Firestore 둘 다"""
        import hashlib
        
        # 로컬 히스토리 저장
        self.history[url] = get_kst_now()
        self._save_history_file()
        
        # [FIX] article_id 없으면 자동 생성
        if not article_id:
            article_id = hashlib.md5(url.encode()).hexdigest()[:12]
        
        # Firestore 히스토리 항상 동기화 (조건 제거)
        try:
            self.update_history(url, article_id, status or 'VISITED')
            # 런타임 해시셋도 갱신
            url_hash = self._url_to_key(url)
            self._remote_hashes.add(url_hash)
        except Exception as e:
            print(f"⚠️ [History] Firestore sync failed: {e}")

    def refresh_remote_hashes(self):
        """원격 히스토리 해시 강제 새로고침 (사이트 재오픈 시)"""
        self._load_remote_history_hashes()
        print(f"🔄 [History] Refreshed: {len(self._remote_hashes)} remote hashes")

    def remove_from_history(self, url: str):
        """히스토리에서 제거 (재처리용)"""
        if url in self.history:
            del self.history[url]
            self._save_history_file()
            print(f"🗑️ [History] Removed from history: {url[:50]}...")
        else:
            print(f"⚠️ [History] URL not found in history: {url[:50]}...")

    # =========================================================================
    # Crawler Support (Ported from DBClient)
    # =========================================================================

    def save_crawled_article(self, article_data: Dict[str, Any]):
        """
        크롤러 수집 데이터 저장 (V2 Schema 변환 및 저장)
        DBClient.save_article 로직 이식
        """
        import hashlib
        
        # Ensure crawled_at
        crawled_at = article_data.get('crawled_at')
        now = get_kst_now()
        if not crawled_at:
             crawled_at = now
             article_data['crawled_at'] = now

        # Generate ID
        url = article_data.get('url', '')
        article_id = article_data.get('article_id') or hashlib.md5(url.encode()).hexdigest()[:12]
        
        # V2 Schema Construction
        v2_article = {
            '_header': {
                'version': self.get_schema_version(),
                'article_id': article_id,
                'state': 'ANALYZED',  # 저장 시 ANALYZED 상태 (pipeline 흐름상)
                'created_at': crawled_at,
                'updated_at': now,
                'state_history': [
                    {'state': 'COLLECTED', 'at': crawled_at, 'by': 'crawler'},
                    {'state': 'ANALYZED', 'at': now, 'by': 'pipeline'}
                ]
            },
            '_original': {
                'url': url,
                'title': article_data.get('original_title') or article_data.get('title', ''),
                'text': article_data.get('text', '')[:5000],
                'image': article_data.get('image'),
                'source_id': article_data.get('source_id', 'unknown'),
                'crawled_at': crawled_at,
                'published_at': article_data.get('published_at')
            },
            '_analysis': {
                'title_ko': article_data.get('title_ko') or article_data.get('title', ''),
                'summary': article_data.get('summary', ''),
                'tags': article_data.get('tags', []),
                'impact_score': float(article_data.get('impact_score', 0) or 0),
                'zero_echo_score': float(article_data.get('zero_echo_score', 0) or 0),
                'analyzed_at': now,
                'mll_raw': article_data.get('raw_analysis')
            },
            '_classification': None,
            '_publication': None
        }
        
        # Save to Firestore (via existing upsert logic for consistency)
        # Using upsert_article_state might be tricky for full replace/create of structure.
        # Direct set is better for new articles.
        try:
            self._get_collection('articles').document(article_id).set(v2_article, merge=True)
            self._track_write()
            print(f"✅ [FirestoreClient] Saved crawled article: {article_id}")
            
            # Update History
            if url:
                self.save_history(url, 'ANALYZED', reason='mll_complete')
                
        except Exception as e:
            print(f"❌ [FirestoreClient] Save crawled article failed: {e}")
    
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
        Returns: list of issue dicts
        """
        meta = self.get_publications_meta()
        if not meta:
            return []
        
        issues = meta.get('issues', [])
        
        # status 필터 적용
        if status_filter:
            issues = [i for i in issues if i.get('status') == status_filter]
        
        # 시스템 문서 필터링 (edition_code가 '_'로 시작하는 항목 제외)
        issues = [i for i in issues if not i.get('edition_code', '').startswith('_')]
        
        # edition_code 기준 내림차순 정렬 (발행순 유지)
        issues.sort(key=lambda x: x.get('edition_code', ''), reverse=True)
        
        # API 응답 형식에 맞게 변환 (레거시 필드 제거됨)
        result = []
        for iss in issues:
            result.append({
                'edition_code': iss.get('edition_code'),
                'edition_name': iss.get('edition_name'),
                'index': iss.get('index', 1),
                'article_count': iss.get('article_count', 0),
                'published_at': iss.get('published_at'),
                'updated_at': iss.get('updated_at'),
                'status': iss.get('status', 'preview'),
                'schema_version': iss.get('schema_version', '3.1')
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

    # =========================================================================
    # Trend Reports Collection
    # =========================================================================
    
    def save_trend_report(self, report_id: str, data: Dict[str, Any]) -> bool:
        """트렌드 리포트 저장"""
        doc_ref = self._get_collection('trend_reports').document(report_id)
        doc_ref.set(data, merge=True)
        self._track_write()
        print(f"✅ [FirestoreClient] Trend report saved: {report_id}")
        return True
    
    def get_trend_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        """트렌드 리포트 조회"""
        doc_ref = self._get_collection('trend_reports').document(report_id)
        doc = doc_ref.get()
        self._track_read()
        
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None
    
    def list_trend_reports(self, limit: int = 20) -> List[Dict[str, Any]]:
        """트렌드 리포트 목록 조회 (최신순)"""
        query = self._get_collection('trend_reports')\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(limit)
        
        docs = query.stream()
        self._track_read()
        
        reports = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            reports.append({
                'id': data.get('id'),
                'period': data.get('period', {}),
                'created_at': data.get('created_at')
            })
        return reports
    
    def delete_trend_report(self, report_id: str) -> bool:
        """트렌드 리포트 삭제"""
        try:
            doc_ref = self._get_collection('trend_reports').document(report_id)
            doc_ref.delete()
            self._track_delete()
            print(f"🗑️ [FirestoreClient] Trend report deleted: {report_id}")
            return True
        except Exception as e:
            print(f"❌ [FirestoreClient] Failed to delete report: {e}")
            return False

