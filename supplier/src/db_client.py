import os
import firebase_admin
from firebase_admin import credentials, firestore

class DBClient:
    def __init__(self):
        # self.db = self._initialize_firebase()
        self.db = None # Disabled for now
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
        """
        if url in self.history:
            status = self.history[url].get('status')
            if status in ['ACCEPTED', 'REJECTED', 'SKIPPED', 'WORTHLESS', 'MLL_FAILED']:
                return True
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

        # Calculate Edition
        date_str = crawled_at_dt.strftime('%Y-%m-%d')
        edition = self._calculate_edition(date_str, crawled_at_dt)
        article_data['edition'] = edition
        print(f"DEBUG: Calculated Edition: {edition}")

        # 1. Save to DB if available (DISABLED TEMPORARILY)
        # if self.db:
        #     try:
        #         self.db.collection('articles').add(article_data)
        #     except Exception as e:
        #         print(f"❌ Save Failed (DB): {e}")

        # 2. Save to individual file
        # Ensure status is recorded in the file itself (crucial for batch logic)
        article_data['status'] = 'ACCEPTED'
        self._save_to_individual_file(article_data)
        
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
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
        source_id = article_data.get('source_id') or 'unknown'  # Handle empty string too
        
        # Simplified filename: source_id_hash.json
        filename = f"{source_id}_{url_hash}.json"
        file_path = os.path.join(dir_path, filename)
        
        # Convert datetime objects to string for JSON serialization
        if isinstance(article_data.get('crawled_at'), datetime):
            article_data['crawled_at'] = article_data['crawled_at'].isoformat()
            
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(article_data, f, ensure_ascii=False, indent=2)
            print(f"💾 Saved to {file_path}: {article_data.get('title_ko')}")
        except Exception as e:
            print(f"❌ Error saving file: {e}")

    def _calculate_edition(self, date_str, date_obj):
        """
        Calculates the edition string, e.g., 251209_MON_1
        """
        day_str = date_obj.strftime('%a').upper()
        # Default to issue 1 for now. 
        # Real logic might need to check existing files to increment issue number.
        return f"{date_obj.strftime('%y%m%d')}_{day_str}_1"

    def find_article_by_url(self, url):
        """
        Attempts to find a saved JSON article file for the given URL.
        Uses the same hash logic as _save_to_individual_file to predict filename.
        """
        import hashlib
        import glob
        import json
        
        # 1. Calculate Expected Hash
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
        
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
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
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

