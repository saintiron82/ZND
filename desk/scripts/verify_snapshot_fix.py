
import os
import sys

# Add desk folder to path
script_dir = os.path.dirname(os.path.abspath(__file__))
desk_dir = os.path.dirname(script_dir)
sys.path.insert(0, desk_dir)

from src.core.article_manager import _format_article_for_snapshot

def test_snapshot_format():
    # Case 1: Schema 3.1 - source_id in header
    article_v3 = {
        '_header': {
            'article_id': 'test_v3',
            'source_id': 'source_v3',
            'url': 'http://test.com/v3',
            'created_at': '2026-01-07T12:00:00'
        },
        '_original': {
            'title': 'Test Title V3',
            # source_id missing in original (simulating new schema)
        },
        '_analysis': {},
        '_classification': {}
    }
    
    snapshot_v3 = _format_article_for_snapshot(article_v3)
    print("Test Case 1 (Schema 3.1):")
    print(f"  Source ID: {snapshot_v3.get('source_id')}")
    print(f"  URL: {snapshot_v3.get('url')}")
    
    if snapshot_v3.get('source_id') == 'source_v3' and snapshot_v3.get('url') == 'http://test.com/v3':
        print("  ✅ PASS")
    else:
        print("  ❌ FAIL")

    print("-" * 20)

    # Case 2: Schema 2.0 - source_id in original (Backward Compatibility)
    article_v2 = {
        '_header': {
            'article_id': 'test_v2',
            'created_at': '2025-12-31T12:00:00'
        },
        '_original': {
            'source_id': 'source_v2',
            'url': 'http://test.com/v2',
            'title': 'Test Title V2'
        },
        '_analysis': {},
        '_classification': {}
    }
    
    snapshot_v2 = _format_article_for_snapshot(article_v2)
    print("Test Case 2 (Backward Compatibility):")
    print(f"  Source ID: {snapshot_v2.get('source_id')}")
    print(f"  URL: {snapshot_v2.get('url')}")
    
    if snapshot_v2.get('source_id') == 'source_v2' and snapshot_v2.get('url') == 'http://test.com/v2':
        print("  ✅ PASS")
    else:
        print("  ❌ FAIL")

if __name__ == '__main__':
    test_snapshot_format()
