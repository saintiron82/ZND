
import sys
import os

# Add the project directory to sys.path
sys.path.append(os.getcwd())

try:
    from src.score_engine import calculate_zes_v1
    print("Loaded from src.score_engine")
except ImportError:
    try:
        from src.core.score_engine import calculate_zes_v1
        print("Loaded from src.core.score_engine")
    except ImportError:
        print("Could not load score_engine")
        sys.exit(1)

def test_score():
    # perfect article
    sample_data_good = {
        'Signal': {'T1': 10, 'T2': 10, 'T3': 10},
        'Noise': {'P1': 0, 'P2': 0, 'P3': 0},
        'Utility': {'V1': 10, 'V2': 10, 'V3': 10},
        'Fine_Adjustment': {'Score': 0}
    }
    
    score_good, _ = calculate_zes_v1(sample_data_good)
    print(f"Perfect Article (Expected ~10): {score_good}")

    # bad article
    sample_data_bad = {
        'Signal': {'T1': 0, 'T2': 0, 'T3': 0},
        'Noise': {'P1': 10, 'P2': 10, 'P3': 10},
        'Utility': {'V1': 1, 'V2': 1, 'V3': 1},
        'Fine_Adjustment': {'Score': 0}
    }
    
    score_bad, _ = calculate_zes_v1(sample_data_bad)
    print(f"Bad Article (Expected ~0): {score_bad}")

if __name__ == "__main__":
    test_score()
