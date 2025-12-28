# -*- coding: utf-8 -*-
"""
발행 데이터 마이그레이션 스크립트
- 기존 발행된 회차의 articles 배열을 최신 포맷으로 업데이트
- 로컬 캐시에서 상세 정보를 읽어와서 Firebase 문서 업데이트

사용법:
    python migrate_publications.py              # 시뮬레이션 (변경 없음)
    python migrate_publications.py --execute    # 실제 마이그레이션
"""
import os
import sys
import json
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.db_client import DBClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BASE_DIR, 'cache')


def find_article_in_cache(article_id: str) -> dict | None:
    """캐시에서 article_id로 기사 찾기"""
    if not os.path.exists(CACHE_DIR):
        return None
    
    # 모든 날짜 폴더 검색
    for date_folder in os.listdir(CACHE_DIR):
        date_path = os.path.join(CACHE_DIR, date_folder)
        if not os.path.isdir(date_path):
            continue
        
        for filename in os.listdir(date_path):
            if not filename.endswith('.json'):
                continue
            
            # 파일명에서 article_id 추출 (예: the_decoder_abc123.json → abc123)
            file_id = filename.replace('.json', '').split('_')[-1]
            
            # ID 매칭 (6자리 또는 12자리)
            if file_id == article_id or article_id in filename:
                filepath = os.path.join(date_path, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        # 파일 내부의 article_id도 확인
                        if data.get('article_id') == article_id:
                            return data
                except Exception:
                    pass
    
    return None


def build_enriched_article(article: dict, cache_data: dict) -> dict:
    """캐시 데이터로 articles 배열 항목 보강"""
    return {
        'id': article.get('id', ''),
        'title': cache_data.get('title_ko') or cache_data.get('title') or article.get('title', ''),
        'title_ko': cache_data.get('title_ko', ''),
        'title_en': cache_data.get('title', ''),
        'summary': cache_data.get('summary', ''),
        'url': cache_data.get('url') or article.get('url', ''),
        'source_id': cache_data.get('source_id', ''),
        'zero_echo_score': cache_data.get('zero_echo_score'),
        'impact_score': cache_data.get('impact_score'),
        'layout_type': cache_data.get('layout_type', 'Standard'),
        'tags': cache_data.get('tags', []),
        'category': cache_data.get('category', '미분류'),
        'filename': article.get('filename', ''),
        'date': article.get('date', ''),
        'published_at': cache_data.get('published_at', article.get('published_at', ''))
    }


def migrate_publications(dry_run: bool = True):
    """발행 데이터 마이그레이션"""
    print("=" * 60)
    print("📦 발행 데이터 마이그레이션")
    print(f"   모드: {'시뮬레이션 (Dry Run)' if dry_run else '⚠️ 실제 실행'}")
    print("=" * 60)
    
    db = DBClient()
    
    # 모든 회차 조회
    issues = db.get_issues_from_meta()
    print(f"\n📋 총 {len(issues)}개 회차 발견\n")
    
    total_updated = 0
    total_articles_enriched = 0
    
    for issue in issues:
        publish_id = issue.get('id') or issue.get('edition_code')
        edition_name = issue.get('edition_name', publish_id)
        
        print(f"─── {edition_name} ({publish_id}) ───")
        
        # 회차 상세 조회
        pub_data = db.get_publication(publish_id)
        if not pub_data:
            print(f"   ⚠️ 문서 없음\n")
            continue
        
        articles = pub_data.get('articles', [])
        article_ids = pub_data.get('article_ids', [])
        
        # articles 배열이 없거나 비어있으면 article_ids로 구성
        if not articles and article_ids:
            print(f"   📝 articles 배열 없음, article_ids에서 {len(article_ids)}개 복원 필요")
            articles = [{'id': aid} for aid in article_ids]
        
        # 각 기사 보강
        enriched_articles = []
        enriched_count = 0
        
        for article in articles:
            article_id = article.get('id', '')
            
            # 이미 summary가 있으면 보강됨
            if article.get('summary'):
                enriched_articles.append(article)
                continue
            
            # 캐시에서 찾기
            cache_data = find_article_in_cache(article_id)
            
            if cache_data:
                enriched = build_enriched_article(article, cache_data)
                enriched_articles.append(enriched)
                enriched_count += 1
                print(f"   ✅ {article_id}: 보강됨 (score: {cache_data.get('zero_echo_score', 'N/A')})")
            else:
                # 캐시에 없으면 기존 데이터 유지
                enriched_articles.append(article)
                print(f"   ⚠️ {article_id}: 캐시에서 찾을 수 없음")
        
        # 업데이트 필요 여부
        if enriched_count > 0:
            print(f"   → {enriched_count}개 기사 보강")
            
            if not dry_run:
                # Firestore 업데이트
                db.update_publication_record(publish_id, {
                    'articles': enriched_articles,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                })
                print(f"   💾 Firestore 업데이트 완료")
            
            total_updated += 1
            total_articles_enriched += enriched_count
        else:
            print(f"   ✨ 이미 최신 포맷")
        
        print()
    
    # 요약
    print("=" * 60)
    print(f"📊 마이그레이션 요약")
    print(f"   - 업데이트된 회차: {total_updated}개")
    print(f"   - 보강된 기사: {total_articles_enriched}개")
    
    if dry_run:
        print("\n⚠️ 시뮬레이션 모드입니다. 실제 적용하려면:")
        print("   python migrate_publications.py --execute")
    else:
        print("\n✅ 마이그레이션 완료!")
    
    print("=" * 60)


if __name__ == "__main__":
    dry_run = '--execute' not in sys.argv
    migrate_publications(dry_run)
