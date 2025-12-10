import os
import json
import glob
import argparse
import sys

# Windows console encoding fix
sys.stdout.reconfigure(encoding='utf-8')

def cleanup(data_dir, dry_run=True):
    print(f"🔍 Scanning {data_dir} for High Noise (NS >= 7.0) articles...")
    files = glob.glob(os.path.join(data_dir, "**", "*.json"), recursive=True)
    
    targets = []
    
    for file_path in files:
        if not os.path.isfile(file_path): continue
        if os.path.basename(file_path) == 'index.json': continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check Zero Noise Score
            zs = float(data.get('zero_echo_score', 0))
            if zs >= 7.0:
                targets.append((file_path, zs, data.get('title_ko')))
                
        except Exception:
            pass
            
    print(f"🧐 Found {len(targets)} files with NS >= 7.0.")
    
    for path, zs, title in targets:
        action = "DELETE" if not dry_run else "FOUND"
        print(f"[{action}] NS:{zs} | {title} \n      -> {os.path.basename(path)}")
        
        if not dry_run:
            try:
                os.remove(path)
                print(f"      ✅ Deleted.")
            except Exception as e:
                print(f"      ❌ Error deleting: {e}")
                
    if dry_run:
        if targets:
            print("\n⚠️ This was a DRY RUN (Simulation).")
            print("Run with '--force' to actually delete these files.")
            print(f"Example: python {os.path.basename(__file__)} --force")
        else:
            print("\n✅ No high noise files found.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup high noise articles (NS >= 7.0)")
    parser.add_argument('--force', action='store_true', help='Actually delete files (disable dry-run)')
    args = parser.parse_args()
    
    # Locate data directory relative to this script
    # script is in /supplier/scripts/
    # data is in /supplier/data/
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, 'data')
    
    cleanup(data_dir, dry_run=not args.force)
