import sys
import os
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.db_client import DBClient

def check_firebase_data():
    db = DBClient()
    issues = db.get_issues_from_meta()
    
    if not issues:
        print("No issues found.")
        return

    # Get latest issue
    latest_issue = issues[0]
    publish_id = latest_issue.get('id') or latest_issue.get('edition_code')
    print(f"Checking latest issue: {publish_id}")
    
    data = db.get_publication(publish_id)
    if not data:
        print("Issue data not found.")
        return
        
    articles = data.get('articles', [])
    print(f"Total articles: {len(articles)}")
    
    if articles:
        print("\n--- First Article Sample ---")
        first_article = articles[0]
        print(json.dumps(first_article, indent=2, ensure_ascii=False))
        
        # Check required fields
        required_fields = ['id', 'title_ko', 'summary', 'zero_echo_score', 'origin_published_at']
        missing = [f for f in required_fields if f not in first_article]
        
        if missing:
            print(f"\n⚠️ Missing fields: {missing}")
        else:
            print("\n✅ All key fields present.")

if __name__ == "__main__":
    check_firebase_data()
