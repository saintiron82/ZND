
import os
import glob
import json

base_dir = r"C:\Users\saint\ZND\desk"
cache_root = os.path.join(base_dir, 'cache')
article_id = "e127f7e12b14"

print(f"Base Dir: {base_dir}")
print(f"Cache Root: {cache_root}")

search_pattern = os.path.join(cache_root, '*', f'{article_id}.json')
print(f"Pattern: {search_pattern}")

files = glob.glob(search_pattern)
print(f"Files found: {files}")

if files:
    target = files[0]
    print(f"Target: {target}")
    
    # Try reading
    with open(target, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print("Read success")
    
    # Simulate update
    updates = {'_header.state': 'ANALYZED'}
    
    print("Simulating update logic...")
    for key, value in updates.items():
        parts = key.split('.')
        t = data
        for part in parts[:-1]:
            t = t.get(part, {})
        print(f"Before: {t.get(parts[-1])}")
        
    print("Update simulation successful (read-only)")
else:
    print("❌ No files found")
