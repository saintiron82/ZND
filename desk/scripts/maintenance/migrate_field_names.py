"""
Migration script: zero_noise_score → zero_echo_score
Converts all existing JSON data files from old field name to new field name.
"""
import os
import json
from pathlib import Path

def migrate_json_file(file_path):
    """Migrate a single JSON file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Check if zero_noise_score exists
        if 'zero_noise_score' in data:
            # Rename field
            data['zero_echo_score'] = data.pop('zero_noise_score')
            
            # Write back
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
        return False
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def main():
    data_dir = Path(__file__).parent / 'data'
    
    if not data_dir.exists():
        print(f"❌ Data directory not found: {data_dir}")
        return
    
    migrated = 0
    skipped = 0
    
    # Walk through all date directories
    for date_dir in data_dir.iterdir():
        if not date_dir.is_dir():
            continue
            
        # Process JSON files in each date directory
        for json_file in date_dir.glob('*.json'):
            if json_file.name == 'index.json':
                # Also migrate index.json articles
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        index_data = json.load(f)
                    
                    if 'articles' in index_data:
                        changed = False
                        for article in index_data['articles']:
                            if 'zero_noise_score' in article:
                                article['zero_echo_score'] = article.pop('zero_noise_score')
                                changed = True
                        
                        if changed:
                            with open(json_file, 'w', encoding='utf-8') as f:
                                json.dump(index_data, f, ensure_ascii=False, indent=2)
                            print(f"✅ Migrated index: {json_file}")
                            migrated += 1
                        else:
                            skipped += 1
                except Exception as e:
                    print(f"❌ Error processing index {json_file}: {e}")
            else:
                if migrate_json_file(json_file):
                    print(f"✅ Migrated: {json_file.name}")
                    migrated += 1
                else:
                    skipped += 1
    
    print(f"\n📊 Migration Complete!")
    print(f"   ✅ Migrated: {migrated} files")
    print(f"   ⏭️ Skipped: {skipped} files (no zero_noise_score field)")

if __name__ == "__main__":
    main()
