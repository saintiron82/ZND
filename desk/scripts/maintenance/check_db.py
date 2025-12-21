#!/usr/bin/env python
"""Quick Firestore list"""
import os
from dotenv import load_dotenv
load_dotenv()
from src.db_client import DBClient

db = DBClient()
if db.db:
    docs = list(db.db.collection('articles').stream())
    print(f"총 {len(docs)}개 기사\n")
    for i, d in enumerate(docs, 1):
        data = d.to_dict()
        title = data.get('title_ko', '-')[:50] if data.get('title_ko') else '-'
        print(f"{i:2}. {d.id}")
        print(f"    {title}")
        print()
else:
    print("DB 연결 실패")
