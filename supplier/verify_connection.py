import os
import sys

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

try:
    from db_client import DBClient
except ImportError:
    # If specific import fails, try to mock or setup path better? 
    # Actually src/db_client.py exists.
    sys.path.append(os.path.dirname(__file__))
    try:
        from src.db_client import DBClient
    except ImportError as e:
        print(f"Import Error: {e}")
        sys.exit(1)

print("--- Checking Supplier DB Connection ---")
client = DBClient()
if client.db:
    print("✅ Firebase Connected Successfully")
else:
    print("❌ Firebase Connection Failed (Expected if key is missing)")

print("\n--- Checking Local Data ---")
data_dir = os.path.join(os.path.dirname(__file__), 'data')
if os.path.exists(data_dir):
    print(f"✅ Data directory exists: {data_dir}")
    # List recent subdirs
    subdirs = sorted([d for d in os.listdir(data_dir) if os.path.isdir(os.path.join(data_dir, d))], reverse=True)
    if subdirs:
        latest = subdirs[0]
        print(f"✅ Found date directories. Latest: {latest}")
        latest_path = os.path.join(data_dir, latest)
        files = [f for f in os.listdir(latest_path) if f.endswith('.json')]
        print(f"   -> Contains {len(files)} JSON files.")
    else:
        print("⚠️ Data directory exists but no date subdirectories found.")
else:
    print(f"❌ Data directory NOT found at {data_dir}")
