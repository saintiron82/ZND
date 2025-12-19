
import sys
import os
sys.path.append(os.getcwd())

try:
    print("Importing manual_crawler...")
    import manual_crawler
    print("✅ manual_crawler imported successfully.")
except ImportError as e:
    print(f"❌ ImportError: {e}")
except SyntaxError as e:
    print(f"❌ SyntaxError: {e}")
except Exception as e:
    # manual_crawler might try to init Flask or DB on import, so just catching generic exception
    # if it fails due to runtime config that's distinct from code structure.
    print(f"⚠️ Exception during import (might be normal if config missing): {e}")
