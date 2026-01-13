
import sys
import os
import traceback

# Add desk root to path
sys.path.append(os.path.join(os.getcwd(), 'desk'))
# Add crawler root to path (if needed)

from dotenv import load_dotenv

def main():
    try:
        print("Loading environment...", flush=True)
        # Load .env from desk
        load_dotenv(os.path.join(os.getcwd(), 'desk', '.env'))
        
        # Import after path setup
        from src.core.article_manager import ArticleManager
        from src.core.article_state import ArticleState

        print("Initializing ArticleManager...", flush=True)
        manager = ArticleManager()
        
        print("Fetching articles (lightweight)...", flush=True)
        # manager.find_by_state calls get() for each, which is slow without cache.
        # Use db directly for bulk check.
        
        limit_cnt = 300
        
        published = manager.db.list_articles_by_state(ArticleState.PUBLISHED.value, limit=limit_cnt)
        released = manager.db.list_articles_by_state(ArticleState.RELEASED.value, limit=limit_cnt)
        collected = manager.db.list_articles_by_state(ArticleState.COLLECTED.value, limit=limit_cnt)
        
        published_all = published + released
        
        print(f"Found {len(published_all)} published/released articles.")
        print(f"Found {len(collected)} collected articles.")
        
        print("\nComparing...", flush=True)
        
        duplicates = []
        
        # URL Normalization helper
        def normalize_url(u):
            if not u: return ""
            # 프로토콜 제거, www 제거, 쿼리 스트링 제거, 끝 슬래시 제거
            u = u.replace("http://", "").replace("https://", "").replace("www.", "")
            u = u.split("?")[0] 
            if u.endswith("/"): u = u[:-1]
            return u.strip()
            
        def normalize_title(t):
            if not t: return ""
            return t.strip().replace(" ", "")

        pub_map = {} # norm_url -> article
        title_map = {} # title -> article

        for p in published_all:
            url = p.get('_header', {}).get('url') or p.get('url')
            title = p.get('_original', {}).get('title', '')
            
            p_id = p.get('_header', {}).get('article_id')
            if not p_id: continue
                
            if url:
                norm = normalize_url(url)
                pub_map[norm] = p
                
            if title:
                clean_title = normalize_title(title)
                if clean_title:
                    title_map[clean_title] = p
                
        # Check collected
        for c in collected:
            c_url = c.get('_header', {}).get('url') or c.get('url')
            c_title = c.get('_original', {}).get('title', '')
            c_id = c.get('_header', {}).get('article_id')
            
            if not c_id: continue
            
            # Skip if ID matches (it's the same document, not a duplicate copy)
            # But wait, published and collected are different states. 
            # If ID is same, it means state is one specific thing.
            # An article cannot be both PUBLISHED and COLLECTED at the same time in standard logic,
            # unless we fetched snapshot... 
            # find_by_state queries by state. So IDs *should* be unique across these lists usually.
            # But if Firestore consistency is weak, maybe? 
            # Anyway, if ID is distinct, it's a double entry.
            
            reason = []
            match_p = None
            
            # 1. Check URL
            if c_url:
                norm = normalize_url(c_url)
                if norm in pub_map:
                    match_p = pub_map[norm]
                    if match_p.get('_header', {}).get('article_id') != c_id:
                        reason.append(f"URL Match")
    
            # 2. Check Title
            if not match_p and c_title:
                 clean_title = normalize_title(c_title)
                 if clean_title and clean_title in title_map:
                     match_p = title_map[clean_title]
                     if match_p.get('_header', {}).get('article_id') != c_id:
                         reason.append(f"Title Match ({c_title})")
                 
            if match_p:
                duplicates.append({
                    'collected': c,
                    'published': match_p,
                    'reason': reason
                })
                
        print(f"\nFound {len(duplicates)} duplicates!")
        for d in duplicates:
            c = d['collected']
            p = d['published']
            
            c_id = c.get('_header', {}).get('article_id') or c.get('id')
            p_id = p.get('_header', {}).get('article_id') or p.get('id')
            
            # 이미 같은 ID면 패스 (상태 쿼리가 겹칠 리는 없지만)
            if c_id == p_id: continue
            
            print("-" * 50)
            print(f"COLLECTED: {c_id} / {c.get('_original', {}).get('title')}")
            print(f"PUBLISHED: {p_id} / {p.get('_original', {}).get('title')}")
            print(f"Reason: {d['reason']}")
            print(f"COLLECTED URL: {c.get('_header', {}).get('url')}")
            print(f"PUBLISHED URL: {p.get('_header', {}).get('url')}")
    
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
