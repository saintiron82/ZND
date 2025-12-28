# -*- coding: utf-8 -*-
"""
로컬 캐시 상태 마이그레이션 스크립트
PUBLISHED 상태 기사들을 CLASSIFIED로 변경
"""
import os
import glob
import json
from datetime import datetime, timezone

CACHE_ROOT = r"c:\Users\saint\ZND\desk\cache"

def migrate_cache(dry_run=True):
    """로컬 캐시 파일들의 상태를 PUBLISHED -> CLASSIFIED로 변경"""
    
    print("="*60)
    print("로컬 캐시 상태 마이그레이션")
    print(f"Dry Run: {dry_run}")
    print("="*60)
    
    files = glob.glob(os.path.join(CACHE_ROOT, '*', '*.json'))
    
    migrated = 0
    skipped = 0
    errors = 0
    
    for fpath in files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # V2 Schema 확인
            if '_header' not in data:
                skipped += 1
                continue
            
            current_state = data['_header'].get('state')
            
            if current_state == 'PUBLISHED':
                print(f"📝 {os.path.basename(fpath)}: PUBLISHED -> CLASSIFIED")
                
                if not dry_run:
                    # 상태 변경
                    data['_header']['state'] = 'CLASSIFIED'
                    data['_header']['updated_at'] = datetime.now(timezone.utc).isoformat()
                    
                    # state_history 추가
                    if 'state_history' not in data['_header']:
                        data['_header']['state_history'] = []
                    data['_header']['state_history'].append({
                        'state': 'CLASSIFIED',
                        'at': datetime.now(timezone.utc).isoformat(),
                        'by': 'migration_script',
                        'reason': 'unpublish_all'
                    })
                    
                    # _publication 정보 초기화
                    data['_publication'] = None
                    
                    # 저장
                    with open(fpath, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    
                migrated += 1
            else:
                skipped += 1
                
        except Exception as e:
            print(f"❌ Error: {fpath}: {e}")
            errors += 1
    
    print("\n" + "="*60)
    print(f"결과:")
    print(f"   변경됨: {migrated}")
    print(f"   스킵됨: {skipped}")
    print(f"   에러: {errors}")
    print("="*60)
    
    if dry_run:
        print("\n⚠️  Dry Run 모드입니다. 실제 변경하려면:")
        print("    python migrate_cache.py --apply")

if __name__ == '__main__':
    import sys
    
    dry_run = '--apply' not in sys.argv
    migrate_cache(dry_run=dry_run)
