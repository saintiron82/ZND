
import os
import sys

# Ensure d:\ZND\desk is in path
current_dir = os.getcwd()
if current_dir not in sys.path:
    sys.path.append(current_dir)

try:
    from src.core.article_registry import ArticleRegistry
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

# Initialize
registry = ArticleRegistry()
# Set cache root explicitly to avoid env var issues
cache_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'cache', 'dev'))
print(f"Cache Root: {cache_root}")

registry.initialize(cache_root=cache_root)

print(f"Total articles: {registry.count()}")

# Get Classified
classified = registry.find_by_state('CLASSIFIED', limit=100)
print(f"Found {len(classified)} CLASSIFIED articles.")

print("-" * 80)
print(f"{'Title':<40} | {'Created At':<20} | {'Updated At':<20}")
print("-" * 80)

for art in classified:
    print(f"{art.title[:38]:<40} | {art.created_at[:19]:<20} | {art.updated_at[:19]:<20}")

print("-" * 80)
