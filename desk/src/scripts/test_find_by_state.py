import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.core.article_registry import get_registry
from src.core.article_manager import ArticleManager
from src.core.article_state import ArticleState

def test_find_by_state():
    registry = get_registry()
    
    if not registry.is_initialized():
        print("Registry not initialized!")
        return
    
    print(f"Registry initialized: {registry.is_initialized()}")
    print(f"Total articles in registry: {registry.count()}")
    
    # Check COLLECTED state
    collected_infos = registry.find_by_state('COLLECTED', limit=5)
    print(f"\nRegistry.find_by_state('COLLECTED'): {len(collected_infos)} items")
    
    for info in collected_infos[:3]:
        print(f"  - {info.article_id}: {info.title[:40]}...")
    
    # Now test ArticleManager.find_by_state
    print("\n--- ArticleManager.find_by_state ---")
    manager = ArticleManager()
    articles = manager.find_by_state(ArticleState.COLLECTED, limit=5)
    print(f"ArticleManager.find_by_state(COLLECTED): {len(articles)} items")
    
    for art in articles[:3]:
        header = art.get('_header', {})
        original = art.get('_original', {})
        print(f"  - {header.get('article_id')}: {original.get('title', '')[:40]}...")

if __name__ == "__main__":
    test_find_by_state()
