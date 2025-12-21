import sys
import os
sys.path.append(os.getcwd())

print("Importing HttpFetcher...")
try:
    from src.crawler.fetcher import HttpFetcher
    print("HttpFetcher imported.")
except Exception as e:
    print(f"Failed to import HttpFetcher: {e}")

print("Importing CompositeExtractor...")
try:
    from src.crawler.extractor import CompositeExtractor
    print("CompositeExtractor imported.")
except Exception as e:
    print(f"Failed to import CompositeExtractor: {e}")
