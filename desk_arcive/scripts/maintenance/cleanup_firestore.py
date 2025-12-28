#!/usr/bin/env python
"""
Firestore 정리 스크립트
- 현재 발행된 모든 기사 목록 확인
- 잘못된 기사 삭제
"""

import os
import sys

# .env 로드
from dotenv import load_dotenv
load_dotenv()

from src.db_client import DBClient

def list_all_articles():
    """Firestore의 모든 기사 목록 출력"""
    db = DBClient()
    
    if not db.db:
        print("❌ Firestore 연결 실패")
        return []
    
    try:
        docs = db.db.collection('articles').stream()
        articles = []
        
        print("\n📋 Firestore 기사 목록:")
        print("=" * 80)
        
        for doc in docs:
            data = doc.to_dict()
            articles.append({
                'id': doc.id,
                'title_ko': data.get('title_ko', '제목 없음')[:50],
                'published_at': data.get('published_at', '-'),
                'impact_score': data.get('impact_score', 0),
                'zero_echo_score': data.get('zero_echo_score', 0),
                'source_id': data.get('source_id', '-')
            })
        
        for i, a in enumerate(articles, 1):
            print(f"{i:3}. [{a['source_id']:15}] IS:{a['impact_score']:4} ZS:{a['zero_echo_score']:4} | {a['title_ko']}")
            print(f"     ID: {a['id']}")
        
        print("=" * 80)
        print(f"총 {len(articles)}개 기사")
        
        return articles
    except Exception as e:
        print(f"❌ 오류: {e}")
        return []

def delete_all_articles():
    """모든 기사 삭제"""
    db = DBClient()
    
    if not db.db:
        print("❌ Firestore 연결 실패")
        return
    
    confirm = input("\n⚠️ 모든 기사를 삭제하시겠습니까? (yes 입력): ")
    if confirm != 'yes':
        print("취소됨")
        return
    
    try:
        docs = db.db.collection('articles').stream()
        deleted = 0
        
        for doc in docs:
            db.db.collection('articles').document(doc.id).delete()
            print(f"🗑️ Deleted: {doc.id}")
            deleted += 1
        
        print(f"\n✅ {deleted}개 기사 삭제 완료")
    except Exception as e:
        print(f"❌ 오류: {e}")

def delete_by_ids(ids: list):
    """특정 ID들만 삭제"""
    db = DBClient()
    
    if not db.db:
        print("❌ Firestore 연결 실패")
        return
    
    for doc_id in ids:
        try:
            db.db.collection('articles').document(doc_id).delete()
            print(f"🗑️ Deleted: {doc_id}")
        except Exception as e:
            print(f"❌ 삭제 실패 ({doc_id}): {e}")

if __name__ == "__main__":
    print("🔥 Firestore 정리 도구")
    print("-" * 40)
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
        if cmd == "list":
            list_all_articles()
        elif cmd == "delete-all":
            delete_all_articles()
        elif cmd == "delete":
            # 삭제할 ID들을 인자로 전달
            ids = sys.argv[2:]
            if ids:
                delete_by_ids(ids)
            else:
                print("사용법: python cleanup_firestore.py delete <id1> <id2> ...")
        else:
            print("사용법:")
            print("  python cleanup_firestore.py list        # 목록 확인")
            print("  python cleanup_firestore.py delete-all  # 모든 기사 삭제")
            print("  python cleanup_firestore.py delete <id> # 특정 ID 삭제")
    else:
        # 기본: 목록 확인
        articles = list_all_articles()
        
        if articles:
            print("\n옵션:")
            print("  1. 전체 삭제: python cleanup_firestore.py delete-all")
            print("  2. 특정 삭제: python cleanup_firestore.py delete <ID>")
