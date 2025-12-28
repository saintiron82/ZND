import os
import json
import shutil
from datetime import datetime
import glob

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, 'cache')

def get_date_from_iso(iso_str):
    if not iso_str:
        return None
    try:
        # Handle various ISO formats
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d')
    except ValueError:
        return None

def reorganize():
    print(f"📂 Scanning cache directory: {CACHE_DIR}")
    
    moved_count = 0
    total_count = 0
    
    # Iterate all date folders
    for date_folder in os.listdir(CACHE_DIR):
        folder_path = os.path.join(CACHE_DIR, date_folder)
        if not os.path.isdir(folder_path):
            continue
            
        # Parse folder date to verify validity
        try:
            folder_date = datetime.strptime(date_folder, '%Y-%m-%d').strftime('%Y-%m-%d')
        except ValueError:
            print(f"⚠️ Skipping non-date folder: {date_folder}")
            continue
            
        # Iterate files in folder
        for filename in os.listdir(folder_path):
            if not filename.endswith('.json'):
                continue
                
            filepath = os.path.join(folder_path, filename)
            total_count += 1
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Determine correct date
                # Priority: crawled_at > cached_at > saved_at > staged_at
                date_str = data.get('crawled_at') or data.get('cached_at') or data.get('saved_at') or data.get('staged_at')
                correct_date = get_date_from_iso(date_str)
                
                if not correct_date:
                    print(f"⚠️ Could not determine date for {filename}, skipping.")
                    continue
                    
                # If mismatch, move
                if correct_date != folder_date:
                    target_dir = os.path.join(CACHE_DIR, correct_date)
                    target_path = os.path.join(target_dir, filename)
                    
                    if not os.path.exists(target_dir):
                        os.makedirs(target_dir)
                        
                    # Handle name collision? (Overwrite or Rename)
                    # Policy: Overwrite if moving to correct location (assuming content is same object)
                    # But be careful.
                    
                    if os.path.exists(target_path):
                         print(f"⚠️ Target exists: {target_path}. Overwriting.")
                    
                    shutil.move(filepath, target_path)
                    moved_count += 1
                    print(f"🚚 Moved {filename}: {folder_date} -> {correct_date}")
                    
            except Exception as e:
                print(f"❌ Error processing {filename}: {e}")

    print(f"\n✅ Reorganization Complete.")
    print(f"Total scanned: {total_count}")
    print(f"Files moved: {moved_count}")

if __name__ == "__main__":
    reorganize()
