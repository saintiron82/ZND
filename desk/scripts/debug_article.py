import os
import sys
import json

# Add desk folder to path
script_dir = os.path.dirname(os.path.abspath(__file__))
desk_dir = os.path.dirname(script_dir)
sys.path.insert(0, desk_dir)

from src.core.firestore_client import FirestoreClient

def inspect_article():
    # Force initialize client
    db = FirestoreClient().db
    
    article_id = 'd093f65c8e01'
    
    for env in ['dev', 'release']:
        print(f"\n--- Checking env: {env} ---")
        try:
            doc_ref = db.collection(env).document('data').collection('articles').document(article_id)
            doc = doc_ref.get()
            if doc.exists:
                print(f"✅ Found {article_id} in '{env}'")
                data = doc.to_dict()
                print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
            else:
                print(f"❌ Not found in '{env}'")
        except Exception as e:
            print(f"⚠️ Error checking '{env}': {e}")

if __name__ == '__main__':
    inspect_article()
