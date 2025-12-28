# -*- coding: utf-8 -*-
import os
import glob
import json

cache_root = r"c:\Users\saint\ZND\desk\cache"

print("="*50)
print("로컬 캐시 파일 상태 분석")
print("="*50)

state_count = {}
files = glob.glob(os.path.join(cache_root, '*', '*.json'))

for fpath in files:
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if '_header' in data:
            state = data['_header'].get('state', 'UNKNOWN')
        else:
            state = data.get('state', 'NO_STATE')
        
        state_count[state] = state_count.get(state, 0) + 1
    except Exception as e:
        print(f"Error: {fpath}: {e}")

print("\n📊 상태별 개수:")
for state, count in sorted(state_count.items()):
    print(f"   {state}: {count}")

print(f"\n📁 총 파일: {len(files)}")
