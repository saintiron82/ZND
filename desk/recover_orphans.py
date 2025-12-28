# -*- coding: utf-8 -*-
"""
고아 기사 복구 도구
발행 이력에 없는 PUBLISHED 기사들을 CLASSIFIED로 복구

사용법:
  python recover_orphans.py --check     # 확인만 (Dry Run)
  python recover_orphans.py --apply     # 실제 적용
  python recover_orphans.py --local     # 로컬 캐시만
  python recover_orphans.py --firestore # Firestore만
"""
import os
import sys
import glob
import json
from datetime import datetime, timezone

# Path setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from src.core.firestore_client import FirestoreClient

CACHE_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')

def get_valid_editions():
    """유효한 발행 회차 코드 목록 조회"""
    db = FirestoreClient()
    meta = db.get_publications_meta()
    if not meta:
        return set()
    
    issues = meta.get('issues', [])
    codes = set()
    for issue in issues:
        code = issue.get('edition_code') or issue.get('code')
        if code:
            codes.add(code)
    return codes

def check_local_orphans(valid_editions):
    """로컬 캐시에서 고아 기사 찾기"""
    orphans = []
    
    files = glob.glob(os.path.join(CACHE_ROOT, '*', '*.json'))
    
    for fpath in files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if '_header' not in data:
                continue
            
            state = data['_header'].get('state')
            if state != 'PUBLISHED':
                continue
            
            # 발행 정보 확인
            pub = data.get('_publication') or {}
            edition_code = pub.get('edition_code')
            
            if not edition_code or edition_code not in valid_editions:
                orphans.append({
                    'source': 'local',
                    'path': fpath,
                    'article_id': data['_header'].get('article_id'),
                    'edition_code': edition_code,
                    'data': data
                })
        except Exception as e:
            print(f"⚠️ Error reading {fpath}: {e}")
    
    return orphans

def check_firestore_orphans(valid_editions):
    """Firestore에서 고아 기사 찾기"""
    orphans = []
    db = FirestoreClient()
    
    try:
        query = db._get_collection('articles').where('_header.state', '==', 'PUBLISHED')
        docs = query.stream()
        
        for doc in docs:
            data = doc.to_dict()
            pub = data.get('_publication') or {}
            edition_code = pub.get('edition_code')
            
            if not edition_code or edition_code not in valid_editions:
                orphans.append({
                    'source': 'firestore',
                    'doc_id': doc.id,
                    'article_id': data.get('_header', {}).get('article_id'),
                    'edition_code': edition_code,
                    'data': data
                })
    except Exception as e:
        print(f"⚠️ Firestore query error: {e}")
    
    return orphans

def recover_local(orphan, dry_run=True):
    """로컬 캐시 파일 복구"""
    data = orphan['data']
    now = datetime.now(timezone.utc).isoformat()
    
    data['_header']['state'] = 'CLASSIFIED'
    data['_header']['updated_at'] = now
    
    if 'state_history' not in data['_header']:
        data['_header']['state_history'] = []
    data['_header']['state_history'].append({
        'state': 'CLASSIFIED',
        'at': now,
        'by': 'orphan_recovery',
        'reason': 'no_valid_edition'
    })
    
    data['_publication'] = None
    
    if not dry_run:
        with open(orphan['path'], 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    return True

def recover_firestore(orphan, dry_run=True):
    """Firestore 기사 복구"""
    if dry_run:
        return True
    
    db = FirestoreClient()
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        '_header.state': 'CLASSIFIED',
        '_header.updated_at': now,
        '_publication': None
    }
    
    try:
        db._get_collection('articles').document(orphan['doc_id']).update(update_data)
        return True
    except Exception as e:
        print(f"❌ Firestore update error: {e}")
        return False

def main():
    args = sys.argv[1:]
    
    dry_run = '--apply' not in args
    local_only = '--local' in args
    firestore_only = '--firestore' in args
    
    print("="*60)
    print("고아 기사 복구 도구")
    print(f"Dry Run: {dry_run}")
    print("="*60)
    
    # 유효한 회차 목록 조회
    print("\n📋 유효한 발행 회차 조회 중...")
    valid_editions = get_valid_editions()
    print(f"   {len(valid_editions)}개 회차 발견")
    
    all_orphans = []
    
    # 로컬 캐시 체크
    if not firestore_only:
        print("\n📂 로컬 캐시 고아 기사 검색 중...")
        local_orphans = check_local_orphans(valid_editions)
        print(f"   {len(local_orphans)}개 발견")
        all_orphans.extend(local_orphans)
    
    # Firestore 체크
    if not local_only:
        print("\n☁️ Firestore 고아 기사 검색 중...")
        fs_orphans = check_firestore_orphans(valid_editions)
        print(f"   {len(fs_orphans)}개 발견")
        all_orphans.extend(fs_orphans)
    
    if not all_orphans:
        print("\n✅ 고아 기사가 없습니다!")
        return
    
    print(f"\n📝 복구 대상: {len(all_orphans)}개")
    for o in all_orphans[:10]:
        print(f"   - [{o['source']}] {o['article_id']} (edition: {o.get('edition_code', 'N/A')})")
    if len(all_orphans) > 10:
        print(f"   ... 외 {len(all_orphans) - 10}개")
    
    # 복구 실행
    if dry_run:
        print("\n⚠️ Dry Run 모드입니다. 실제 복구하려면:")
        print("   python recover_orphans.py --apply")
    else:
        print("\n🔧 복구 중...")
        success = 0
        for o in all_orphans:
            if o['source'] == 'local':
                if recover_local(o, dry_run=False):
                    success += 1
            else:
                if recover_firestore(o, dry_run=False):
                    success += 1
        print(f"✅ {success}/{len(all_orphans)}개 복구 완료")

if __name__ == '__main__':
    main()
