# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, 'src')

from core.firestore_client import FirestoreClient

db = FirestoreClient()

print("="*50)
print("=== Firestore 데이터 확인 ===")
print("="*50)

# 1. _meta 확인
print("\n📋 Publications _meta:")
meta = db.get_publications_meta()
if meta:
    issues = meta.get('issues', [])
    print(f"   Total issues: {len(issues)}")
    for iss in issues[:5]:
        code = iss.get('edition_code') or iss.get('code')
        status = iss.get('status')
        count = iss.get('article_count') or iss.get('count', 0)
        print(f"   - {code}: {status} ({count} articles)")
else:
    print("   ❌ _meta not found")

# 2. Articles by state 확인
print("\n📰 Articles by State (from Firestore query):")
states = ['COLLECTED', 'ANALYZED', 'CLASSIFIED', 'PUBLISHED', 'REJECTED']
for state in states:
    articles = db.list_articles_by_state(state, limit=10)
    print(f"   {state}: {len(articles)} articles")

# 3. Usage stats
print("\n📊 Firestore Usage Stats:")
stats = db.get_usage_stats()
print(f"   Reads: {stats.get('reads', 0)}")
print(f"   Writes: {stats.get('writes', 0)}")
