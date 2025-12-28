
import sys
import os

# Add paths
sys.path.append(r'c:\Users\saint\ZND\desk_arcive\src')
import score_engine as arcive_engine

sys.path.append(r'c:\Users\saint\ZND\desk\src\core')
# Need to be careful about module name collision, but sys.path order might help or we import by path
# Let's simple import function directly if possible or reload
pass

# Definition of User Snippet
data = {
    'Signal': {'T2': 7},
    'Utility': {'V2': 8}
}

print("--- Data ---")
print(data)

print("\n--- Desk Arcive Result ---")
try:
    s, b = arcive_engine.calculate_zes_v1(data)
    print(f"Score: {s}")
    print(f"Breakdown: {b}")
except Exception as e:
    print(f"Error: {e}")

print("\n--- Current Desk Result ---")
# Manually load current engine to avoid path confusion
import importlib.util
spec = importlib.util.spec_from_file_location("current_engine", r"c:\Users\saint\ZND\desk\src\core\score_engine.py")
current_engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(current_engine)

try:
    s, b = current_engine.calculate_zes_v1(data)
    print(f"Score: {s}")
    print(f"Breakdown: {b}")
except Exception as e:
    print(f"Error: {e}")
