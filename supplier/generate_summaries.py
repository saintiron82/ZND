import os
import sys

# Add src to path to import DBClient
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from db_client import DBClient

def generate_summaries():
    client = DBClient()
    data_dir = client._get_data_dir()
    
    if not os.path.exists(data_dir):
        print(f"Data directory not found: {data_dir}")
        return

    # List all date directories
    date_dirs = [d for d in os.listdir(data_dir) if os.path.isdir(os.path.join(data_dir, d))]
    date_dirs.sort()
    
    print(f"Found {len(date_dirs)} date directories.")
    
    for date_str in date_dirs:
        print(f"Generating summary for {date_str}...")
        client._update_daily_summary(date_str)

if __name__ == "__main__":
    generate_summaries()
