import os
import sys

# Simulate Registry path calculation
# File: desk/src/core/article_registry.py
# base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# From this script: desk/src/scripts/debug_cache_path.py
script_file = os.path.abspath(__file__)
print(f"Script file: {script_file}")

# Simulate registry path (registry is at desk/src/core/article_registry.py)
# From registry: 3 levels up from file
registry_file = os.path.join(os.path.dirname(os.path.dirname(script_file)), 'core', 'article_registry.py')
print(f"Registry file: {registry_file}")

base_dir_from_registry = os.path.dirname(os.path.dirname(os.path.dirname(registry_file)))
print(f"base_dir (from registry logic): {base_dir_from_registry}")

cache_root = os.path.join(base_dir_from_registry, 'cache')
print(f"cache_root: {cache_root}")
print(f"os.path.exists(cache_root): {os.path.exists(cache_root)}")

# Also check the actual registry calculation
import glob
if os.path.exists(cache_root):
    folders = glob.glob(os.path.join(cache_root, '*'))
    print(f"Contents: {folders}")
else:
    print("Cache root not found by os.path.exists!")
    # Check if it's a symlink or weird path issue
    print(f"os.path.isdir(cache_root): {os.path.isdir(cache_root)}")

# Direct check
print(f"\n--- Direct Check ---")
direct_path = r"c:\Users\saint\ZND\desk\cache"
print(f"Direct path: {direct_path}")
print(f"os.path.exists: {os.path.exists(direct_path)}")
