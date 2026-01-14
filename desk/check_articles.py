# -*- coding: utf-8 -*-
"""
36시간 이내 기사 상태 검수 스크립트
발행됐는데도 COLLECTED 상태에 머무는 기사 찾기
"""
import os
import sys
import json
import glob
from datetime import datetime, timedelta

# 프로젝트 경로 설정
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.firestore_client import FirestoreClient
from src.core_logic import get_kst_now

def parse_datetime(dt_str):
    """다양한 형식의 datetime 문자열 파싱"""
    if not dt_str:
        return None
    for fmt in [
        '%Y-%m-%dT%H:%M:%S.%f%z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
    ]:
        try:
            return datetime.strptime(dt_str, fmt)
        except:
            continue
    return None

def main():
    print("=" * 70)
    print("📋 36시간 이내 기사 상태 검수")
    print("=" * 70)

    # 36시간 전 시간 계산
    now = datetime.now()
    cutoff = now - timedelta(hours=36)
    cutoff_str = cutoff.strftime('%Y-%m-%dT%H:%M:%S')
    print(f"\n🕐 기준 시간: {cutoff_str} 이후 기사")

    # Firebase 초기화
    print("\n🔌 Firebase 연결 중...")
    fs = FirestoreClient()
    env = fs.get_env_name()
    print(f"   환경: {env}")

    # 1. 로컬 캐시에서 기사 조회
    print("\n📂 로컬 캐시 스캔 중...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cache_root = os.path.join(base_dir, 'cache', env)

    local_articles = {}
    if os.path.exists(cache_root):
        files = glob.glob(os.path.join(cache_root, '*', '*.json'))
        for fpath in files:
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = json.load(f)

                header = content.get('_header', {})
                created_at = header.get('created_at', '')
                article_id = header.get('article_id')

                if article_id and created_at >= cutoff_str:
                    local_articles[article_id] = {
                        'source': 'local',
                        'path': fpath,
                        'state': header.get('state'),
                        'created_at': created_at,
                        'updated_at': header.get('updated_at', ''),
                        'title': content.get('_analysis', {}).get('title_ko', '')[:50] or content.get('_original', {}).get('title', '')[:50],
                        '_publication': content.get('_publication'),
                        'state_history': header.get('state_history', [])
                    }
            except Exception as e:
                continue

    print(f"   로컬 캐시: {len(local_articles)}개 기사 발견")

    # 2. Firebase에서 최근 기사 조회
    print("\n☁️ Firebase 조회 중...")
    firestore_articles = {}

    try:
        # 최근 기사 1000개 조회
        recent = fs.list_recent_articles(limit=500)
        for article in recent:
            header = article.get('_header', {})
            created_at = header.get('created_at', '')
            article_id = header.get('article_id')

            if article_id and created_at >= cutoff_str:
                firestore_articles[article_id] = {
                    'source': 'firestore',
                    'state': header.get('state'),
                    'created_at': created_at,
                    'updated_at': header.get('updated_at', ''),
                    'title': article.get('_analysis', {}).get('title_ko', '')[:50] or article.get('_original', {}).get('title', '')[:50],
                    '_publication': article.get('_publication'),
                    'state_history': header.get('state_history', [])
                }
        print(f"   Firebase: {len(firestore_articles)}개 기사 발견")
    except Exception as e:
        print(f"   ❌ Firebase 조회 실패: {e}")

    # 3. 발행 정보 조회
    print("\n📰 발행 정보 조회 중...")
    publications = {}
    published_article_ids = set()

    try:
        meta = fs.get_publications_meta()
        if meta:
            issues = meta.get('issues', [])
            print(f"   총 {len(issues)}개 회차 발견")

            for issue in issues[-10:]:  # 최근 10개 회차만
                edition_code = issue.get('edition_code', '')
                if edition_code.startswith('_'):
                    continue

                pub = fs.get_publication(edition_code)
                if pub:
                    article_ids = pub.get('article_ids', [])
                    publications[edition_code] = {
                        'edition_name': pub.get('edition_name'),
                        'status': pub.get('status'),
                        'published_at': pub.get('published_at'),
                        'article_count': len(article_ids),
                        'article_ids': article_ids
                    }
                    published_article_ids.update(article_ids)
                    print(f"   - {edition_code}: {len(article_ids)}개 기사")
    except Exception as e:
        print(f"   ❌ 발행 정보 조회 실패: {e}")

    # 4. 병합 및 분석
    print("\n" + "=" * 70)
    print("📊 상태 분석")
    print("=" * 70)

    all_articles = {}

    # Firestore 데이터 우선 (최신)
    for aid, data in firestore_articles.items():
        all_articles[aid] = data

    # 로컬 데이터로 보완
    for aid, data in local_articles.items():
        if aid not in all_articles:
            all_articles[aid] = data
        else:
            # 로컬이 더 최신이면 업데이트
            if data.get('updated_at', '') > all_articles[aid].get('updated_at', ''):
                all_articles[aid] = data

    # 상태별 분류
    by_state = {}
    for aid, data in all_articles.items():
        state = data.get('state', 'UNKNOWN')
        if state not in by_state:
            by_state[state] = []
        by_state[state].append((aid, data))

    print(f"\n총 {len(all_articles)}개 기사 (36시간 이내)")
    print("\n상태별 분포:")
    for state, articles in sorted(by_state.items()):
        print(f"  - {state}: {len(articles)}개")

    # 5. 문제 기사 찾기
    print("\n" + "=" * 70)
    print("⚠️ 문제 기사 검출")
    print("=" * 70)

    problems = []

    # Case 1: 발행 목록에 있는데 COLLECTED 상태인 기사
    for aid, data in all_articles.items():
        state = data.get('state')
        publication = data.get('_publication')

        # 발행 목록에 있는 경우
        if aid in published_article_ids:
            if state != 'PUBLISHED' and state != 'RELEASED':
                problems.append({
                    'article_id': aid,
                    'issue': f"발행 목록에 있으나 상태가 {state}",
                    'expected_state': 'PUBLISHED',
                    'actual_state': state,
                    'title': data.get('title', ''),
                    'created_at': data.get('created_at', ''),
                    '_publication': publication,
                    'source': data.get('source', ''),
                    'state_history': data.get('state_history', [])
                })

        # _publication 섹션이 있는 경우
        if publication and publication.get('edition_code'):
            if state != 'PUBLISHED' and state != 'RELEASED':
                # 이미 추가되지 않았다면
                if not any(p['article_id'] == aid for p in problems):
                    problems.append({
                        'article_id': aid,
                        'issue': f"_publication 있으나 상태가 {state}",
                        'expected_state': 'PUBLISHED',
                        'actual_state': state,
                        'title': data.get('title', ''),
                        'created_at': data.get('created_at', ''),
                        '_publication': publication,
                        'source': data.get('source', ''),
                        'state_history': data.get('state_history', [])
                    })

    if problems:
        print(f"\n🚨 {len(problems)}개 문제 발견!\n")
        for i, p in enumerate(problems, 1):
            print(f"{i}. [{p['article_id']}]")
            print(f"   제목: {p['title']}")
            print(f"   문제: {p['issue']}")
            print(f"   생성: {p['created_at']}")
            print(f"   출처: {p['source']}")
            if p.get('_publication'):
                pub = p['_publication']
                print(f"   발행 정보: edition={pub.get('edition_code')}, status={pub.get('status')}")
            if p.get('state_history'):
                print(f"   상태 히스토리:")
                for h in p['state_history'][-5:]:
                    print(f"     - {h.get('state')} at {h.get('at')} by {h.get('by')}")
            print()
    else:
        print("\n✅ 문제 기사 없음")

    # 6. Firebase/Local 불일치 확인
    print("\n" + "=" * 70)
    print("🔄 Firebase/Local 상태 불일치 확인")
    print("=" * 70)

    inconsistencies = []
    common_ids = set(local_articles.keys()) & set(firestore_articles.keys())

    for aid in common_ids:
        local_state = local_articles[aid].get('state')
        fs_state = firestore_articles[aid].get('state')

        if local_state != fs_state:
            inconsistencies.append({
                'article_id': aid,
                'local_state': local_state,
                'firestore_state': fs_state,
                'title': local_articles[aid].get('title', ''),
                'local_updated': local_articles[aid].get('updated_at', ''),
                'fs_updated': firestore_articles[aid].get('updated_at', '')
            })

    if inconsistencies:
        print(f"\n⚠️ {len(inconsistencies)}개 불일치 발견!\n")
        for inc in inconsistencies[:20]:  # 최대 20개만 표시
            print(f"- [{inc['article_id']}] {inc['title'][:40]}")
            print(f"  Local: {inc['local_state']} (updated: {inc['local_updated']})")
            print(f"  Firebase: {inc['firestore_state']} (updated: {inc['fs_updated']})")
            print()
    else:
        print("\n✅ 상태 불일치 없음")

    # 7. 상세 리포트 저장
    report = {
        'checked_at': get_kst_now(),
        'cutoff': cutoff_str,
        'total_articles': len(all_articles),
        'by_state': {state: len(articles) for state, articles in by_state.items()},
        'problems': problems,
        'inconsistencies': inconsistencies
    }

    report_path = os.path.join(base_dir, 'article_check_report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n📄 상세 리포트 저장: {report_path}")

    print("\n" + "=" * 70)
    print("✅ 검수 완료")
    print("=" * 70)

    return problems, inconsistencies

if __name__ == '__main__':
    main()
