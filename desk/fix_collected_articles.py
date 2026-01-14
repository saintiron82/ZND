# -*- coding: utf-8 -*-
"""
문제 기사 복구 스크립트
publications에 있지만 COLLECTED 상태인 기사들을 PUBLISHED로 수정
"""
import os
import sys

os.environ['ZND_ENV'] = 'release'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import importlib
import src.core.firestore_client as fc_module
importlib.reload(fc_module)

from src.core.firestore_client import FirestoreClient
from src.core_logic import get_kst_now

def main():
    # 문제 기사 ID 목록
    problem_ids = [
        '09c261d90795', '1021b427ce79', '10252b522ac3', '153e514c7275',
        '16051f06a99e', '1eda9ccfff82', '3f9559d43ec3', '42e9a0ba1d2d',
        '471c7deb509e', '4c73ee6b686a', '60d8baeb21a7', '8897a1ce6926',
        'ae242a7e6bd0', 'd1ebf7e3ae27', 'd2e013cb06a2', 'd839a65261df',
        'e5239ff89078'
    ]

    print("=" * 70)
    print("[FIX] Restoring COLLECTED articles to PUBLISHED")
    print("=" * 70)

    FirestoreClient._instance = None
    fs = FirestoreClient()
    env = fs.get_env_name()
    print(f"Environment: {env}")
    print(f"Articles to fix: {len(problem_ids)}\n")

    # 각 기사가 어느 publication에 속하는지 찾기
    meta = fs.get_publications_meta()
    article_to_edition = {}

    if meta:
        for issue in meta.get('issues', []):
            edition_code = issue.get('edition_code', '')
            if edition_code.startswith('_'):
                continue
            pub = fs.get_publication(edition_code)
            if pub:
                for aid in pub.get('article_ids', []):
                    if aid in problem_ids:
                        article_to_edition[aid] = {
                            'edition_code': edition_code,
                            'edition_name': pub.get('edition_name', ''),
                            'status': pub.get('status', 'preview'),
                            'published_at': pub.get('published_at', '')
                        }

    print(f"Found edition info for {len(article_to_edition)} articles\n")

    # 복구 실행
    now = get_kst_now()
    success_count = 0
    fail_count = 0

    for aid in problem_ids:
        print(f"\n[{aid}]")

        # 기사 조회
        doc_ref = fs._get_collection('articles').document(aid)
        doc = doc_ref.get()

        if not doc.exists:
            print(f"  SKIP: Article not found")
            fail_count += 1
            continue

        data = doc.to_dict()
        header = data.get('_header', {})
        current_state = header.get('state', '')

        if current_state == 'PUBLISHED':
            print(f"  SKIP: Already PUBLISHED")
            continue

        print(f"  Current state: {current_state}")

        # edition 정보 확인
        edition_info = article_to_edition.get(aid)
        if not edition_info:
            print(f"  WARN: No edition info found, using default")
            edition_info = {
                'edition_code': 'unknown',
                'edition_name': 'unknown',
                'status': 'released',
                'published_at': now
            }

        print(f"  Edition: {edition_info['edition_code']}")

        # 업데이트 준비
        updates = {
            '_header.state': 'PUBLISHED',
            '_header.updated_at': now,
            '_publication': {
                'edition_code': edition_info['edition_code'],
                'edition_name': edition_info['edition_name'],
                'published_at': edition_info['published_at'] or now,
                'released_at': now if edition_info['status'] == 'released' else None,
                'status': edition_info['status'],
                'firestore_synced': True
            }
        }

        # state_history에 추가
        state_history = header.get('state_history', [])
        state_history.append({
            'state': 'PUBLISHED',
            'at': now,
            'by': 'fix_script'
        })
        updates['_header.state_history'] = state_history

        try:
            # Firestore 업데이트
            doc_ref.update(updates)
            print(f"  OK: Updated to PUBLISHED")
            success_count += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            fail_count += 1

    # 결과 요약
    print("\n" + "=" * 70)
    print("[Result]")
    print("=" * 70)
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Total: {len(problem_ids)}")

if __name__ == '__main__':
    main()
