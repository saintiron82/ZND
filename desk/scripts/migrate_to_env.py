# -*- coding: utf-8 -*-
"""
Firestore 마이그레이션 스크립트
기존 publications → release/data/publications 복사 (삭제 없음)

사용법:
    python scripts/migrate_to_env.py
"""
import os
import sys

# 프로젝트 루트 설정
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore


def initialize_firebase():
    """Firebase 초기화"""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    key_file = os.path.join(base_dir, 'zeroechodaily-serviceAccountKey.json')
    
    if not os.path.exists(key_file):
        print(f"❌ 서비스 계정 키 파일을 찾을 수 없습니다: {key_file}")
        return None
    
    try:
        cred = credentials.Certificate(key_file)
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"❌ Firebase 초기화 실패: {e}")
        return None


def migrate_collection(db, collection_name, target_env='release'):
    """
    기존 컬렉션을 {target_env}/data/{collection_name}으로 복사
    """
    print(f"\n{'='*50}")
    print(f"🚀 마이그레이션: {collection_name} → {target_env}/data/{collection_name}")
    print(f"{'='*50}\n")
    
    # 1. 기존 컬렉션 읽기
    print(f"📖 기존 {collection_name} 컬렉션 읽는 중...")
    source_ref = db.collection(collection_name)
    docs = source_ref.stream()
    
    doc_list = []
    for doc in docs:
        doc_list.append({
            'id': doc.id,
            'data': doc.to_dict()
        })
    
    print(f"   → {len(doc_list)}개 문서 발견")
    
    if not doc_list:
        print("⚠️ 복사할 문서가 없습니다!")
        return 0
    
    # 2. 타겟 경로에 복사
    print(f"\n📝 {target_env}/data/{collection_name}으로 복사 중...")
    target_ref = db.collection(target_env).document('data').collection(collection_name)
    
    copied = 0
    skipped = 0
    
    for item in doc_list:
        doc_id = item['id']
        doc_data = item['data']
        
        try:
            # 이미 존재하는지 확인
            existing = target_ref.document(doc_id).get()
            if existing.exists:
                print(f"   ⏭️  스킵 (이미 존재): {doc_id}")
                skipped += 1
                continue
            
            # 복사
            target_ref.document(doc_id).set(doc_data)
            print(f"   ✅ 복사 완료: {doc_id}")
            copied += 1
            
        except Exception as e:
            print(f"   ❌ 복사 실패 ({doc_id}): {e}")
    
    print(f"\n   📊 결과: 복사 {copied}개, 스킵 {skipped}개")
    return copied


def main():
    print("\n" + "🔥 Firestore 마이그레이션 도구 🔥".center(50))
    print("기존 컬렉션 → 환경별 하위 컬렉션으로 복사\n")
    
    # Firebase 초기화
    db = initialize_firebase()
    if not db:
        return
    
    # 마이그레이션할 컬렉션 목록
    collections = ['publications', 'cache_sync', 'crawling_history']
    
    # 양쪽 환경 모두 마이그레이션
    for target_env in ['release', 'dev']:
        print(f"\n{'#'*60}")
        print(f"📌 환경: {target_env}")
        print(f"{'#'*60}")
        
        total_copied = 0
        for coll in collections:
            copied = migrate_collection(db, coll, target_env)
            total_copied += copied
        
        print(f"\n✅ [{target_env}] 완료: 총 {total_copied}개 문서 복사")
    
    print(f"\n{'='*60}")
    print(f"🎉 모든 환경 마이그레이션 완료!")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()

