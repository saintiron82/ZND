import sys
import os

# Set path to project root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from src.core.article_manager import ArticleManager
    print("Import successful")
    
    manager = ArticleManager()
    print(f"Manager instance: {manager}")
    
    if hasattr(manager, 'get_editions'):
        print("✅ get_editions exists")
    else:
        print("❌ get_editions MISSING")
        print("Available attributes:", dir(manager))
        
except Exception as e:
    print(f"Error: {e}")
