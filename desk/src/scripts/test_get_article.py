import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.core.firestore_client import FirestoreClient

def test_get_article():
    db = FirestoreClient()
    
    # Test with known article_id from cache
    article_id = "b27bbc854062"
    print(f"Testing get_article('{article_id}')...")
    
    result = db.get_article(article_id)
    
    if result:
        print(f"✅ Found! State: {result.get('_header', {}).get('state')}")
        print(f"   Title: {result.get('_original', {}).get('title', '')[:50]}...")
    else:
        print(f"❌ Not Found!")
        
        # Debug: Check glob manually
        import glob
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cache_root = os.path.join(base_dir, 'cache')
        pattern = os.path.join(cache_root, '*', f'{article_id}.json')
        print(f"   Pattern: {pattern}")
        found = glob.glob(pattern)
        print(f"   Glob results: {found}")

if __name__ == "__main__":
    test_get_article()
