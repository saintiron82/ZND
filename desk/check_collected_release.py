# -*- coding: utf-8 -*-
"""
release 환경에서 COLLECTED 상태 기사 상세 확인
"""
import os
import sys

os.environ['ZND_ENV'] = 'release'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import importlib
import src.core.firestore_client as fc_module
importlib.reload(fc_module)

from src.core.firestore_client import FirestoreClient

def main():
    print("=" * 70)
    print("[Check] COLLECTED Articles in Release Environment")
    print("=" * 70)

    FirestoreClient._instance = None
    fs = FirestoreClient()
    env = fs.get_env_name()
    print(f"Environment: {env}\n")

    # COLLECTED 상태 기사 모두 조회
    query = fs._get_collection('articles').where('_header.state', '==', 'COLLECTED').limit(100)
    docs = list(query.stream())

    print(f"Found {len(docs)} COLLECTED articles\n")

    # 발행 정보 확인
    meta = fs.get_publications_meta()
    all_published_ids = set()

    if meta:
        for issue in meta.get('issues', []):
            edition_code = issue.get('edition_code', '')
            if edition_code.startswith('_'):
                continue
            pub = fs.get_publication(edition_code)
            if pub:
                all_published_ids.update(pub.get('article_ids', []))

    print(f"Total published article IDs: {len(all_published_ids)}\n")

    # 각 COLLECTED 기사 확인
    problems = []
    for i, doc in enumerate(docs[:50]):
        data = doc.to_dict()
        header = data.get('_header', {}) or {}
        original = data.get('_original', {}) or {}
        analysis = data.get('_analysis', {}) or {}
        publication = data.get('_publication')

        aid = header.get('article_id') or doc.id
        title = (analysis.get('title_ko') or original.get('title') or '')[:50]
        created = (header.get('created_at') or '')[:19]

        # 문제 체크
        is_in_pub_list = aid in all_published_ids
        has_pub_section = publication is not None and publication.get('edition_code')

        if is_in_pub_list or has_pub_section:
            problems.append({
                'article_id': aid,
                'title': title,
                'created': created,
                'in_pub_list': is_in_pub_list,
                'has_pub_section': has_pub_section,
                '_publication': publication
            })

        print(f"{i+1}. [{aid}]")
        print(f"   Title: {title}")
        print(f"   Created: {created}")
        print(f"   In pub list: {is_in_pub_list}, Has _publication: {bool(has_pub_section)}")
        if publication:
            print(f"   _publication: {publication}")
        print()

    # 문제 요약
    print("\n" + "=" * 70)
    print("[PROBLEMS] Articles with state=COLLECTED but appear published")
    print("=" * 70)

    if problems:
        print(f"\nFound {len(problems)} problematic articles:\n")
        for p in problems:
            print(f"- [{p['article_id']}] {p['title']}")
            print(f"  In pub list: {p['in_pub_list']}")
            print(f"  Has _publication: {p['has_pub_section']}")
            if p['_publication']:
                print(f"  _publication: {p['_publication']}")
            print()
    else:
        print("\nNo problems found - all COLLECTED articles are correctly not published")

if __name__ == '__main__':
    main()
