
import os
import json
import glob
from datetime import datetime
from src.core_logic import DATA_DIR, CACHE_DIR

BATCH_DIR = os.path.join(CACHE_DIR, 'batches')

def ensure_batch_dir():
    os.makedirs(BATCH_DIR, exist_ok=True)

def get_batches():
    """
    List all batches.
    Returns list of dicts: {batch_id, status, count, created_at, title}
    """
    ensure_batch_dir()
    batches = []
    files = glob.glob(os.path.join(BATCH_DIR, '*.json'))
    
    for fpath in files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                batches.append({
                    'batch_id': data.get('batch_id'),
                    'status': data.get('status', 'PENDING'), # PENDING or PUBLISHED
                    'count': data.get('count', 0),
                    'created_at': data.get('created_at'),
                    'title': data.get('title', f"Batch {data.get('batch_id')}")
                })
        except Exception:
            pass
            
    # Sort by batch_id descending (newest first)
    batches.sort(key=lambda x: x.get('batch_id', ''), reverse=True)
    return batches

def create_batch():
    """
    Scans for ACCEPTED articles without batch_id and creates a new batch.
    """
    ensure_batch_dir()
    
    # 1. Find Candidates
    candidates = []
    candidate_files = []
    
    print(f"DEBUG: Starting batch creation scan in {DATA_DIR}")
    
    # Scan all data folders
    if os.path.exists(DATA_DIR):
        for date_folder in os.listdir(DATA_DIR):
            date_path = os.path.join(DATA_DIR, date_folder)
            if not os.path.isdir(date_path): continue
            
            print(f"DEBUG: Scanning folder {date_folder}")
            
            for filename in os.listdir(date_path):
                if not filename.endswith('.json') or filename in ['index.json', 'daily_summary.json']:
                    continue
                
                filepath = os.path.join(date_path, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        
                        # Debugging specific skip reasons
                        if data.get('batch_id'):
                            # print(f"DEBUG: Skipping {filename} (Already in batch {data['batch_id']})")
                            continue
                            
                        # Important: Check if status is ACCEPTED?
                        # Manual verified files should be trusted. 
                        # Relaxing checks for existing files without status field.
                        status = data.get('status', 'ACCEPTED') # Default to ACCEPTED if missing
                        if status != 'ACCEPTED':
                             print(f"DEBUG: Skipping {filename} (Status: {status})")
                             continue 
                            
                        print(f"DEBUG: Found candidate: {filename}")
                        candidates.append(data)
                        candidate_files.append(filepath)
                except Exception as e:
                    print(f"DEBUG: Error reading {filename}: {e}")

    print(f"DEBUG: Total candidates found: {len(candidates)}")

    if not candidates:
        return None, "No pending articles found (All processed or none accepted)."
        
    # 2. Generate Batch ID based on simple counter for today? 
    # Or just YYYYMMDD-HHMMSS to be safe and sortable.
    now_str = datetime.now().strftime('%Y%m%d-%H%M%S')
    batch_id = now_str
    
    # 3. Create Manifest
    batch_data = {
        "batch_id": batch_id,
        "created_at": datetime.now().isoformat(),
        "status": "PENDING",
        "count": len(candidates),
        "articles": [] 
    }
    
    # 4. Update Articles
    updated_count = 0
    for i, article in enumerate(candidates):
        fpath = candidate_files[i]
        
        # Add batch info
        article['batch_id'] = batch_id
        article['typeset_at'] = datetime.now().isoformat()
        
        # Add to manifest list (lightweight)
        batch_data['articles'].append({
            "article_id": article.get('article_id'),
            "title": article.get('title_ko', article.get('title')),
            "url": article.get('url'),
            "file_path": fpath # Store path for easy access/revert
        })
        
        # Save back to file
        try:
            with open(fpath, 'w', encoding='utf-8') as f:
                json.dump(article, f, ensure_ascii=False, indent=2)
            updated_count += 1
        except Exception as e:
            print(f"Error updating article {fpath}: {e}")
            
    # 5. Save Manifest
    batch_path = os.path.join(BATCH_DIR, f"{batch_id}.json")
    with open(batch_path, 'w', encoding='utf-8') as f:
        json.dump(batch_data, f, ensure_ascii=False, indent=2)
        
    return batch_id, f"Created batch {batch_id} with {updated_count} articles."

def publish_batch(batch_id):
    ensure_batch_dir()
    batch_path = os.path.join(BATCH_DIR, f"{batch_id}.json")
    
    if not os.path.exists(batch_path):
        return False, "Batch not found"
        
    try:
        with open(batch_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        if data.get('status') == 'PUBLISHED':
            return False, "Already published"
            
        # Update Batch Status
        data['status'] = 'PUBLISHED'
        data['published_at'] = datetime.now().isoformat()
        
        # Update Articles? (Optional, but good for consistency)
        # Iterate over articles in manifest
        articles = data.get('articles', [])
        for item in articles:
            fpath = item.get('file_path')
            if fpath and os.path.exists(fpath):
                try:
                    with open(fpath, 'r', encoding='utf-8') as af:
                        adata = json.load(af)
                    
                    adata['published_at'] = data['published_at']
                    
                    with open(fpath, 'w', encoding='utf-8') as af:
                        json.dump(adata, af, ensure_ascii=False, indent=2)
                except:
                    pass
        
        # Save Batch
        with open(batch_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        return True, "Batch published successfully"
        
    except Exception as e:
        return False, str(e)

def discard_batch(batch_id):
    """
    Discard a batch: Release articles (remove batch_id) and delete batch file.
    """
    ensure_batch_dir()
    batch_path = os.path.join(BATCH_DIR, f"{batch_id}.json")
    
    if not os.path.exists(batch_path):
        return False, "Batch not found"
        
    try:
        with open(batch_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Revert articles
        articles = data.get('articles', [])
        reverted_count = 0
        
        for item in articles:
            fpath = item.get('file_path')
            if fpath and os.path.exists(fpath):
                try:
                    with open(fpath, 'r', encoding='utf-8') as af:
                        adata = json.load(af)
                    
                    # Remove batch info
                    if 'batch_id' in adata: del adata['batch_id']
                    if 'typeset_at' in adata: del adata['typeset_at']
                    if 'published_at' in adata: del adata['published_at']
                    
                    with open(fpath, 'w', encoding='utf-8') as af:
                        json.dump(adata, af, ensure_ascii=False, indent=2)
                    reverted_count += 1
                except:
                    pass
                    
        # Delete Batch File
        os.remove(batch_path)
        
        return True, f"Batch discarded. {reverted_count} articles released."
        
    except Exception as e:
        return False, str(e)
