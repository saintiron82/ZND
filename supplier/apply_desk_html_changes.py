#!/usr/bin/env python3
"""
desk.html에서 staging 관련 텍스트를 desk로 변경합니다.
"""

def apply_changes():
    with open('templates/desk.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # UI 텍스트 변경
    content = content.replace('Staging Preview', '📰 편집 데스크 (Desk)')
    content = content.replace('Staging', 'Desk')
    content = content.replace('staging', 'desk')
    
    # API 경로 변경
    content = content.replace('/api/staging/', '/api/desk/')
    
    # 함수명 변경 (JavaScript)
    content = content.replace('loadStaging', 'loadDesk')
    content = content.replace('stagingData', 'deskData')
    
    with open('templates/desk.html', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ desk.html 변경 완료!")

if __name__ == "__main__":
    apply_changes()
