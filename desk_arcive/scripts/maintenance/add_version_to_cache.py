"""
캐시 파일에 version 필드 일괄 추가 스크립트

모든 캐시 파일에 version: 'V1.0' 필드를 추가합니다.
"""
import os
import json
from datetime import datetime

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
STAGING_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'staging')

def add_version_to_files(base_dir: str, version: str = 'V1.0'):
    """캐시/스테이징 파일에 version 필드 추가"""
    updated_count = 0
    skipped_count = 0
    
    if not os.path.exists(base_dir):
        print(f"❌ 디렉토리 없음: {base_dir}")
        return 0
    
    for date_folder in os.listdir(base_dir):
        date_path = os.path.join(base_dir, date_folder)
        if not os.path.isdir(date_path):
            continue
            
        for filename in os.listdir(date_path):
            if not filename.endswith('.json'):
                continue
                
            filepath = os.path.join(date_path, filename)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 이미 version 필드가 있으면 스킵
                if data.get('version'):
                    skipped_count += 1
                    continue
                
                # version 필드 추가
                data['version'] = version
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                updated_count += 1
                
            except Exception as e:
                print(f"⚠️ 오류: {filepath} - {e}")
    
    return updated_count, skipped_count


if __name__ == '__main__':
    print("=" * 50)
    print("📦 캐시/스테이징 파일 version 필드 일괄 추가")
    print("=" * 50)
    
    # Cache 폴더 처리
    print("\n🔄 Cache 폴더 처리 중...")
    cache_updated, cache_skipped = add_version_to_files(CACHE_DIR)
    print(f"   ✅ 업데이트: {cache_updated}개, 스킵: {cache_skipped}개")
    
    # Staging 폴더 처리
    print("\n🔄 Staging 폴더 처리 중...")
    staging_updated, staging_skipped = add_version_to_files(STAGING_DIR)
    print(f"   ✅ 업데이트: {staging_updated}개, 스킵: {staging_skipped}개")
    
    print("\n" + "=" * 50)
    print(f"✅ 완료! 총 {cache_updated + staging_updated}개 파일 업데이트")
    print("=" * 50)
