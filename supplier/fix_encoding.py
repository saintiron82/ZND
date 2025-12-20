import codecs

with open('manual_crawler.py', 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

# Fix line 2240 (index 2239)
lines[2239] = '    """LEGACY_CALL article_id를 가진 파일 삭제"""\n'

with open('manual_crawler.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Fixed line 2240')
