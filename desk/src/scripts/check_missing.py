import sys
import os
import hashlib
from src.core.firestore_client import FirestoreClient

# Setup path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def get_article_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:12]

def check():
    db = FirestoreClient()
    
    # 1. MLL_FAILED Case
    url_fail = "https://www.aitimes.com/news/articleView.html?idxno=205150"
    id_fail = get_article_id(url_fail)
    
    # 2. WORTHLESS Case
    url_worthless = "https://www.aitimes.com/news/articleView.html?idxno=205149"
    id_worthless = get_article_id(url_worthless)
    
    print(f"--- Check 1: MLL_FAILED ---")
    print(f"URL: {url_fail}")
    print(f"ID: {id_fail}")
    doc_fail = db.get_article(id_fail)
    print(f"Exists in DB? {'YES' if doc_fail else 'NO'}")
    if doc_fail: print(f"State: {doc_fail.get('_header', {}).get('state')}")

    print(f"\n--- Check 2: WORTHLESS ---")
    print(f"URL: {url_worthless}")
    print(f"ID: {id_worthless}")
    doc_worthless = db.get_article(id_worthless)
    print(f"Exists in DB? {'YES' if doc_worthless else 'NO'}")
    if doc_worthless: print(f"State: {doc_worthless.get('_header', {}).get('state')}")

if __name__ == "__main__":
    check()
