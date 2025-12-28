
import os
import sys

# 경로 설정
sys.path.append(os.path.join(os.getcwd(), 'src'))

from src.db_client import DBClient
from src.core.article_registry import ArticleRegistry

def diagnose():
    print("--- 1. DB Connection Test ---")
    db = DBClient()
    if db.db:
        print("✅ DB Connected")
    else:
        print("❌ DB Connection Failed")
        return

    article_id = "c41fcc21aec4"
    
    print(f"\n--- 2. Firestore Document Check ({article_id}) ---")
    doc = db.get_article(article_id)
    if doc:
        print(f"✅ Document Exists. State: {doc.get('_header', {}).get('state', doc.get('state'))}")
    else:
        print("❌ Document Not Found in Firestore")

    print(f"\n--- 3. Registry Lazy Load Test ---")
    registry = ArticleRegistry()
    # Force reset initialization state for test
    ArticleRegistry._initialized = False 
    registry.initialize(db_client=db)
    
    info = registry.get(article_id)
    if info:
        print(f"✅ Found in Registry Memory: State={info.state}")
    else:
        print("⚠️ Not in Memory, trying Lazy Load...")
        info = registry.find_and_register(article_id)
        if info:
             print(f"✅ Lazy Load Successful: State={info.state}")
             print(f"   Cache Path: {info.cache_path}")
        else:
             print("❌ Lazy Load Failed")

if __name__ == "__main__":
    diagnose()
