# -*- coding: utf-8 -*-
"""
특정 기사 상태 확인
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.firestore_client import FirestoreClient

def main():
    article_ids = ['d60ab341742f', '4724ebce4f49']

    print("=" * 70)
    print("[Check] Specific Articles Status")
    print("=" * 70)

    fs = FirestoreClient()
    env = fs.get_env_name()
    print(f"Environment: {env}\n")

    for aid in article_ids:
        print(f"\n{'='*70}")
        print(f"Article ID: {aid}")
        print("=" * 70)

        # 1. Firestore 직접 조회
        try:
            doc_ref = fs._get_collection('articles').document(aid)
            doc = doc_ref.get()

            if doc.exists:
                data = doc.to_dict()
                header = data.get('_header', {})
                original = data.get('_original', {})
                analysis = data.get('_analysis', {})
                classification = data.get('_classification')
                publication = data.get('_publication')

                print(f"\n[Firestore Data]")
                print(f"  State: {header.get('state')}")
                print(f"  Version: {header.get('version')}")
                print(f"  Created: {header.get('created_at')}")
                print(f"  Updated: {header.get('updated_at')}")

                print(f"\n[Original]")
                print(f"  Title: {original.get('title', '')[:60]}")
                print(f"  URL: {original.get('url', '')[:80]}")

                print(f"\n[Analysis]")
                print(f"  Title KO: {analysis.get('title_ko', '')[:60]}")
                print(f"  Score: {analysis.get('zero_echo_score')}")

                print(f"\n[Classification]")
                print(f"  {classification}")

                print(f"\n[Publication]")
                print(f"  {publication}")

                print(f"\n[State History]")
                for h in header.get('state_history', [])[-5:]:
                    print(f"  - {h.get('state')} at {h.get('at')} by {h.get('by')}")
            else:
                print(f"  NOT FOUND in Firestore")

        except Exception as e:
            print(f"  Error: {e}")

        # 2. publications에서 이 기사가 있는지 확인
        print(f"\n[Check in Publications]")
        try:
            meta = fs.get_publications_meta()
            if meta:
                for issue in meta.get('issues', []):
                    edition_code = issue.get('edition_code', '')
                    if edition_code.startswith('_'):
                        continue

                    pub = fs.get_publication(edition_code)
                    if pub:
                        article_ids_in_pub = pub.get('article_ids', [])
                        if aid in article_ids_in_pub:
                            print(f"  Found in {edition_code} ({issue.get('edition_name')})")
                            print(f"    Status: {pub.get('status')}")

                            # articles 배열에서 상세 정보 확인
                            articles = pub.get('articles', [])
                            for a in articles:
                                if a.get('article_id') == aid:
                                    print(f"    Snapshot state in pub: {a.get('_header', {}).get('state')}")
                                    break
        except Exception as e:
            print(f"  Error checking publications: {e}")

    # 3. 로컬 캐시 확인
    print(f"\n\n{'='*70}")
    print("[Check Local Cache]")
    print("=" * 70)

    import glob
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cache_root = os.path.join(base_dir, 'cache', env)

    for aid in article_ids:
        pattern = os.path.join(cache_root, '**', f'*{aid}*.json')
        files = glob.glob(pattern, recursive=True)

        if files:
            for f in files:
                print(f"\n[Local Cache] {aid}")
                print(f"  File: {f}")
                try:
                    with open(f, 'r', encoding='utf-8') as fp:
                        data = json.load(fp)
                        header = data.get('_header', {})
                        print(f"  State: {header.get('state')}")
                        print(f"  Updated: {header.get('updated_at')}")
                except Exception as e:
                    print(f"  Error reading: {e}")
        else:
            print(f"\n[Local Cache] {aid}: NOT FOUND")

if __name__ == '__main__':
    main()
