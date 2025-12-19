
import json
import sys
from dotenv import load_dotenv
load_dotenv()
from src.db_client import DBClient

def delete_duplicates():
    print("Loading duplicates.json...")
    try:
        with open('duplicates.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("duplicates.json not found!")
        return

    db = DBClient()
    if not db.db:
        print("Firestore not connected")
        return

    to_delete = set()
    
    # Process URL duplicates
    print("Processing URL duplicates...")
    for url, items in data.get("duplicate_urls", {}).items():
        if len(items) > 1:
            # Keep the first one, delete the rest
            keep_id = items[0]['id']
            for item in items[1:]:
                to_delete.add(item['id'])
                
    # Process Title duplicates (be careful not to double delete or delete the one we decided to keep above)
    # Actually, if we delete based on URL, we solve most title dupes if they share URL.
    # If they have different URLs but same title, we might want to keep checking.
    
    print("Processing Title duplicates...")
    for title, items in data.get("duplicate_titles", {}).items():
        if len(items) > 1:
            # Check which ones are already marked for deletion
            candidates = [item for item in items if item['id'] not in to_delete]
            
            if len(candidates) > 1:
                 # Keep first of remaining
                 for item in candidates[1:]:
                     to_delete.add(item['id'])

    print(f"Found {len(to_delete)} documents to delete.")
    
    if not to_delete:
        print("Nothing to delete.")
        return

    confirm = input("Type 'yes' to proceed with deletion: ")
    if confirm.lower() != 'yes':
        print("Aborted.")
        return

    count = 0
    for doc_id in to_delete:
        try:
            db.db.collection('articles').document(doc_id).delete()
            print(f"Deleted {doc_id}")
            count += 1
        except Exception as e:
            print(f"Failed to delete {doc_id}: {e}")

    print(f"Deleted {count} duplicates.")

if __name__ == "__main__":
    delete_duplicates()
