
import os
import sys

# Add desk folder to path
script_dir = os.path.dirname(os.path.abspath(__file__))
desk_dir = os.path.dirname(script_dir)
sys.path.insert(0, desk_dir)

from src.core.firestore_client import FirestoreClient

def list_meta_issues():
    db = FirestoreClient()
    
    print(f"🌍 Checking environment: {os.getenv('ZND_ENV', 'release')}")
    
    meta = db.get_publications_meta()
    if not meta:
        print("❌ No publications meta found")
        return

    print(f"📅 Latest Updated: {meta.get('latest_updated_at')}")
    print(f"📚 Issues found: {len(meta.get('issues', []))}")
    
    for issue in meta.get('issues', [])[-10:]: # Show last 10
        code = issue.get('edition_code') or issue.get('code')
        name = issue.get('edition_name') or issue.get('name')
        updated = issue.get('updated_at')
        print(f" - [{code}] {name} (Updated: {updated})")

if __name__ == '__main__':
    list_meta_issues()
