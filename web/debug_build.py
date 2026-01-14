import subprocess
import os

print("Starting build...")
try:
    # Set CI=true to reduce noise
    env = os.environ.copy()
    env["CI"] = "true"
    
    result = subprocess.run(['npm.cmd', 'run', 'build'], cwd=r'c:\Users\saint\ZND\web', capture_output=True, text=True, encoding='utf-8', env=env)
    print("Return Code:", result.returncode)
    print("STDOUT ------------------------------------------------")
    print(result.stdout)
    print("STDERR ------------------------------------------------")
    print(result.stderr)
except Exception as e:
    print("Python Exception:", e)
