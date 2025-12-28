"""
캐시 데이터의 태그 복구 스크립트

raw_analysis.Meta.Tags가 있지만 tags가 비어있는 캐시 파일들을 찾아서
태그를 복구합니다.
"""

import os
import json
import glob

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BASE_DIR, 'cache')

def fix_tags_in_cache():
    """캐시의 모든 파일에서 태그를 복구합니다."""
    fixed_count = 0
    total_count = 0
    
    # 모든 날짜 폴더 순회
    for date_folder in os.listdir(CACHE_DIR):
        date_path = os.path.join(CACHE_DIR, date_folder)
        if not os.path.isdir(date_path) or date_folder == 'batches':
            continue
        
        # 모든 JSON 파일 처리
        for filename in os.listdir(date_path):
            if not filename.endswith('.json'):
                continue
                
            filepath = os.path.join(date_path, filename)
            total_count += 1
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 현재 tags가 비어있는지 확인
                current_tags = data.get('tags', [])
                if current_tags and len(current_tags) > 0:
                    continue  # 이미 태그가 있으면 스킵
                
                # raw_analysis.Meta.Tags에서 태그 추출
                raw_analysis = data.get('raw_analysis', {})
                meta = raw_analysis.get('Meta', {})
                tags_raw = meta.get('Tags') or meta.get('Tag')
                
                if not tags_raw:
                    continue  # 원본 태그도 없으면 스킵
                
                # 태그 파싱
                if isinstance(tags_raw, str):
                    new_tags = [t.strip() for t in tags_raw.split(',') if t.strip()]
                elif isinstance(tags_raw, list):
                    new_tags = tags_raw
                else:
                    continue
                
                if not new_tags:
                    continue
                
                # 태그 업데이트
                data['tags'] = new_tags
                
                # 파일 저장
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                print(f"✅ [{date_folder}] {filename}: {new_tags}")
                fixed_count += 1
                
            except Exception as e:
                print(f"❌ Error processing {filepath}: {e}")
    
    print(f"\n=== 완료 ===")
    print(f"전체 파일: {total_count}")
    print(f"수정된 파일: {fixed_count}")

if __name__ == "__main__":
    fix_tags_in_cache()
