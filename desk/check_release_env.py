# -*- coding: utf-8 -*-
"""
release 환경에서 특정 기사 확인
"""
import os
import sys

# 환경 설정을 release로
os.environ['ZND_ENV'] = 'release'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 싱글톤 리셋을 위해 모듈 리로드
import importlib
import src.core.firestore_client as fc_module
importlib.reload(fc_module)

from src.core.firestore_client import FirestoreClient

def main():
    article_ids = ['d60ab341742f', '4724ebce4f49']

    print("=" * 70)
    print("[Check] Release Environment")
    print("=" * 70)

    # 강제로 새 인스턴스 생성
    FirestoreClient._instance = None
    fs = FirestoreClient()
    env = fs.get_env_name()
    print(f"Environment: {env}\n")

    for aid in article_ids:
        print(f"\n{'='*70}")
        print(f"Article ID: {aid}")
        print("=" * 70)

        try:
            doc_ref = fs._get_collection('articles').document(aid)
            doc = doc_ref.get()

            if doc.exists:
                data = doc.to_dict()
                header = data.get('_header', {})
                original = data.get('_original', {})
                analysis = data.get('_analysis', {})
                publication = data.get('_publication')

                print(f"\n[Firestore Data]")
                print(f"  State: {header.get('state')}")
                print(f"  Created: {header.get('created_at')}")
                print(f"  Updated: {header.get('updated_at')}")

                print(f"\n[Original]")
                print(f"  Title: {original.get('title', '')[:60]}")
                print(f"  URL: {original.get('url', '')[:80]}")

                print(f"\n[Analysis]")
                print(f"  Title KO: {analysis.get('title_ko', '')[:60]}")

                print(f"\n[Publication]")
                if publication:
                    print(f"  Edition: {publication.get('edition_code')}")
                    print(f"  Status: {publication.get('status')}")
                    print(f"  Published at: {publication.get('published_at')}")
                else:
                    print(f"  None")

                print(f"\n[State History]")
                for h in header.get('state_history', [])[-5:]:
                    print(f"  - {h.get('state')} at {h.get('at')} by {h.get('by')}")
            else:
                print(f"  NOT FOUND in release env")

        except Exception as e:
            print(f"  Error: {e}")

    # 상태별 기사 수 확인
    print(f"\n\n{'='*70}")
    print("[State Summary in Release]")
    print("=" * 70)

    states = ['COLLECTED', 'ANALYZED', 'CLASSIFIED', 'PUBLISHED', 'RELEASED', 'REJECTED']
    for state in states:
        try:
            query = fs._get_collection('articles').where('_header.state', '==', state).limit(100)
            docs = list(query.stream())
            print(f"  {state}: {len(docs)} articles")
        except Exception as e:
            print(f"  {state}: Error - {e}")

if __name__ == '__main__':
    main()
