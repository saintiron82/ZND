# -*- coding: utf-8 -*-
"""
Firebase 기사 상태 전체 확인 스크립트
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.firestore_client import FirestoreClient

def main():
    print("=" * 70)
    print("[Check] All Article States in Firebase")
    print("=" * 70)

    fs = FirestoreClient()
    env = fs.get_env_name()
    print(f"Environment: {env}")

    # 모든 상태별로 조회
    states = ['COLLECTED', 'ANALYZING', 'ANALYZED', 'CLASSIFIED', 'PUBLISHED', 'RELEASED', 'REJECTED']

    total = 0
    for state in states:
        # Firestore 직접 쿼리
        try:
            query = fs._get_collection('articles').where('_header.state', '==', state).limit(100)
            docs = list(query.stream())
            count = len(docs)
            total += count

            print(f"\n[{state}]: {count} articles")

            if count > 0 and count <= 10:
                for doc in docs[:5]:
                    data = doc.to_dict()
                    header = data.get('_header', {})
                    title = data.get('_analysis', {}).get('title_ko', '')[:40] or data.get('_original', {}).get('title', '')[:40]
                    created = header.get('created_at', '')[:19]
                    pub = data.get('_publication')
                    print(f"  - [{doc.id}] {title}")
                    print(f"    Created: {created}")
                    if pub:
                        print(f"    Publication: {pub.get('edition_code')}")
        except Exception as e:
            print(f"\n[{state}]: Error - {e}")

    print(f"\n{'='*70}")
    print(f"Total articles: {total}")
    print("=" * 70)

    # 최근 생성된 기사들 (상태 무관)
    print("\n\n[Recent Articles - Last 20]")
    print("=" * 70)

    try:
        query = fs._get_collection('articles').order_by('_header.created_at', direction='DESCENDING').limit(20)
        docs = list(query.stream())

        for doc in docs:
            data = doc.to_dict()
            header = data.get('_header', {})
            state = header.get('state', 'UNKNOWN')
            title = data.get('_analysis', {}).get('title_ko', '')[:40] or data.get('_original', {}).get('title', '')[:40]
            created = header.get('created_at', '')[:19]
            pub = data.get('_publication')

            print(f"\n[{doc.id}] State: {state}")
            print(f"  Title: {title}")
            print(f"  Created: {created}")
            if pub:
                print(f"  Publication: {pub.get('edition_code')}, status={pub.get('status')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
