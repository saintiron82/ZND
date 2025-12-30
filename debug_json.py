import json
import sys
sys.path.append(r'd:\ZND\desk')

file_path = r"d:\ZND\desk\cache\release\2025-12-29\c9a4ad3192ab.json"

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    
with open(r"d:\ZND\debug_output.txt", "w", encoding="utf-8") as out:
    if '_analysis' in data and 'mll_raw' in data['_analysis']:
        raw = data['_analysis']['mll_raw']
        out.write("=== mll_raw Structure ===\n")
        out.write(json.dumps(raw, indent=2, ensure_ascii=False))
    else:
        out.write("No mll_raw found")
