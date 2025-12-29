# -*- coding: utf-8 -*-
"""
Schema v3.1 Migration Script
기존 캐시 파일의 url, source_id를 _header로 이동

Usage:
    python scripts/migrate_schema_v31.py
    python scripts/migrate_schema_v31.py --dry-run  # 테스트 모드
"""
import os
import sys
import json
import glob
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cache')


def migrate_article(data: dict) -> tuple[dict, bool]:
    """
    단일 기사 데이터를 v3.1로 마이그레이션
    
    Returns:
        (migrated_data, was_modified)
    """
    header = data.get('_header', {})
    original = data.get('_original', {})
    
    modified = False
    
    # 이미 v3.1이면 스킵
    if header.get('version') == '3.1':
        return data, False
    
    # url을 _header로 이동
    if 'url' not in header and 'url' in original:
        header['url'] = original['url']
        modified = True
    
    # source_id를 _header로 이동
    if 'source_id' not in header and 'source_id' in original:
        header['source_id'] = original['source_id']
        modified = True
    
    # article_id가 없으면 URL에서 생성
    if 'article_id' not in header:
        url = header.get('url') or original.get('url')
        if url:
            import hashlib
            article_id = hashlib.md5(url.encode()).hexdigest()[:12]
            header['article_id'] = article_id
            modified = True
    
    # 버전 업데이트
    if modified:
        header['version'] = '3.1'
        data['_header'] = header
    
    return data, modified


def migrate_cache_files(dry_run: bool = False):
    """
    캐시 디렉토리의 모든 JSON 파일을 마이그레이션
    """
    if not os.path.exists(CACHE_DIR):
        print(f"❌ Cache directory not found: {CACHE_DIR}")
        return
    
    # 모든 .json 파일 찾기
    pattern = os.path.join(CACHE_DIR, '**', '*.json')
    files = glob.glob(pattern, recursive=True)
    
    print(f"📂 Found {len(files)} cache files")
    print(f"{'🔍 DRY RUN MODE' if dry_run else '🔧 MIGRATION MODE'}")
    print("-" * 50)
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    for filepath in files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 마이그레이션 수행
            migrated_data, was_modified = migrate_article(data)
            
            if was_modified:
                if not dry_run:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(migrated_data, f, ensure_ascii=False, indent=2)
                
                article_id = migrated_data.get('_header', {}).get('article_id', 'unknown')
                print(f"✅ {'Would migrate' if dry_run else 'Migrated'}: {article_id}")
                migrated_count += 1
            else:
                skipped_count += 1
                
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON Error in {filepath}: {e}")
            error_count += 1
        except Exception as e:
            print(f"❌ Error in {filepath}: {e}")
            error_count += 1
    
    print("-" * 50)
    print(f"📊 Results:")
    print(f"   ✅ Migrated: {migrated_count}")
    print(f"   ⏭️ Skipped (already v3.1): {skipped_count}")
    print(f"   ❌ Errors: {error_count}")
    
    if dry_run:
        print(f"\n💡 Run without --dry-run to apply changes")


def main():
    dry_run = '--dry-run' in sys.argv
    
    print("=" * 50)
    print("  Schema v3.1 Migration")
    print(f"  Cache Dir: {CACHE_DIR}")
    print("=" * 50)
    
    migrate_cache_files(dry_run=dry_run)


if __name__ == '__main__':
    main()
