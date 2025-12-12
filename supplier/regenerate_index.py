"""
One-time script to regenerate lightweight index.json for existing data folders.
Run from supplier directory.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core_logic import update_manifest

# Get data dir
data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')

# Find all date directories
for item in os.listdir(data_dir):
    item_path = os.path.join(data_dir, item)
    if os.path.isdir(item_path) and item.startswith('20'):  # Date folders like 2025-12-11
        print(f"Regenerating index for {item}...")
        update_manifest(item)

print("Done!")
