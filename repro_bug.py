
# Standalone reproduction of the crash
try:
    results = [
      { "Article_ID": "1ea11e0eba4e", "Title_KO": "Test 1" },
      "  ",
      { "Article_ID": "eb65e8bd45eb", "Title_KO": "Test 2" }
    ]

    print(f"Processing {len(results)} items...")

    for i, item in enumerate(results):
        print(f"[{i}] Item type: {type(item)}")
        # This is the line from the original analyzer.py that causes the crash
        article_id = (
            item.get('Article_ID') or
            item.get('article_id') or
            item.get('id')
        )
        print(f"    -> Article ID: {article_id}")

except Exception as e:
    print(f"\nCRASH DETECTED: {type(e).__name__}: {e}")
