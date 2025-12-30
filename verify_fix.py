import json
import sys
sys.path.append(r'd:\ZND\desk')

from src.core.score_engine import process_raw_analysis

# Test both articles
test_files = [
    r"d:\ZND\desk\cache\release\2025-12-29\4c406de91dcd.json",
    r"d:\ZND\desk\cache\release\2025-12-29\c9a4ad3192ab.json"
]

for file_path in test_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        aid = file_path.split('\\')[-1].replace('.json', '')
        
        if '_analysis' in data and 'mll_raw' in data['_analysis']:
            raw = data['_analysis']['mll_raw']
            result = process_raw_analysis(raw)
            print(f"[{aid}] IS={result.get('impact_score')}, ZES={result.get('zero_echo_score')}")
        else:
            print(f"[{aid}] No mll_raw")
            
    except Exception as e:
        print(f"[{aid}] Error: {e}")
