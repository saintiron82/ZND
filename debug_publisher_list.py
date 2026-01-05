
import os
import sys
from datetime import datetime

# Setup path
sys.path.append(os.path.join(os.getcwd(), 'desk'))
from src.core.article_registry import ArticleRegistry

# Initialize Registry (Mock DB to avoid issues, or readonly)
registry = ArticleRegistry()
registry.initialize(cache_root=os.path.join(os.getcwd(), 'cache', 'dev'))

print(f"Registry initialized. Total articles: {registry.count()}")

# Get Classified
classified = registry.find_by_state('CLASSIFIED', limit=100)
print(f"Found {len(classified)} CLASSIFIED articles.")

print("-" * 60)
print(f"{'Title':<30} | {'Created At':<20} | {'Updated At':<20}")
print("-" * 60)

for art in classified:
    print(f"{art.title[:28]:<30} | {art.created_at[:19]:<20} | {art.updated_at[:19]:<20}")

print("-" * 60)
