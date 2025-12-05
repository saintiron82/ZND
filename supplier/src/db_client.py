import os
import firebase_admin
from firebase_admin import credentials, firestore

class DBClient:
    def __init__(self):
        self.db = self._initialize_firebase()
        self.visited_urls = self._load_visited_urls()

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

    def _load_visited_urls(self):
        import json
        file_path = os.path.join(self._get_data_dir(), 'visited_urls.json')
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return set(json.load(f))
            except Exception:
                return set()
        return set()

    def _save_visited_urls(self):
        import json
        file_path = os.path.join(self._get_data_dir(), 'visited_urls.json')
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(list(self.visited_urls), f, ensure_ascii=False, indent=2)

    def check_duplicate(self, url):
        # Check in-memory set (fast)
        if url in self.visited_urls:
            return True
            
        # Optional: Double check DB if connected (for consistency across multiple runners)
        if self.db:
            docs = self.db.collection('articles').where('url', '==', url).limit(1).get()
            if len(docs) > 0:
                self.visited_urls.add(url) # Cache it
                return True
        
        return False

    def _calculate_edition(self, date_str, current_dt):
        """Calculates the edition number based on time clusters of existing files."""
        import glob
        from datetime import datetime, timedelta

        dir_path = os.path.join(self._get_data_dir(), date_str)
        if not os.path.exists(dir_path):
            return 1

        # Get all JSON files
        files = glob.glob(os.path.join(dir_path, '*.json'))
        if not files:
            return 1

        timestamps = []
        for f in files:
            # Filename format: YYYYMMDD_HHMMSS_...
            basename = os.path.basename(f)
            try:
                ts_str = basename.split('_')[1]
                # We only care about time, but need date for comparison if needed. 
                full_dt = datetime.strptime(f"{date_str} {ts_str}", '%Y-%m-%d %H%M%S')
                timestamps.append(full_dt)
            except (IndexError, ValueError):
                continue

        if not timestamps:
            return 1

        timestamps.sort()
        
        # Cluster timestamps by 10-minute gaps
        clusters = 0
        if timestamps:
            clusters = 1
            last_ts = timestamps[0]
            for ts in timestamps[1:]:
                if (ts - last_ts).total_seconds() > 600: # 10 minutes
                    clusters += 1
                last_ts = ts
        
        # Check if current time belongs to the last cluster or starts a new one
        if timestamps:
            last_existing_ts = timestamps[-1]
            if (current_dt - last_existing_ts).total_seconds() > 600:
                return clusters + 1
            else:
                return clusters
        
        return 1

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
        
        # 3. Update visited index
        if 'url' in article_data:
            self.visited_urls.add(article_data['url'])
            self._save_visited_urls()

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
