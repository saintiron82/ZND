import sys
import os
import hashlib

# Setup Path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# Add crawler path just in case
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '..', 'crawler'))

from src.core.firestore_client import FirestoreClient

def check_article(url):
    db = FirestoreClient()
    article_id = hashlib.md5(url.encode()).hexdigest()[:12]
    print(f"Checking URL: {url}")
    print(f"Article ID: {article_id}")
    
    doc = db._get_collection('articles').document(article_id).get()
    
    if doc.exists:
        print(f"✅ Document Exists!")
        data = doc.to_dict()
        print(f"State: {data.get('_header', {}).get('state')}")
        print(f"Title: {data.get('_original', {}).get('title')}")
    else:
        print(f"❌ Document NOT Found.")

if __name__ == "__main__":
    check_article("https://www.aitimes.com/news/articleView.html?idxno=205150")
