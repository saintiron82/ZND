# -*- coding: utf-8 -*-
import os
import glob
import hashlib
from src.db_client import DBClient

class TrashManager:
    def __init__(self, cache_dir_path):
        """
        :param cache_dir_path: Path to the root cache directory (e.g. 'desk/cache')
        """
        self.cache_dir = cache_dir_path
        self.db = DBClient()

    def dispose_items(self, urls):
        """
        Permanently delete content files for the given URLs, 
        but mark them as REJECTED in DB to prevent re-crawling.
        
        :param urls: List of URL strings
        :return: dict with 'deleted_count' and 'errors'
        """
        deleted_count = 0
        errors = []

        for url in urls:
            try:
                # 1. Update DB Status to REJECTED (Reason: permanent_delete)
                # This ensures crawler skips it in the future.
                self.db.save_history(url, 'REJECTED', reason='permanent_delete')

                # 2. Find and Delete Cache Files
                # Hash logic must match crawler's saving logic
                url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()[:8]
                
                # Search recursively: cache_dir/**/{source_id}_{hash}.json
                # Since source_id might vary, we search by hash suffix.
                # Pattern: *_{hash}.json
                search_pattern = os.path.join(self.cache_dir, '**', f'*_{url_hash}.json')
                found_files = glob.glob(search_pattern, recursive=True)

                if not found_files:
                    # It's possible file is already gone but we just wanted to ensure DB is updated
                    continue

                for filepath in found_files:
                    try:
                        os.remove(filepath)
                        print(f"🔥 [Trash] Deleted file: {filepath}")
                    except OSError as e:
                        errors.append(f"Failed to delete {filepath}: {e}")

                deleted_count += len(found_files)

            except Exception as e:
                errors.append(f"Error processing {url}: {e}")

        result = {
            'success': True,
            'deleted_files_count': deleted_count,
            'processed_urls': len(urls),
            'errors': errors
        }
        
        if errors:
            print(f"⚠️ [Trash] Errors occurred: {errors}")
            
        return result
