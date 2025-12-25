import os
import firebase_admin
from firebase_admin import credentials, firestore

class DBClient:
    # 클래스 레벨 사용량 카운터 (세션 유지)
    _usage_stats = {
        'reads': 0,
        'writes': 0,
        'deletes': 0,
        'session_start': None
    }
    
    def __init__(self):
        self.db = self._initialize_firebase()
        self.history = self._load_history()
        
        # 세션 시작 시간 기록 (최초 1회)
        if DBClient._usage_stats['session_start'] is None:
            from datetime import datetime, timezone
            DBClient._usage_stats['session_start'] = datetime.now(timezone.utc).isoformat()

    def _initialize_firebase(self):
        # supplier/src/db_client.py -> supplier/ 폴더 기준 절대 경로 생성
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        key_filename = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY', 'serviceAccountKey.json')
        service_account_key = os.path.join(base_dir, key_filename)
        
        if not os.path.exists(service_account_key):
            print(f"⚠️ {service_account_key} not found. DB operations will be skipped.")
            return None
        
        try:
            cred = credentials.Certificate(service_account_key)
            try:
                firebase_admin.get_app()
            except ValueError:
                firebase_admin.initialize_app(cred)
            return firestore.client()
        except Exception as e:
            print(f"❌ Firebase Init Failed: {e}")
            return None

    def _get_env(self):
        """환경 설정 반환 (dev 또는 release)"""
        return os.getenv('ZND_ENV', 'dev')
    
    def _get_collection(self, collection_name):
        """환경별 컬렉션 참조 반환
        
        구조: {env}/data/{collection_name}
        예: dev/data/publications, release/data/publications
        """
        if not self.db:
            return None
        env = self._get_env()
        # 환경별 하위 컬렉션 경로
        return self.db.collection(env).document('data').collection(collection_name)

    # ============================================
    # Firebase 사용량 추적 메서드
    # ============================================
    
    @classmethod
    def _track_read(cls, count=1):
        """읽기 작업 카운트"""
        cls._usage_stats['reads'] += count
    
    @classmethod
    def _track_write(cls, count=1):
        """쓰기 작업 카운트"""
        cls._usage_stats['writes'] += count
    
    @classmethod
    def _track_delete(cls, count=1):
        """삭제 작업 카운트"""
        cls._usage_stats['deletes'] += count
    
    @classmethod
    def get_usage_stats(cls):
        """현재 세션 사용량 통계 반환"""
        return {
            'reads': cls._usage_stats['reads'],
            'writes': cls._usage_stats['writes'],
            'deletes': cls._usage_stats['deletes'],
            'total': cls._usage_stats['reads'] + cls._usage_stats['writes'] + cls._usage_stats['deletes'],
            'session_start': cls._usage_stats['session_start']
        }
    
    @classmethod
    def reset_usage_stats(cls):
        """사용량 통계 리셋"""
        from datetime import datetime, timezone
        cls._usage_stats = {
            'reads': 0,
            'writes': 0,
            'deletes': 0,
            'session_start': datetime.now(timezone.utc).isoformat()
        }
        print("🔄 [Stats] Firebase usage stats reset")

    def _get_data_dir(self):
        # supplier/src/db_client.py -> supplier/data
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, 'data')

    def _load_history(self):
        import json
        file_path = os.path.join(self._get_data_dir(), 'crawling_history.json')
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def reload_history(self):
        """Force reload history from disk"""
        self.history = self._load_history()
        print(f"🔄 History reloaded. {len(self.history)} items.")


    def _save_history_file(self):
        import json
        file_path = os.path.join(self._get_data_dir(), 'crawling_history.json')
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Limit to last 5000 entries (FIFO)
        if len(self.history) > 5000:
            # Sort by timestamp if available, otherwise just slice
            # Since dicts are insertion-ordered in modern Python, slicing might work if we re-create it,
            # but safer to just keep it simple or sort.
            # For simplicity and performance, we'll just keep the last 5000 keys added if we assume append-only.
            # But here we might be updating existing keys.
            # Let's just keep the size in check roughly.
            keys_to_keep = list(self.history.keys())[-5000:]
            self.history = {k: self.history[k] for k in keys_to_keep}

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)

    def check_history(self, url):
        """
        Checks if the URL has been processed with a final state.
        Returns True if status is ACCEPTED, REJECTED, SKIPPED, WORTHLESS, or MLL_FAILED.
        For EXTRACT_FAILED: allows retry after 24 hours.
        """
        from datetime import datetime, timezone, timedelta
        
        if url in self.history:
            entry = self.history[url]
            status = entry.get('status')
            
            # 영구 차단 상태
            if status in ['ACCEPTED', 'REJECTED', 'SKIPPED', 'WORTHLESS', 'MLL_FAILED']:
                return True
            
            # EXTRACT_FAILED: 24시간 후 재시도 허용
            if status == 'EXTRACT_FAILED':
                timestamp = entry.get('timestamp')
                if timestamp:
                    try:
                        failed_at = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        if datetime.now(timezone.utc) - failed_at < timedelta(hours=24):
                            return True  # 24시간 안됨, 스킵
                        # 24시간 지남, 재시도 허용
                        return False
                    except:
                        pass
                return True  # 타임스탬프 없으면 스킵
                
        return False

    def get_history_status(self, url):
        """
        Returns the status of the URL if it exists in history, else None.
        """
        if url in self.history:
            return self.history[url].get('status')
        return None

    def save_history(self, url, status, reason=None):
        """
        Records the processing state of a URL.
        status: 'ACCEPTED', 'REJECTED', 'SKIPPED'
        """
        from datetime import datetime, timezone
        
        self.history[url] = {
            'status': status,
            'reason': reason,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        self._save_history_file()

    def remove_from_history(self, url):
        """
        Removes a URL from history, effectively resetting it to NEW state.
        """
        if url in self.history:
            del self.history[url]
            self._save_history_file()
            print(f"🗑️ [History] Removed from history: {url[:50]}...")
        else:
            print(f"⚠️ [History] URL not found in history: {url[:50]}...")

    def save_article(self, article_data):
        from datetime import datetime, timezone
        
        # Ensure crawled_at is set
        crawled_at = article_data.get('crawled_at')
        if isinstance(crawled_at, str):
            try:
                crawled_at_dt = datetime.fromisoformat(crawled_at)
            except ValueError:
                crawled_at_dt = datetime.now(timezone.utc)
        elif isinstance(crawled_at, datetime):
            crawled_at_dt = crawled_at
        else:
            crawled_at_dt = datetime.now(timezone.utc)
            article_data['crawled_at'] = crawled_at_dt.isoformat()

        # 1. Save to individual file AND get sanitized data
        article_data['status'] = 'ACCEPTED'
        publish_data = self._save_to_individual_file(article_data)
        
        # 2. Firestore 저장은 발행(publish) 시에만 수행 (비용 절감)
        # 개별 기사 저장 시에는 로컬 파일만 저장

        # 3. Update history as ACCEPTED
        if 'url' in article_data:
            self.save_history(article_data['url'], 'ACCEPTED', reason='high_score')

    def _save_to_individual_file(self, article_data):
        import json
        import hashlib
        from datetime import datetime, timezone
        
        # Ensure crawled_at is a datetime object or string
        crawled_at = article_data.get('crawled_at')
        if isinstance(crawled_at, str):
            try:
                crawled_at_dt = datetime.fromisoformat(crawled_at)
            except ValueError:
                crawled_at_dt = datetime.now(timezone.utc)
        elif isinstance(crawled_at, datetime):
            crawled_at_dt = crawled_at
        else:
            crawled_at_dt = datetime.now(timezone.utc)
        
        # Format: data/YYYY-MM-DD/{source_id}_{hash}.json (simplified)
        date_str = crawled_at_dt.strftime('%Y-%m-%d')
        
        # Create directory: data/YYYY-MM-DD
        data_dir = self._get_data_dir()
        dir_path = os.path.join(data_dir, date_str)
        os.makedirs(dir_path, exist_ok=True)
        
        # Generate hash for uniqueness (using URL)
        url = article_data.get('url', '')
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:12]
        source_id = article_data.get('source_id') or 'unknown'  # Handle empty string too
        
        # Simplified filename: source_id_hash.json
        filename = f"{source_id}_{url_hash}.json"
        file_path = os.path.join(dir_path, filename)
        
        # Convert datetime objects to string for JSON serialization
        if isinstance(article_data.get('crawled_at'), datetime):
            article_data['crawled_at'] = article_data['crawled_at'].isoformat()
            
        # 발행용 필수 필드만 추출 (간결한 데이터 파일)
        article_id = article_data.get('article_id', url_hash)
        publish_fields = {
            'id': article_id,  # WEB에서 id로 참조
            'article_id': article_id,
            'title_ko': article_data.get('title_ko') or article_data.get('title', ''),
            'summary': article_data.get('summary', ''),
            'url': article_data.get('url', ''),
            'tags': article_data.get('tags', []),
            'category': article_data.get('category', ''),
            'zero_echo_score': article_data.get('zero_echo_score', 0),
            'impact_score': article_data.get('impact_score', 0),
            'published_at': article_data.get('published_at') or article_data.get('crawled_at', ''),
            'source_id': source_id,
            'original_title': article_data.get('original_title', ''),
            'publish_id': article_data.get('publish_id', ''),
            'edition_code': article_data.get('edition_code', ''),
            'edition_name': article_data.get('edition_name', '')
        }
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(publish_fields, f, ensure_ascii=False, indent=2)
            print(f"💾 Saved to {file_path}: {publish_fields.get('title_ko')}")
            return publish_fields
        except Exception as e:
            print(f"❌ Error saving file: {e}")
            return None


    def find_article_by_url(self, url):
        """
        Attempts to find a saved JSON article file for the given URL.
        Uses the same hash logic as _save_to_individual_file to predict filename.
        """
        import hashlib
        import glob
        import json
        
        # 1. Calculate Expected Hash
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:12]
        
        # 2. Search pattern: data/YYYY-MM-DD/*_{hash}.json
        search_pattern = os.path.join(self._get_data_dir(), "**", f"*_{url_hash}.json")
        
        files = glob.glob(search_pattern, recursive=True)
        
        if not files:
            return None
            
        # If multiple files exist (duplicates?), return the latest one
        # Sort by modification time
        files.sort(key=os.path.getmtime, reverse=True)
        latest_file = files[0]
        
        print(f"🔎 Found existing file for URL: {latest_file}")
        
        try:
            with open(latest_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error reading existing file {latest_file}: {e}")
            return None

    def inject_correction_with_backup(self, article_data, url):
        """
        Overwrites an existing file with new data, but first backs up the original
        into a 'Back' subfolder.
        """
        import hashlib
        import glob
        import json
        from datetime import datetime
        import shutil
        
        # 1. Find the existing file
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:12]
        search_pattern = os.path.join(self._get_data_dir(), "**", f"*_{url_hash}.json")
        files = glob.glob(search_pattern, recursive=True)
        
        if not files:
            # Fallback: If original not found, just save as new file
            print(f"⚠️ [Inject] Original not found for {url}, saving as new.")
            self._save_to_individual_file(article_data)
            
            # [Fix] Update History for new file too
            if url:
                self.save_history(url, 'ACCEPTED', reason='manual_correction_new')
                
            return True, "Created new file (Original not found)"
            
        # Use the most recent one
        files.sort(key=os.path.getmtime, reverse=True)
        target_file = files[0] # This is the EXISTING file (e.g. in 2025-12-09)
        
        # [NEW LOGIC] Check if we should move it to TODAY's folder?
        # Since we updated crawled_at to NOW in manual_crawler.py, _save_to_individual_file 
        # will target TODAY's folder.
        # So we should Backup the OLD file, and then call _save_to_individual_file (which creates NEW file strings).
        # We should NOT overwrite target_file if it's in a different folder.
        
        current_date_str = datetime.now().strftime('%Y-%m-%d')
        existing_date_dir = os.path.basename(os.path.dirname(target_file))
        
        # 2. Prepare Backup
        target_dir = os.path.dirname(target_file)
        back_dir = os.path.join(target_dir, "Back")
        os.makedirs(back_dir, exist_ok=True)
        
        filename = os.path.basename(target_file)
        backup_filename = f"BACKUP_{int(datetime.now().timestamp())}_{filename}"
        backup_path = os.path.join(back_dir, backup_filename)
        
        try:
            # Move/Copy logic
            shutil.copy2(target_file, backup_path)
            print(f"📦 [Backup] Original saved to: {backup_path}")
            
            # 3. Save New Data:
            # If the dates are different (e.g. Old=2025-12-09, New=2025-12-10 via crawled_at)
            # We should probably SAVE AS NEW FILE in the new directory.
            # And maybe LEAVE the old file as artifact? Or delete it?
            # User wants "Run Date Basis". So let's create a NEW file in the NEW directory.
            # We already backed up the old one.
            
            # Actually, just calling _save_to_individual_file(article_data) will do exactly what we want:
            # It generates path based on article_data['crawled_at'] (which is NOW).
            # So if that path is diff from target_file, we get a new file.
            
            self._save_to_individual_file(article_data)
            
            # 4. Update History
            if url:
                self.save_history(url, 'ACCEPTED', reason='manual_correction')
                
            # SPECIAL: If we saved to a NEW location, should we delete the old file to avoid dupes?
            # Or keep it as history?
            # Usually keep it, but it might confuse the crawler if it finds multiple.
            # find_article_by_url looks for ALL matches and takes latest.
            # So having 2 files (09 and 10) is fine, the 10 will be latest.
            
            return True, f"Injected into current date folder. Backup at {backup_filename}"
            
        except Exception as e:
            return False, f"Backup/Write failed: {str(e)}"

    # ============================================
    # Firestore CRUD Operations
    # ============================================
    
    def get_article(self, doc_id):
        """
        Firestore에서 특정 문서 조회
        Returns: dict (article data) or None
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return None
            
        try:
            doc = self._get_collection('articles').document(doc_id).get()
            self._track_read()  # 통계 추적
            if doc.exists:
                data = doc.to_dict()
                data['id'] = doc.id  # 문서 ID 포함
                return data
            else:
                print(f"⚠️ [Firestore] Document not found: {doc_id}")
                return None
        except Exception as e:
            print(f"❌ [Firestore] Get Failed: {e}")
            return None
    
    def get_article_by_url(self, url):
        """
        URL로 Firestore 문서 조회
        Returns: dict (article data with id) or None
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return None
            
        try:
            docs = self._get_collection('articles').where('url', '==', url).limit(1).stream()
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                return data
            return None
        except Exception as e:
            print(f"❌ [Firestore] Query Failed: {e}")
            return None
    
    def update_article(self, doc_id, update_data):
        """
        Firestore 문서 수정
        Args:
            doc_id: 문서 ID
            update_data: 업데이트할 필드 딕셔너리
        Returns: (bool success, str message)
        """
        if not self.db:
            return False, "DB not connected"
            
        try:
            from datetime import datetime, timezone
            update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            self._get_collection('articles').document(doc_id).update(update_data)
            self._track_write()  # 통계 추적
            print(f"✏️ [Firestore] Updated: {doc_id}")
            return True, f"Updated document: {doc_id}"
        except Exception as e:
            print(f"❌ [Firestore] Update Failed: {e}")
            return False, str(e)
    
    def delete_article(self, doc_id):
        """
        Firestore 문서 삭제
        Args:
            doc_id: 삭제할 문서 ID
        Returns: (bool success, str message)
        """
        if not self.db:
            return False, "DB not connected"
            
        try:
            self._get_collection('articles').document(doc_id).delete()
            self._track_delete()  # 통계 추적
            print(f"🗑️ [Firestore] Deleted: {doc_id}")
            return True, f"Deleted document: {doc_id}"
        except Exception as e:
            print(f"❌ [Firestore] Delete Failed: {e}")
            return False, str(e)
    
    def list_articles(self, limit=50, order_by='crawled_at', descending=True):
        """
        Firestore에서 기사 목록 조회
        Args:
            limit: 최대 조회 개수
            order_by: 정렬 기준 필드
            descending: 내림차순 여부
        Returns: list of dicts
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return []
            
        try:
            from google.cloud.firestore_v1 import Query
            
            query = self._get_collection('articles')
            
            if descending:
                query = query.order_by(order_by, direction=Query.DESCENDING)
            else:
                query = query.order_by(order_by)
                
            query = query.limit(limit)
            
            articles = []
            for doc in query.stream():
                data = doc.to_dict()
                data['id'] = doc.id
                articles.append(data)
                
            print(f"📋 [Firestore] Listed {len(articles)} articles")
            return articles
        except Exception as e:
            print(f"❌ [Firestore] List Failed: {e}")
            return []
    
    def list_articles_by_date(self, date_str):
        """
        특정 날짜의 기사 목록 조회
        Args:
            date_str: 'YYYY-MM-DD' 형식
        Returns: list of dicts
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return []
            
        try:
            # edition_code 필드가 'YYMMDD_'로 시작하는 것으로 필터링
            yy = date_str[2:4]
            mm = date_str[5:7]
            dd = date_str[8:10]
            edition_prefix = f"{yy}{mm}{dd}_"
            
            docs = self._get_collection('articles')\
                .where('edition_code', '>=', edition_prefix)\
                .where('edition_code', '<', edition_prefix + 'z')\
                .stream()
            
            articles = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                articles.append(data)
                
            print(f"📅 [Firestore] Found {len(articles)} articles for {date_str}")
            return articles
        except Exception as e:
            print(f"❌ [Firestore] Date Query Failed: {e}")
            return []

    
    # ============================================
    # Publication History Operations (New)
    # ============================================

    def create_publication_record(self, summary_data):
        """
        Create a new publication record in Firestore (메타+내장형 구조).
        
        summary_data: {
            'published_at': isoformat string,
            'edition_code': '251220_1',
            'edition_name': '12/20 1호',
            'article_count': int,
            'articles': [list of article dicts with full data],
            'status': 'preview' or 'released'
        }
        Returns: edition_code (= publish_id)
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return None

        try:
            from datetime import datetime, timezone
            
            edition_code = summary_data.get('edition_code')
            if not edition_code:
                print("❌ [Firestore] edition_code is required")
                return None
            
            # Ensure timestamps
            if 'published_at' not in summary_data:
                summary_data['published_at'] = datetime.now(timezone.utc).isoformat()
            if 'updated_at' not in summary_data:
                summary_data['updated_at'] = summary_data['published_at']
            
            # 1. 회차 문서 저장 (edition_code = 문서 ID)
            self._get_collection('publications').document(edition_code).set(summary_data)
            self._track_write()  # 통계 추적
            print(f"🎉 [Firestore] Created Publication: {edition_code} ({summary_data.get('edition_name')})")
            
            # 2. _meta 문서 업데이트
            self._update_meta(summary_data)
            
            # 3. _article_ids 문서 업데이트
            article_ids = [a.get('id') or a.get('article_id') for a in summary_data.get('articles', []) if a.get('id') or a.get('article_id')]
            if article_ids:
                self._add_to_article_ids(article_ids)
            
            return edition_code
            
        except Exception as e:
            print(f"❌ [Firestore] Publication Record Creation Failed: {e}")
            return None

    def update_publication_record(self, publish_id, update_data):
        """
        Update an existing publication record.
        """
        # [DEBUG] Entry Logging
        try:
            with open('debug_update.log', 'a', encoding='utf-8') as f:
                from datetime import datetime
                f.write(f"[{datetime.now()}] update_publication_record called for {publish_id}\n")
                f.write(f"Keys: {list(update_data.keys())}\n")
        except Exception as err:
            print(f"Log Error: {err}")

        if not self.db:
            return False
            
        try:
            from datetime import datetime, timezone
            update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            self._get_collection('publications').document(publish_id).update(update_data)
            self._track_write()  # 통계 추적
            print(f"✏️ [Firestore] Updated Publication: {publish_id}")
            
            # _meta 업데이트 (article_count, articles, status, schema_version 변경 시)
            if 'article_count' in update_data or 'articles' in update_data or 'status' in update_data or 'schema_version' in update_data:
                self._update_meta_for_issue(publish_id, update_data)
            
            return True
        except Exception as e:
            print(f"❌ [Firestore] Publication Update Failed: {e}")
            return False

    # ============================================
    # Meta + Article IDs Management (새 구조)
    # ============================================
    
    def _update_meta(self, issue_data):
        """_meta 문서에 회차 정보 추가/업데이트"""
        if not self.db:
            return
            
        try:
            from google.cloud.firestore_v1 import ArrayUnion
            
            meta_ref = self._get_collection('publications').document('_meta')
            
            issue_entry = {
                'code': issue_data.get('edition_code'),
                'name': issue_data.get('edition_name'),
                'count': issue_data.get('article_count', 0),
                'updated_at': issue_data.get('updated_at'),
                'status': issue_data.get('status', 'preview'),
                'schema_version': issue_data.get('schema_version') # [NEW]
            }
            
            # 기존 _meta 가져오기
            meta_doc = meta_ref.get()
            if meta_doc.exists:
                existing_data = meta_doc.to_dict()
                issues = existing_data.get('issues', [])
                
                # 같은 code가 있으면 교체, 없으면 추가
                updated = False
                for i, iss in enumerate(issues):
                    if iss.get('code') == issue_entry['code']:
                        issues[i] = issue_entry
                        updated = True
                        break
                if not updated:
                    issues.append(issue_entry)
                
                meta_ref.update({
                    'issues': issues,
                    'latest_updated_at': issue_data.get('updated_at')
                })
            else:
                # 새로 생성
                meta_ref.set({
                    'issues': [issue_entry],
                    'latest_updated_at': issue_data.get('updated_at')
                })
            
            print(f"📋 [Firestore] Updated _meta for {issue_entry['code']}")
        except Exception as e:
            print(f"⚠️ [Firestore] _meta update failed: {e}")
    
    def _update_meta_for_issue(self, edition_code, update_data):
        """기존 회차의 _meta 항목 업데이트"""
        # [DEBUG] File Logging
        try:
            with open('debug_meta.log', 'a', encoding='utf-8') as f:
                f.write(f"[{datetime.now()}] _update_meta_for_issue called for {edition_code}\n")
                f.write(f"Update Data Keys: {list(update_data.keys())}\n")
                if 'schema_version' in update_data:
                    f.write(f"Schema Version: {update_data['schema_version']}\n")
                else:
                    f.write("Schema Version NOT FOUND in update_data\n")
        except Exception as log_err:
            print(f"Log Error: {log_err}")

        if not self.db:
            return
            
        try:
            meta_ref = self._get_collection('publications').document('_meta')
            meta_doc = meta_ref.get()
            
            if meta_doc.exists:
                existing_data = meta_doc.to_dict()
                issues = existing_data.get('issues', [])
                
                for i, iss in enumerate(issues):
                    if iss.get('code') == edition_code:
                        if 'article_count' in update_data:
                            issues[i]['count'] = update_data['article_count']
                        if 'updated_at' in update_data:
                            issues[i]['updated_at'] = update_data['updated_at']
                        if 'schema_version' in update_data: # [NEW]
                            issues[i]['schema_version'] = update_data['schema_version']
                        if 'status' in update_data: # [NEW] Release 시 status 동기화
                            issues[i]['status'] = update_data['status']
                        break
                
                meta_ref.update({
                    'issues': issues,
                    'latest_updated_at': update_data.get('updated_at')
                })
        except Exception as e:
            print(f"⚠️ [Firestore] _meta update for issue failed: {e}")
    
    def _add_to_article_ids(self, article_ids: list):
        """_article_ids 문서에 신규 ID 추가"""
        if not self.db or not article_ids:
            return
            
        try:
            from google.cloud.firestore_v1 import ArrayUnion
            
            ids_ref = self._get_collection('publications').document('_article_ids')
            ids_ref.set({
                'ids': ArrayUnion(article_ids)
            }, merge=True)
            
            print(f"🔑 [Firestore] Added {len(article_ids)} article IDs to _article_ids")
        except Exception as e:
            print(f"⚠️ [Firestore] _article_ids update failed: {e}")
    
    def _remove_from_article_ids(self, article_ids: list):
        """_article_ids 문서에서 ID 제거"""
        if not self.db or not article_ids:
            return
            
        try:
            from google.cloud.firestore_v1 import ArrayRemove
            
            ids_ref = self._get_collection('publications').document('_article_ids')
            ids_ref.update({
                'ids': ArrayRemove(article_ids)
            })
            
            print(f"🗑️ [Firestore] Removed {len(article_ids)} article IDs from _article_ids")
        except Exception as e:
            print(f"⚠️ [Firestore] _article_ids removal failed: {e}")
    
    def get_published_article_ids_from_firestore(self) -> set:
        """Firestore _article_ids 문서에서 발행된 article_id 목록 조회 (1 READ)"""
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return set()
            
        try:
            ids_doc = self._get_collection('publications').document('_article_ids').get()
            if ids_doc.exists:
                ids = ids_doc.to_dict().get('ids', [])
                print(f"🔑 [Firestore] Loaded {len(ids)} published article IDs")
                return set(ids)
            return set()
        except Exception as e:
            print(f"❌ [Firestore] Failed to get _article_ids: {e}")
            return set()

    def get_issues_from_meta(self, status_filter=None):
        """
        _meta 문서에서 회차 목록 조회 (1 READ로 최적화)
        Args:
            status_filter: 'preview' 또는 'released' (None이면 전체)
        Returns: list of issue dicts [{code, name, count, updated_at, status}, ...]
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return []
            
        try:
            meta_doc = self._get_collection('publications').document('_meta').get()
            self._track_read()  # 통계 추적
            
            if not meta_doc.exists:
                print("📋 [Firestore] No _meta document found")
                return []
            
            meta_data = meta_doc.to_dict()
            issues = meta_data.get('issues', [])
            
            # status 필터 적용
            if status_filter:
                issues = [i for i in issues if i.get('status') == status_filter]
            
            # _meta 문서의 issues 배열에는 _meta, _article_ids 같은 시스템 문서가 없으므로
            # code가 '_'로 시작하는 항목 필터링 (안전장치)
            issues = [i for i in issues if not i.get('code', '').startswith('_')]
            
            # code (edition_code) 기준 내림차순 정렬 (발행순 유지)
            issues.sort(key=lambda x: x.get('code', ''), reverse=True)
            
            # API 응답 형식에 맞게 변환 (id 필드 추가)
            result = []
            for iss in issues:
                result.append({
                    'id': iss.get('code'),  # edition_code = publish_id
                    'edition_code': iss.get('code'),
                    'edition_name': iss.get('name'),
                    'article_count': iss.get('count', 0),
                    'updated_at': iss.get('updated_at'),
                    'status': iss.get('status', 'preview'),
                    'schema_version': iss.get('schema_version')  # [NEW]
                })
            
            print(f"📋 [Firestore] Loaded {len(result)} issues from _meta (1 READ)")
            return result
            
        except Exception as e:
            print(f"❌ [Firestore] Failed to get _meta: {e}")
            return []

    def remove_issue_from_meta(self, edition_code):
        """_meta 문서에서 회차 제거"""
        if not self.db:
            return
            
        try:
            meta_ref = self._get_collection('publications').document('_meta')
            meta_doc = meta_ref.get()
            
            if meta_doc.exists:
                from datetime import datetime, timezone
                
                existing_data = meta_doc.to_dict()
                issues = existing_data.get('issues', [])
                
                # 해당 code 제외
                issues = [i for i in issues if i.get('code') != edition_code]
                
                meta_ref.update({
                    'issues': issues,
                    'latest_updated_at': datetime.now(timezone.utc).isoformat()
                })
                
                print(f"🗑️ [Firestore] Removed {edition_code} from _meta")
        except Exception as e:
            print(f"⚠️ [Firestore] Failed to remove from _meta: {e}")

    def get_issues_by_date(self, date_str=None):
        """
        Get publication records, optionally filtered by date.
        date_str: 'YYYY-MM-DD' (assumes we store a 'date_str' field or filter by range)
        For simplicity, we'll fetch recent ones if date_str is None.
        If date_str provided, we filter by 'edition_code' prefix or a specific date field.
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected in get_issues_by_date")
            return []
            
        try:
            # date_str 필터링은 일단 비활성화하고 전체 조회
            # (복합 인덱스 문제 방지)
            docs = self._get_collection('publications').stream()
            
            issues = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                
                # date_str 필터가 있으면 Python에서 필터링
                if date_str:
                    edition_code = data.get('edition_code', '')
                    # 2025-12-20 -> 251220
                    yy = date_str[2:4]
                    mm = date_str[5:7]
                    dd = date_str[8:10]
                    prefix = f"{yy}{mm}{dd}"
                    if not edition_code.startswith(prefix):
                        continue
                        
                issues.append(data)
            
            # Python에서 published_at 기준 내림차순 정렬
            issues.sort(key=lambda x: x.get('published_at', ''), reverse=True)
            
            print(f"📰 [Firestore] Found {len(issues)} publications")
            return issues
        except Exception as e:
            import traceback
            print(f"❌ [Firestore] Get Issues Failed: {e}")
            traceback.print_exc()
            return []

    def get_publication(self, publish_id):
        """Get single publication record"""
        if not self.db:
            return None
        try:
            doc = self._get_collection('publications').document(publish_id).get()
            self._track_read()  # 통계 추적
            if doc.exists:
                data = doc.to_dict()
                data['id'] = doc.id
                return data
            return None
        except Exception as e:
            return None

    def get_articles_by_publish_id(self, publish_id):
        """
        Firestore에서 publish_id로 기사 목록 조회
        Args:
            publish_id: 발행 회차 ID
        Returns: list of article dicts
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return []
            
        try:
            docs = self.db.collection('articles').where('publish_id', '==', publish_id).stream()
            
            articles = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                articles.append(data)
                
            print(f"📰 [Firestore] Found {len(articles)} articles for publish_id: {publish_id}")
            return articles
        except Exception as e:
            print(f"❌ [Firestore] Get Articles by Publish ID Failed: {e}")
            return []

    def save_issue_index_file(self, issue_data):
        """
        Save a standalone JSON index file for the publication.
        issue_data: dict containing full publication info
        Path: data/YYYY-MM-DD/issue_{edition_code}.json
        """
        import json
        from datetime import datetime
        
        try:
            published_at = issue_data.get('published_at')
            if not published_at:
                published_at = datetime.now().isoformat()
                
            # Extract date for folder
            # If issue_data has 'date', use it. Else parse published_at
            if 'date' in issue_data:
                date_str = issue_data['date']
            else:
                date_str = published_at.split('T')[0]
                
            data_dir = self._get_data_dir()
            dir_path = os.path.join(data_dir, date_str)
            os.makedirs(dir_path, exist_ok=True)
            
            edition_code = issue_data.get('edition_code', 'unknown')
            filename = f"issue_{edition_code}.json"
            file_path = os.path.join(dir_path, filename)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(issue_data, f, ensure_ascii=False, indent=2)
                
            print(f"💾 [Issue Index] Saved to {file_path}")
            return file_path
        except Exception as e:
            print(f"❌ [Issue Index] Save Failed: {e}")
            return None

    # ============================================
    # Cache Sync Operations (캐시 동기화)
    # ============================================
    
    def upload_cache_batch(self, date_str: str, cache_list: list) -> dict:
        """
        캐시 데이터를 Firestore cache_sync/{date} 컬렉션에 일괄 저장
        
        Args:
            date_str: 'YYYY-MM-DD' 형식
            cache_list: 캐시 데이터 리스트 [{'article_id': ..., ...}, ...]
        
        Returns:
            {'success': int, 'failed': int, 'errors': [...]}
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return {'success': 0, 'failed': len(cache_list), 'errors': ['DB not connected']}
        
        result = {'success': 0, 'failed': 0, 'errors': []}
        
        try:
            from datetime import datetime, timezone
            
            batch = self.db.batch()
            batch_count = 0
            MAX_BATCH = 500  # Firestore 배치 한도
            
            for cache_data in cache_list:
                try:
                    article_id = cache_data.get('article_id')
                    if not article_id:
                        result['failed'] += 1
                        result['errors'].append(f"Missing article_id")
                        continue
                    
                    # cache_sync/{date}/{article_id} 경로에 저장
                    doc_ref = self.db.collection('cache_sync').document(date_str).collection('articles').document(article_id)
                    batch.set(doc_ref, cache_data)
                    batch_count += 1
                    result['success'] += 1
                    
                    # 배치 한도 도달 시 커밋
                    if batch_count >= MAX_BATCH:
                        batch.commit()
                        self._track_write(batch_count)
                        batch = self.db.batch()
                        batch_count = 0
                        
                except Exception as e:
                    result['failed'] += 1
                    result['errors'].append(str(e))
            
            # 남은 배치 커밋
            if batch_count > 0:
                batch.commit()
                self._track_write(batch_count)
            
            print(f"☁️ [Sync] Uploaded {result['success']} cache items for {date_str}")
            
            # 동기화 메타데이터 업데이트
            self.update_sync_metadata({
                'last_push': datetime.now(timezone.utc).isoformat(),
                'last_push_date': date_str,
                'last_push_count': result['success']
            })
            
            return result
            
        except Exception as e:
            print(f"❌ [Sync] Upload Failed: {e}")
            result['errors'].append(str(e))
            return result
    
    def download_cache_batch(self, date_str: str) -> list:
        """
        Firestore cache_sync/{date} 컬렉션에서 캐시 데이터 일괄 조회
        
        Args:
            date_str: 'YYYY-MM-DD' 형식
        
        Returns:
            캐시 데이터 리스트 [{'article_id': ..., ...}, ...]
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return []
        
        try:
            cache_list = []
            
            # cache_sync/{date}/articles 서브컬렉션 조회
            docs = self.db.collection('cache_sync').document(date_str).collection('articles').stream()
            
            read_count = 0
            for doc in docs:
                data = doc.to_dict()
                data['article_id'] = doc.id  # 문서 ID = article_id
                cache_list.append(data)
                read_count += 1
            
            self._track_read(read_count)
            print(f"☁️ [Sync] Downloaded {len(cache_list)} cache items for {date_str}")
            
            # 동기화 메타데이터 업데이트
            from datetime import datetime, timezone
            self.update_sync_metadata({
                'last_pull': datetime.now(timezone.utc).isoformat(),
                'last_pull_date': date_str,
                'last_pull_count': len(cache_list)
            })
            
            return cache_list
            
        except Exception as e:
            print(f"❌ [Sync] Download Failed: {e}")
            return []
    
    def get_sync_metadata(self) -> dict:
        """
        동기화 메타데이터 조회
        
        Returns:
            {
                'last_push': ISO 시간,
                'last_pull': ISO 시간,
                'last_push_date': 'YYYY-MM-DD',
                'last_pull_date': 'YYYY-MM-DD',
                ...
            }
        """
        if not self.db:
            return {}
        
        try:
            doc = self.db.collection('cache_sync').document('_meta').get()
            self._track_read()
            
            if doc.exists:
                return doc.to_dict()
            return {}
            
        except Exception as e:
            print(f"❌ [Sync] Get Metadata Failed: {e}")
            return {}
    
    def update_sync_metadata(self, info: dict) -> bool:
        """
        동기화 메타데이터 업데이트
        
        Args:
            info: 업데이트할 정보 딕셔너리
        
        Returns:
            성공 여부
        """
        if not self.db:
            return False
        
        try:
            self.db.collection('cache_sync').document('_meta').set(info, merge=True)
            self._track_write()
            return True
            
        except Exception as e:
            print(f"❌ [Sync] Update Metadata Failed: {e}")
            return False
    
    def get_cache_sync_dates(self) -> list:
        """
        Firestore에 동기화된 날짜 목록 조회
        
        Returns:
            날짜 문자열 리스트 ['2025-12-24', '2025-12-23', ...]
        """
        if not self.db:
            return []
        
        try:
            # cache_sync 컬렉션의 문서 ID = 날짜
            docs = self._get_collection('cache_sync').stream()
            
            dates = []
            for doc in docs:
                if doc.id != '_meta':  # 메타 문서 제외
                    dates.append(doc.id)
            
            self._track_read(len(dates))
            dates.sort(reverse=True)  # 최신 날짜 우선
            return dates
            
        except Exception as e:
            print(f"❌ [Sync] Get Dates Failed: {e}")
            return []

    def upload_crawling_history(self, history: dict) -> dict:
        """
        크롤링 히스토리를 Firestore에 업로드 (병합 방식)
        
        Args:
            history: {url: {status, reason, timestamp}, ...}
        
        Returns:
            {'success': bool, 'count': int}
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return {'success': False, 'count': 0}
        
        try:
            from datetime import datetime, timezone
            
            # crawling_history 문서에 저장 (병합)
            # Firestore 문서 크기 제한(1MB) 때문에 청크로 분할
            CHUNK_SIZE = 500
            urls = list(history.keys())
            total_count = 0
            
            for i in range(0, len(urls), CHUNK_SIZE):
                chunk_urls = urls[i:i+CHUNK_SIZE]
                chunk_data = {url: history[url] for url in chunk_urls}
                
                # 청크별 문서에 저장
                chunk_id = f"chunk_{i // CHUNK_SIZE}"
                self._get_collection('crawling_history').document(chunk_id).set(chunk_data, merge=True)
                self._track_write()
                total_count += len(chunk_data)
            
            # 메타 정보 업데이트
            self._get_collection('crawling_history').document('_meta').set({
                'total_count': len(history),
                'last_sync': datetime.now(timezone.utc).isoformat(),
                'chunk_count': (len(urls) + CHUNK_SIZE - 1) // CHUNK_SIZE
            }, merge=True)
            self._track_write()
            
            print(f"☁️ [Sync] Uploaded crawling history: {total_count} URLs")
            return {'success': True, 'count': total_count}
            
        except Exception as e:
            print(f"❌ [Sync] History Upload Failed: {e}")
            return {'success': False, 'count': 0}
    
    def download_crawling_history(self) -> dict:
        """
        Firestore에서 크롤링 히스토리 다운로드
        
        Returns:
            {url: {status, reason, timestamp}, ...}
        """
        if not self.db:
            print("⚠️ [Firestore] DB not connected")
            return {}
        
        try:
            history = {}
            
            # 모든 청크 문서 조회
            docs = self._get_collection('crawling_history').stream()
            
            read_count = 0
            for doc in docs:
                if doc.id.startswith('_'):  # 메타 문서 스킵
                    continue
                    
                chunk_data = doc.to_dict()
                history.update(chunk_data)
                read_count += 1
            
            self._track_read(read_count)
            print(f"☁️ [Sync] Downloaded crawling history: {len(history)} URLs")
            return history
            
        except Exception as e:
            print(f"❌ [Sync] History Download Failed: {e}")
            return {}
