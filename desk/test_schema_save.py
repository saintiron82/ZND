import os
import json
from datetime import datetime, timezone
from src.db_client import DBClient

# Mock MLL Response with new schema
mock_mll_response = {
    "title_ko": "테스트 기사 제목",
    "summary": "테스트 요약입니다.",
    "zero_echo_score": 2.5,
    "impact_score": 8.0,
    "impact_evidence": {
        "entity": {"id": "TEST_ENTITY", "weight": 5.0, "reasoning": "Test reasoning"},
        "events": [{"id": "TEST_EVENT", "weight": 3.0, "reasoning": "Test event"}]
    },
    "reasoning": "Test overall reasoning",
    "tags": ["TEST_TAG_1", "TEST_TAG_2"],
    "evidence": {
        "penalties": [],
        "credits": [],
        "modifiers": []
    }
}

def test_save():
    print("🚀 Starting save test...")
    db = DBClient()
    
    link = "https://example.com/test_schema_v2"
    target_id = "test_source"
    
    final_doc = {
        **mock_mll_response,
        "url": link,
        "source_id": target_id,
        "crawled_at": datetime.now(timezone.utc),
        "original_title": "Original English Title"
    }
    
    print(f"💾 Saving document with ZS: {final_doc['zero_echo_score']}, IS: {final_doc['impact_score']}")
    
    try:
        db.save_article(final_doc)
        print("✅ Save function called successfully.")
    except Exception as e:
        print(f"❌ Save failed: {e}")

    # Verify file existence
    # We need to find where it was saved. DBClient prints the path.
    # But we can also check the directory.
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', today)
    
    if os.path.exists(data_dir):
        files = os.listdir(data_dir)
        print(f"📂 Files in {data_dir}: {files}")
        found = False
        for f in files:
            if "test_source" in f:
                print(f"✅ Found saved file: {f}")
                found = True
                
                # Verify content
                with open(os.path.join(data_dir, f), 'r', encoding='utf-8') as json_file:
                    saved_data = json.load(json_file)
                    if saved_data.get('zero_echo_score') == 2.5:
                        print("✅ zero_echo_score matches.")
                    else:
                        print(f"❌ zero_echo_score mismatch: {saved_data.get('zero_echo_score')}")
                        
                    if saved_data.get('impact_score') == 8.0:
                        print("✅ impact_score matches.")
                    else:
                        print(f"❌ impact_score mismatch: {saved_data.get('impact_score')}")
                break
        
        if not found:
            print("❌ Could not find saved file for test_source.")
    else:
        print(f"❌ Directory {data_dir} does not exist.")

if __name__ == "__main__":
    test_save()
