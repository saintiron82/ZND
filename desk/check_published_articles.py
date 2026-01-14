# -*- coding: utf-8 -*-
"""
발행된 기사 상태 직접 검수
publications에 있는 기사들의 실제 상태 확인
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.firestore_client import FirestoreClient

def main():
    print("=" * 70)
    print("[Check] Published Articles State Verification")
    print("=" * 70)

    fs = FirestoreClient()
    env = fs.get_env_name()
    print(f"Environment: {env}")

    # 1. 발행 메타 조회
    print("\n[1] Fetching publications metadata...")
    meta = fs.get_publications_meta()

    if not meta:
        print("  No publications meta found!")
        return

    issues = meta.get('issues', [])
    print(f"  Found {len(issues)} issues")

    # 2. 최근 회차들 검사
    print("\n[2] Checking recent issues...")

    all_problems = []

    for issue in issues[-5:]:  # 최근 5개 회차
        edition_code = issue.get('edition_code', '')
        if edition_code.startswith('_'):
            continue

        print(f"\n  Edition: {edition_code}")
        print(f"    Name: {issue.get('edition_name')}")
        print(f"    Status: {issue.get('status')}")
        print(f"    Article count (meta): {issue.get('article_count')}")

        # 실제 publication 문서 조회
        pub = fs.get_publication(edition_code)
        if not pub:
            print(f"    [WARN] Publication document not found!")
            continue

        article_ids = pub.get('article_ids', [])
        print(f"    Article IDs in publication: {len(article_ids)}")

        # 각 기사의 실제 상태 확인
        problems_in_edition = []

        for aid in article_ids:
            article = fs.get_article(aid)
            if not article:
                print(f"      [MISSING] {aid} - Article not found!")
                problems_in_edition.append({
                    'article_id': aid,
                    'issue': 'Article not found in Firestore',
                    'edition_code': edition_code
                })
                continue

            header = article.get('_header', {})
            state = header.get('state', 'UNKNOWN')
            title = article.get('_analysis', {}).get('title_ko', '')[:50]
            publication = article.get('_publication', {})

            if state not in ['PUBLISHED', 'RELEASED']:
                print(f"      [PROBLEM] {aid}")
                print(f"        State: {state} (expected: PUBLISHED or RELEASED)")
                print(f"        Title: {title}")
                print(f"        _publication: {publication}")

                problems_in_edition.append({
                    'article_id': aid,
                    'state': state,
                    'title': title,
                    '_publication': publication,
                    'edition_code': edition_code,
                    'issue': f'State is {state}, expected PUBLISHED'
                })

        if problems_in_edition:
            print(f"\n    [!] {len(problems_in_edition)} problems in this edition")
            all_problems.extend(problems_in_edition)
        else:
            print(f"    [OK] All articles have correct state")

    # 3. 상태별 기사 조회 (COLLECTED 상태 확인)
    print("\n" + "=" * 70)
    print("[3] Checking COLLECTED state articles...")

    collected = fs.list_articles_by_state('COLLECTED', limit=50)
    print(f"  Found {len(collected)} articles in COLLECTED state")

    for article in collected[:10]:
        header = article.get('_header', {})
        aid = header.get('article_id')
        created = header.get('created_at', '')
        title = article.get('_analysis', {}).get('title_ko', '')[:40] or article.get('_original', {}).get('title', '')[:40]
        publication = article.get('_publication')

        print(f"\n  [{aid}]")
        print(f"    Created: {created}")
        print(f"    Title: {title}")

        if publication:
            print(f"    [PROBLEM] Has _publication but state is COLLECTED!")
            print(f"    _publication: {publication}")
            all_problems.append({
                'article_id': aid,
                'state': 'COLLECTED',
                '_publication': publication,
                'title': title,
                'issue': 'Has _publication section but state is COLLECTED'
            })

    # 4. 요약
    print("\n" + "=" * 70)
    print("[Summary]")
    print("=" * 70)

    if all_problems:
        print(f"\n[!] Total {len(all_problems)} problems found:\n")
        for i, p in enumerate(all_problems, 1):
            print(f"  {i}. [{p['article_id']}]")
            print(f"     Issue: {p['issue']}")
            if p.get('title'):
                print(f"     Title: {p['title']}")
            if p.get('edition_code'):
                print(f"     Edition: {p['edition_code']}")
    else:
        print("\n[OK] No problems found")

    # 저장
    report = {
        'problems': all_problems,
        'total_issues_checked': len([i for i in issues if not i.get('edition_code', '').startswith('_')])
    }

    report_path = os.path.join(os.path.dirname(__file__), 'published_check_report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
