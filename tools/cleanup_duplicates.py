
import sys
import os
import traceback
from datetime import datetime

# Add desk root to path
sys.path.append(os.path.join(os.getcwd(), 'desk'))

from dotenv import load_dotenv

def main():
    try:
        print("Loading environment...", flush=True)
        load_dotenv(os.path.join(os.getcwd(), 'desk', '.env'))
        
        from src.core.article_manager import ArticleManager
        from src.core.article_state import ArticleState

        print("Initializing ArticleManager...", flush=True)
        manager = ArticleManager()
        
        limit_cnt = 1000
        print(f"Fetching articles (limit={limit_cnt})...", flush=True)
        
        # Reference: PUBLISHED + RELEASED
        published = manager.db.list_articles_by_state(ArticleState.PUBLISHED.value, limit=limit_cnt)
        released = manager.db.list_articles_by_state(ArticleState.RELEASED.value, limit=limit_cnt)
        refs = published + released
        
        # Target: COLLECTED (중복 후보)
        collected = manager.db.list_articles_by_state(ArticleState.COLLECTED.value, limit=limit_cnt)
        
        print(f"Ref(Published/Released): {len(refs)}")
        print(f"Target(Collected): {len(collected)}")
        
        # Build Map
        def normalize_url(u):
            if not u: return ""
            u = u.replace("http://", "").replace("https://", "").replace("www.", "")
            u = u.split("?")[0] 
            if u.endswith("/"): u = u[:-1]
            return u.strip()
            
        def normalize_title(t):
            if not t: return ""
            return t.strip().replace(" ", "")  # 공백 제거

        ref_map_url = {}
        ref_map_title = {}
        
        for r in refs:
            rid = r.get('id') or r.get('_header', {}).get('article_id')
            url = r.get('_header', {}).get('url') or r.get('url')
            title = r.get('_original', {}).get('title', '')
            
            if url: ref_map_url[normalize_url(url)] = rid
            if title: ref_map_title[normalize_title(title)] = rid
            
        # Scan & Reject
        count = 0
        print("\nScanning for duplicates...", flush=True)
        
        for c in collected:
            cid = c.get('id') or c.get('_header', {}).get('article_id')
            curl = c.get('_header', {}).get('url') or c.get('url')
            ctitle = c.get('_original', {}).get('title', '')
            
            match_id = None
            reason = ""
            
            # 1. URL Check
            if curl:
                nurl = normalize_url(curl)
                if nurl in ref_map_url:
                    match_id = ref_map_url[nurl]
                    reason = "URL Match"
                    
            # 2. Title Check
            if not match_id and ctitle:
                ntitle = normalize_title(ctitle)
                if ntitle in ref_map_title:
                    match_id = ref_map_title[ntitle]
                    reason = f"Title Match"
                    
            if match_id and match_id != cid:
                try:
                    # Windows 콘솔 출력 깨짐 방지: encode/decode
                    log_title = ctitle.encode('utf-8', 'ignore').decode('utf-8')
                    print(f"♻️ Duplicate: {cid} (matches {match_id}) - {reason}")
                    
                    # Manual Reject (Bypass Registry check)
                    now = datetime.now()
                    updates = {
                        '_header.state': ArticleState.REJECTED.value,
                        '_header.updated_at': now,
                        '_rejection': {
                            'reason': 'duplicate_cleanup',
                            'rejected_at': now,
                            'rejected_by': 'cleanup_script'
                        }
                    }
                    
                    manager.db.update_article(cid, updates)
                    
                    # History 업데이트 (URL이 있는 경우)
                    if curl:
                        manager.db.update_history(curl, cid, ArticleState.REJECTED.value)
                    
                    print(f"   ✅ Rejected.")
                    count += 1
                except Exception as ex:
                    print(f"   ❌ Failed: {ex}")

        print(f"\nTotal duplicates rejected: {count}")
        
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
