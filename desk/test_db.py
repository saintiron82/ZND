# -*- coding: utf-8 -*-
from src.db_client import DBClient

db = DBClient()
print("DB Connected:", db.db is not None)

if db.db:
    try:
        docs = list(db.db.collection('publications').stream())
        print(f"Found {len(docs)} publications")
        for doc in docs:
            data = doc.to_dict()
            print(f"  - {data.get('edition_name')} (ID: {doc.id})")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
