import json
import os
from datetime import datetime, timezone

CACHE_DIR = r"c:\Users\saint\ZND\desk_arcive\cache"
HISTORY_FILE = os.path.join(CACHE_DIR, "crawling_history.json")

def simplify_history():
    if not os.path.exists(HISTORY_FILE):
        print("History file not found.")
        return

    print(f"Loading {HISTORY_FILE}...")
    with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    initial_size = os.path.getsize(HISTORY_FILE)
    print(f"Initial Size: {initial_size / 1024:.2f} KB")

    new_data = {}
    
    for url, value in data.items():
        # Handle both old format (dict) and potentially already simple format
        if isinstance(value, dict):
            timestamp = value.get('timestamp')
            if not timestamp:
                timestamp = datetime.now(timezone.utc).isoformat()
            new_data[url] = timestamp
        else:
            # Assume it's already a timestamp string or simple value
            new_data[url] = str(value)

    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)

    final_size = os.path.getsize(HISTORY_FILE)
    print(f"Final Count: {len(new_data)} items")
    print(f"Final Size: {final_size / 1024:.2f} KB")
    print(f"Reduced by: {(initial_size - final_size) / 1024:.2f} KB")
    print("Simplification Complete.")

if __name__ == "__main__":
    simplify_history()
