
#!/usr/bin/env python
"""
Firestore Duplicate Finder
- Check for duplicates by URL
- Check for duplicates by Title (exact match)
"""
import os
import sys
import codecs
sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
from dotenv import load_dotenv
load_dotenv()
from src.db_client import DBClient
from collections import defaultdict

def find_duplicates():
    print("Connecting to Firestore...")
    db = DBClient()
    if not db.db:
        print("❌ Firestore Connection Failed")
        return

    print("Fetching articles...")
    docs = db.db.collection('articles').stream()
    
    by_url = defaultdict(list)
    by_title = defaultdict(list)
    
    total = 0
    for doc in docs:
        total += 1
        data = doc.to_dict()
        doc_id = doc.id
        
        url = data.get('url', '').strip()
        title = data.get('title_ko', '').strip()
        
        if url:
            by_url[url].append({'id': doc_id, 'title': title})
        
        if title:
            by_title[title].append({'id': doc_id, 'url': url})

    print(f"Total documents scanned: {total}")
    print("=" * 60)

    import json

    output = {
        "duplicate_urls": {},
        "duplicate_titles": {}
    }

    # 1. URL Duplicates
    dup_urls = {k: v for k, v in by_url.items() if len(v) > 1}
    output["duplicate_urls"] = dup_urls

    # 2. Title Duplicates
    dup_titles = {k: v for k, v in by_title.items() if len(v) > 1}
    output["duplicate_titles"] = dup_titles

    with open('duplicates.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print("Duplicates written to duplicates.json")

if __name__ == "__main__":
    find_duplicates()
