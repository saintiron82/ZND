import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# Add desk directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load .env
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

print(f"Loaded .env from {env_path}")
print(f"FIREBASE_SERVICE_ACCOUNT_KEY: {os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')}")

from src.db_client import DBClient
from src.pipeline import get_db

def test_db_connection():
    print("Testing DB connection...")
    try:
        # Test 1: Direct DBClient
        print("\n[Test 1] Direct DBClient initialization")
        db_client = DBClient()
        if db_client.db:
            print("✅ DBClient connected successfully.")
        else:
            print("❌ DBClient failed to connect.")
            return

        # Test 2: get_db from pipeline
        print("\n[Test 2] get_db() from pipeline")
        pipeline_db = get_db()
        if pipeline_db and pipeline_db.db:
             print("✅ get_db() returned connected client.")
        else:
             print("❌ get_db() returned None or disconnected client.")

        # Test 3: Fetch Publications
        print("\n[Test 3] Fetching Publications (get_issues_by_date)")
        issues = db_client.get_issues_by_date()
        print(f"Found {len(issues)} issues.")
        for issue in issues[:3]:
            print(f" - {issue.get('edition_name')} (Status: {issue.get('status')}, ID: {issue.get('id')})")

        # Test 4: Fetch Articles for latest issue
        if issues:
            latest_issue = issues[0]
            publish_id = latest_issue.get('id')
            print(f"\n[Test 4] Fetching articles for issue {publish_id}")
            articles = db_client.get_articles_by_publish_id(publish_id)
            print(f"Found {len(articles)} articles.")
            for art in articles[:3]:
                 print(f" - {art.get('title_ko')}")
        else:
            print("\n⚠️ No issues found, skipping article fetch test.")

    except Exception as e:
        print(f"❌ Exception occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_db_connection()
