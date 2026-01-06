import os
import sys

# Add desk folder to path
script_dir = os.path.dirname(os.path.abspath(__file__))
desk_dir = os.path.dirname(script_dir)
sys.path.insert(0, desk_dir)

from src.core.firestore_client import FirestoreClient

def check_env():
    # Force initialize client
    db = FirestoreClient().db
    
    edition_code = '260106_8'
    
    for env in ['dev', 'release']:
        print(f"Checking env: {env}...")
        try:
            doc_ref = db.collection(env).document('data').collection('publications').document(edition_code)
            doc = doc_ref.get()
            if doc.exists:
                print(f"✅ Found {edition_code} in '{env}'")
                data = doc.to_dict()
                print(f"   Article count: {len(data.get('articles', []))}")
            else:
                print(f"❌ Not found in '{env}'")
        except Exception as e:
            print(f"⚠️ Error checking '{env}': {e}")

if __name__ == '__main__':
    check_env()
