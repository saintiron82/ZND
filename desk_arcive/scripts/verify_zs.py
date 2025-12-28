import os
import json
import glob
import sys

# Windows console encoding fix
sys.stdout.reconfigure(encoding='utf-8')

def calculate_zs(data):
    """
    Calculates ZeroEcho Score based on Direct Noise Logic (User Requirement).
    Start at 5.0.
    Credits (Good) -> Decrease Score (-)
    Penalties (Bad) -> Increase Score (+)
    Modifiers -> Subtract Effect (assuming effect was Quality-positive)
    Target: Lower is Better (0.0 best)
    """
    
    # 1. Base Noise Level
    ZS = 5.0
    
    evidence = data.get('evidence', {})
    
    # 2. Credits (Good -> Reduce Noise)
    credits = evidence.get('credits', [])
    credit_sum = 0.0
    for item in credits:
        val = float(item.get('value', 0.0))
        ZS -= val
        credit_sum += val
        
    # 3. Penalties (Bad -> Increase Noise)
    penalties = evidence.get('penalties', [])
    penalty_sum = 0.0
    for item in penalties:
        val = float(item.get('value', 0.0))
        ZS += val
        penalty_sum += val

    # 4. Modifiers (Quality Additive -> Noise Subtractive)
    # If effect is positive (Good), ZS decreases.
    modifiers = evidence.get('modifiers', [])
    modifier_sum = 0.0
    for item in modifiers:
        effect = float(item.get('effect', 0.0))
        ZS -= effect
        modifier_sum += effect
        
    # 5. Clamping (0.0 to 10.0)
    ZS_final = max(0.0, min(10.0, ZS))
    
    # Round
    ZS_final = round(ZS_final, 2)
    
    debug_info = {
        'base': 5.0,
        'credits_sub': credit_sum,
        'penalties_add': penalty_sum,
        'modifiers_sub': modifier_sum,
        'ZS_raw': ZS,
        'ZS_final': ZS_final
    }
    
    return ZS_final, debug_info

def verify_files(data_dir):
    print(f"🔍 Searching for JSON files in: {data_dir}")
    # glob pattern to find all json files recursively or in date folders
    # Current structure is data/YYYY-MM-DD/*.json
    files = glob.glob(os.path.join(data_dir, "**", "*.json"), recursive=True)
    
    print(f"📂 Found {len(files)} files.")
    
    error_count = 0
    passed_count = 0
    
    for file_path in files:
        # Skip if not a file
        if not os.path.isfile(file_path):
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Skip if basic fields are missing (might be a non-article json)
            if 'zero_echo_score' not in data:
                continue
                
            recorded_zs = float(data.get('zero_echo_score', 0))
            calculated_zs, debug = calculate_zs(data)
            
            # Allow small float error
            diff = abs(recorded_zs - calculated_zs)
            
            if diff > 0.1:
                error_count += 1
                print(f"\n❌ [MISMATCH] {os.path.basename(file_path)}")
                print(f"   Title: {data.get('title_ko')}")
                print(f"   Recorded ZS: {recorded_zs}")
                print(f"   Calculated ZS: {calculated_zs} (Diff: {diff:.2f})")
                print(f"   Debug: {debug}")
            else:
                passed_count += 1
                # print(f"✅ [MATCH] {os.path.basename(file_path)} (ZS: {recorded_zs})")
                
        except Exception as e:
            print(f"⚠️ Error processing {os.path.basename(file_path)}: {e}")
            
    print(f"\n📊 Verification Complete.")
    print(f"   Total Checked: {passed_count + error_count}")
    print(f"   ✅ Passed: {passed_count}")
    print(f"   ❌ Failed: {error_count}")

if __name__ == "__main__":
    # Assuming script is run from supplier directory or similar, but let's use absolute path relative to script location
    # Script is in d:\ZED\supplier\scripts\verify_zs.py
    # Data is in d:\ZED\supplier\data
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, 'data')
    
    verify_files(data_dir)
