import sys
import os
from google.cloud.firestore import FieldFilter

# Setup Path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.core.firestore_client import FirestoreClient

def test_query_v2():
    db = FirestoreClient()
    collection = db._get_collection('articles')
    
    print("--- Test 1: Explicit Kwargs ---")
    try:
        # Based on warning: Prefer using the 'filter' keyword argument instead. 
        # But 'filter' usually takes a Filter object.
        # Maybe it meant: where(field_path=..., op_string=..., value=...)
        query = collection.where(field_path='_header.state', op_string='==', value='ANALYZED').limit(5)
        docs = list(query.stream())
        print(f"Result count: {len(docs)}")
    except Exception as e:
        print(f"Test 1 Failed: {e}")

    print("\n--- Test 2: FieldFilter ---")
    try:
        # New style
        query = collection.where(filter=FieldFilter('_header.state', '==', 'ANALYZED')).limit(5)
        docs = list(query.stream())
        print(f"Result count: {len(docs)}")
        for doc in docs:
             print(f"Found: {doc.id}")
    except Exception as e:
        print(f"Test 2 Failed: {e}")

    print("\n--- Test 3: Standard but check first doc ---")
    try:
        # Check if ANY document has _header.state
        docs = list(collection.limit(5).stream())
        for doc in docs:
            data = doc.to_dict()
            state = data.get('_header', {}).get('state')
            print(f"Doc {doc.id}: state='{state}' (type: {type(state)})")
    except Exception as e:
        print(f"Test 3 Failed: {e}")

if __name__ == "__main__":
    test_query_v2()
