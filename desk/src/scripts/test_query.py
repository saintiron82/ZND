import sys
import os

# Setup Path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.core.firestore_client import FirestoreClient

def test_query():
    db = FirestoreClient()
    collection = db._get_collection('articles')
    
    print("Testing query: where('_header.state', '==', 'ANALYZED')")
    try:
        query = collection.where('_header.state', '==', 'ANALYZED').limit(5)
        docs = list(query.stream())
        print(f"Result count: {len(docs)}")
        for doc in docs:
            print(f"Found: {doc.id}")
            
    except Exception as e:
        print(f"Query Failed: {e}")

if __name__ == "__main__":
    test_query()
