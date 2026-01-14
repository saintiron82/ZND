# -*- coding: utf-8 -*-
"""복구 확인"""
import os
import sys

os.environ['ZND_ENV'] = 'release'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import importlib
import src.core.firestore_client as fc_module
importlib.reload(fc_module)

from src.core.firestore_client import FirestoreClient

def main():
    problem_ids = [
        '09c261d90795', '1021b427ce79', '10252b522ac3', '153e514c7275',
        '16051f06a99e', '1eda9ccfff82', '3f9559d43ec3', '42e9a0ba1d2d',
        '471c7deb509e', '4c73ee6b686a', '60d8baeb21a7', '8897a1ce6926',
        'ae242a7e6bd0', 'd1ebf7e3ae27', 'd2e013cb06a2', 'd839a65261df',
        'e5239ff89078'
    ]

    FirestoreClient._instance = None
    fs = FirestoreClient()
    print(f"Environment: {fs.get_env_name()}\n")

    print("Checking Firestore state directly:")
    for aid in problem_ids[:5]:  # 처음 5개만
        doc = fs._get_collection('articles').document(aid).get()
        if doc.exists:
            data = doc.to_dict()
            state = data.get('_header', {}).get('state', 'UNKNOWN')
            pub = data.get('_publication')
            print(f"  [{aid}] state={state}, _publication={bool(pub)}")

    # COLLECTED 상태 기사 수 확인
    print("\n\nCOLLECTED state count:")
    query = fs._get_collection('articles').where('_header.state', '==', 'COLLECTED').limit(100)
    docs = list(query.stream())
    print(f"  {len(docs)} articles")

if __name__ == '__main__':
    main()
