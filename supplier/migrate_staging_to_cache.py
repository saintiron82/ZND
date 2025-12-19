"""
Staging → Cache 마이그레이션 스크립트

기존 staging 폴더의 파일들을 cache 폴더로 마이그레이션합니다.
- 동일 파일명이 cache에 이미 있으면 staging 버전으로 덮어씁니다 (최신 분석 결과 보존)
- 마이그레이션 후 staging 폴더는 백업으로 이름 변경됩니다

사용법:
    python migrate_staging_to_cache.py              # 시뮬레이션 (변경 없음)
    python migrate_staging_to_cache.py --execute    # 실제 마이그레이션
"""

import os
import json
import shutil
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STAGING_DIR = os.path.join(BASE_DIR, 'staging')
CACHE_DIR = os.path.join(BASE_DIR, 'cache')


def migrate_staging_to_cache(dry_run=True):
    """
    Staging 파일들을 Cache로 마이그레이션
    """
    print("=" * 60)
    print("📦 Staging → Cache 마이그레이션")
    print("=" * 60)
    
    if dry_run:
        print("🔍 시뮬레이션 모드 (--execute 옵션으로 실제 실행)")
    else:
        print("⚡ 실제 마이그레이션 모드")
    print()
    
    if not os.path.exists(STAGING_DIR):
        print("❌ Staging 폴더가 없습니다.")
        return
    
    migrated_count = 0
    overwritten_count = 0
    skipped_count = 0
    
    # 날짜별 폴더 스캔
    for date_folder in os.listdir(STAGING_DIR):
        staging_date_path = os.path.join(STAGING_DIR, date_folder)
        
        if not os.path.isdir(staging_date_path):
            continue
        
        # Cache 날짜 폴더 (staging 파일의 cached_at 기준 또는 staging 폴더명 사용)
        cache_date_path = os.path.join(CACHE_DIR, date_folder)
        
        print(f"\n📂 {date_folder}/")
        
        for filename in os.listdir(staging_date_path):
            if not filename.endswith('.json'):
                continue
            
            staging_file = os.path.join(staging_date_path, filename)
            cache_file = os.path.join(cache_date_path, filename)
            
            try:
                # Staging 파일 읽기
                with open(staging_file, 'r', encoding='utf-8') as f:
                    staging_data = json.load(f)
                
                # 이미 cache에 있는지 확인
                cache_exists = os.path.exists(cache_file)
                
                if cache_exists:
                    # Cache 파일 읽어서 비교
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    # Staging에만 있는 필드 (staged, rejected, published 등) 병합
                    merged_data = {**cache_data, **staging_data}
                    
                    if not dry_run:
                        with open(cache_file, 'w', encoding='utf-8') as f:
                            json.dump(merged_data, f, ensure_ascii=False, indent=2)
                    
                    print(f"   🔄 병합: {filename}")
                    overwritten_count += 1
                else:
                    # Cache에 없으면 새로 생성
                    if not dry_run:
                        os.makedirs(cache_date_path, exist_ok=True)
                        with open(cache_file, 'w', encoding='utf-8') as f:
                            json.dump(staging_data, f, ensure_ascii=False, indent=2)
                    
                    print(f"   ➕ 신규: {filename}")
                    migrated_count += 1
                    
            except Exception as e:
                print(f"   ⚠️ 오류 {filename}: {e}")
                skipped_count += 1
    
    print("\n" + "=" * 60)
    print(f"📊 결과:")
    print(f"   ➕ 신규 마이그레이션: {migrated_count}개")
    print(f"   🔄 병합(덮어쓰기): {overwritten_count}개")
    print(f"   ⚠️ 스킵(오류): {skipped_count}개")
    print("=" * 60)
    
    # 실제 실행 시 staging 폴더 백업
    if not dry_run and migrated_count + overwritten_count > 0:
        backup_name = f"staging_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        backup_path = os.path.join(BASE_DIR, backup_name)
        
        print(f"\n📦 Staging 폴더 백업: {backup_name}/")
        shutil.move(STAGING_DIR, backup_path)
        print("✅ 마이그레이션 완료!")
    elif dry_run:
        print("\n💡 실제 실행하려면: python migrate_staging_to_cache.py --execute")


if __name__ == '__main__':
    import sys
    
    execute = '--execute' in sys.argv or '-e' in sys.argv
    migrate_staging_to_cache(dry_run=not execute)
