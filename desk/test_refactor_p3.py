import sys
import os

# Set up path
sys.path.append(os.path.abspath("d:/ZND/desk"))

print("Testing imports...")
try:
    from src.pipeline import get_db
    print(" Import src.pipeline: OK")
    
    db = get_db()
    print(f" Get DB instance: OK ({type(db).__name__})")
    
    from src.core.firestore_client import FirestoreClient
    if isinstance(db, FirestoreClient):
        print(" DB is FirestoreClient: OK")
    else:
        print(f" FAIL: DB is {type(db)}")
        
except Exception as e:
    print(f" FAIL: {e}")
    import traceback
    traceback.print_exc()
