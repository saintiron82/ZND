import sys
import os
from datetime import datetime, timezone

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.core.firestore_client import FirestoreClient
from src.core.article_state import ArticleState

def reset_releases():
    """
    모든 발행 기록을 초기화하고, 기사 상태를 '분류됨(CLASSIFIED)'으로 되돌립니다.
    """
    db = FirestoreClient()
    print("🚀 Starting Publication Reset Protocol...")
    
    # 1. Revert Article States (PUBLISHED/RELEASED -> CLASSIFIED)
    print("\n[Step 1] Reverting Article States...")
    
    # Target states to revert
    target_states = [ArticleState.PUBLISHED.value, ArticleState.RELEASED.value]
    reverted_count = 0
    
    # Use direct collection access for batch processing
    articles_ref = db._get_collection('articles')
    
    for state in target_states:
        # Query articles in this state
        docs = articles_ref.where('_header.state', '==', state).stream()
        
        for doc in docs:
            data = doc.to_dict()
            article_id = data.get('_header', {}).get('article_id') or doc.id
            title = data.get('_original', {}).get('title', 'Unknown Title')
            
            # Update state to CLASSIFIED
            # Note: We manually update to preserve other data, just resetting state/pub info
            updates = {
                '_header.state': ArticleState.CLASSIFIED.value,
                '_header.updated_at': datetime.now(timezone.utc).isoformat(),
                # We also need to clear specific publication data if possible, 
                # but essential is just the state change so they appear in Desk.
                '_publication': None 
            }
            
            try:
                # Use update directly
                articles_ref.document(article_id).update(updates)
                print(f"  - Reverted: {article_id} ({title[:30]}...)")
                reverted_count += 1
            except Exception as e:
                print(f"  ❌ Failed to revert {article_id}: {e}")

    print(f"✅ Reverted {reverted_count} articles to 'CLASSIFIED'.")

    # 2. Delete Publications Collection
    print("\n[Step 2] Deleting Publication History...")
    
    pub_ref = db._get_collection('publications')
    docs = pub_ref.stream()
    deleted_count = 0
    
    for doc in docs:
        try:
            doc.reference.delete()
            print(f"  - Deleted publication doc: {doc.id}")
            deleted_count += 1
        except Exception as e:
            print(f"  ❌ Failed to delete {doc.id}: {e}")
            
    print(f"✅ Deleted {deleted_count} publication documents.")
    
    # 3. Reset Meta (Optional, but good for clean slate)
    # Since we deleted ALL documents above, _meta is also gone.
    # We should re-initialize an empty _meta or just leave it to be created on first publish.
    # ArticleManager logic handles missing meta gracefully, but let's be safe.
    
    print("\n[Step 3] Initializing Empty Meta...")
    initial_meta = {
        'issues': [],
        'latest_updated_at': datetime.now(timezone.utc).isoformat(),
        'schema_version': '3.0'
    }
    try:
        pub_ref.document('_meta').set(initial_meta)
        print("✅ Publication meta initialized.")
    except Exception as e:
        print(f"❌ Failed to init meta: {e}")

    print("\n✨ Reset Complete! You can now start publishing from Issue #1.")

if __name__ == "__main__":
    choice = input("⚠️  WARNING: This will DELETE all publication history and reset article states. Continue? (y/n): ")
    if choice.lower() == 'y':
        reset_releases()
    else:
        print("Aborted.")
