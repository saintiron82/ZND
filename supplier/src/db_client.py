import os
import firebase_admin
from firebase_admin import credentials, firestore

class DBClient:
    def __init__(self):
        self.db = self._initialize_firebase()
        self.history = self._load_history()

    def _initialize_firebase(self):
        service_account_key = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY', 'serviceAccountKey.json')
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
        Returns True if status is ACCEPTED, REJECTED, or SKIPPED.
        """
        if url in self.history:
            status = self.history[url].get('status')
            if status in ['ACCEPTED', 'REJECTED', 'SKIPPED']:
                return True
        return False

    def save_history(self, url, status, reason=None):
        """
        Records the processing state of a URL.
        status: 'ACCEPTED', 'REJECTED', 'SKIPPED'
        """
        from datetime import datetime
        
        self.history[url] = {
            'status': status,
            'reason': reason,
            'timestamp': datetime.now().isoformat()
        }
        self._save_history_file()

    def save_article(self, article_data):
        from datetime import datetime
        
        # Ensure crawled_at is set
        crawled_at = article_data.get('crawled_at')
        if isinstance(crawled_at, str):
            try:
                crawled_at_dt = datetime.fromisoformat(crawled_at)
            except ValueError:
                crawled_at_dt = datetime.now()
        elif isinstance(crawled_at, datetime):
            crawled_at_dt = crawled_at
        else:
            crawled_at_dt = datetime.now()
            article_data['crawled_at'] = crawled_at_dt.isoformat()

        # Calculate Edition
        date_str = crawled_at_dt.strftime('%Y-%m-%d')
        edition = self._calculate_edition(date_str, crawled_at_dt)
        article_data['edition'] = edition
        print(f"DEBUG: Calculated Edition: {edition}")

        # 1. Save to DB if available
        if self.db:
            try:
                self.db.collection('articles').add(article_data)
            except Exception as e:
                print(f"❌ Save Failed (DB): {e}")

        # 2. Save to individual file
        self._save_to_individual_file(article_data)
        
        # 3. Update history as ACCEPTED
        if 'url' in article_data:
            self.save_history(article_data['url'], 'ACCEPTED', reason='high_score')

    def _save_to_individual_file(self, article_data):
        import json
        import hashlib
        from datetime import datetime
        
        # Ensure crawled_at is a datetime object or string
        crawled_at = article_data.get('crawled_at')
        if isinstance(crawled_at, str):
            try:
                crawled_at_dt = datetime.fromisoformat(crawled_at)
            except ValueError:
                crawled_at_dt = datetime.now()
        elif isinstance(crawled_at, datetime):
            crawled_at_dt = crawled_at
        else:
            crawled_at_dt = datetime.now()
        
        # Format: data/YYYY-MM-DD/YYYYMMDD_HHMMSS_{source_id}_{hash}.json
        date_str = crawled_at_dt.strftime('%Y-%m-%d')
        time_str = crawled_at_dt.strftime('%Y%m%d_%H%M%S')
        
        # Create directory: data/YYYY-MM-DD
        dir_path = os.path.join(self._get_data_dir(), date_str)
        os.makedirs(dir_path, exist_ok=True)
        
        # Generate hash for uniqueness (using URL)
        url = article_data.get('url', '')
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
        source_id = article_data.get('source_id', 'unknown')
        
        filename = f"{time_str}_{source_id}_{url_hash}.json"
        file_path = os.path.join(dir_path, filename)
        
        # Convert datetime objects to string for JSON serialization
        if isinstance(article_data.get('crawled_at'), datetime):
            article_data['crawled_at'] = article_data['crawled_at'].isoformat()
            
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(article_data, f, ensure_ascii=False, indent=2)
        print(f"💾 Saved to {file_path}: {article_data.get('title_ko')}")
