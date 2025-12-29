import json
import os

CACHE_DIR = r"c:\Users\saint\ZND\desk_arcive\cache"
HISTORY_FILE = os.path.join(CACHE_DIR, "crawling_history.json")

def optimize_history():
    if not os.path.exists(HISTORY_FILE):
        print("History file not found.")
        return

    print(f"Loading {HISTORY_FILE}...")
    with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    initial_size = os.path.getsize(HISTORY_FILE)
    print(f"Initial Size: {initial_size / 1024:.2f} KB")

    # Remove 'reason' from all entries
    for url in data:
        if 'reason' in data[url]:
            del data[url]['reason']

    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    final_size = os.path.getsize(HISTORY_FILE)
    print(f"Final Size: {final_size / 1024:.2f} KB")
    print(f"Reduced by: {(initial_size - final_size) / 1024:.2f} KB")
    print("Optimization Complete.")

if __name__ == "__main__":
    optimize_history()
