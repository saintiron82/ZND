import sys
import os
import traceback

# Setup Path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Correctly add project root to path so 'crawler' module is found
# file: ZND/desk/src/scripts/debug_pipeline.py
# 1: scripts, 2: src, 3: desk, 4: ZND
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if project_root not in sys.path:
    sys.path.append(project_root)

desk_path = os.path.join(project_root, 'desk')
if desk_path not in sys.path:
    sys.path.append(desk_path)

# Also add crawler/core explicitly if needed, but usually project root is enough
# if package structure is 'crawler.core'

print("Path setup complete.")
print(f"sys.path: {sys.path}")

try:
    print("Importing run_full_pipeline...")
    # Adjust import based on structure. 
    # If project_root/crawler exists, then 'import crawler' work?
    # No, 'crawler' is a folder. inside is 'core'.
    # Production uses `sys.path.insert(0, crawler_path)` so `from core.extractor` works.
    
    crawler_path = os.path.join(project_root, 'crawler')
    sys.path.insert(0, crawler_path)
    
    from core.extractor import run_full_pipeline
    
    print("Running pipeline...")
    result = run_full_pipeline(schedule_name="Debug Run")
    print("Result:", result)
except Exception:
    print("CRASHED!")
    traceback.print_exc()
