#!/usr/bin/env python3
"""
Staging -> Desk 전면 변경 스크립트
manual_crawler.py의 라우트, API 경로, 함수명을 안전하게 변경합니다.
"""

import re

def apply_changes():
    with open('manual_crawler.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. API 경로 변경: /api/staging/ -> /api/desk/
    content = content.replace("/api/staging/", "/api/desk/")
    
    # 2. 라우트 변경: /staging -> /desk
    content = content.replace("@app.route('/staging')", "@app.route('/desk')\n@app.route('/')")
    
    # 3. 템플릿 변경: staging.html -> desk.html
    content = content.replace("render_template('staging.html')", "render_template('desk.html')")
    
    # 4. 함수명 변경
    content = content.replace("def staging_preview(", "def desk_view(")
    content = content.replace("def staging_list(", "def desk_list(")
    content = content.replace("def staging_file(", "def desk_file(")
    content = content.replace("def staging_update_categories(", "def desk_update_categories(")
    content = content.replace("def staging_reset_dedup(", "def desk_reset_dedup(")
    content = content.replace("def staging_delete_legacy(", "def desk_delete_legacy(")
    content = content.replace("def staging_delete_file(", "def desk_delete_file(")
    
    # 5. 기존 메인 라우트 변경: / -> /crawler
    content = content.replace("@app.route('/')\ndef index():", "@app.route('/crawler')\ndef crawler():")
    
    with open('manual_crawler.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 변경 완료!")
    print("   - API 경로: /api/staging/* -> /api/desk/*")
    print("   - 라우트: /staging -> /desk, / -> desk, /crawler -> 크롤러")
    print("   - 템플릿: staging.html -> desk.html")
    print("   - 함수명: staging_* -> desk_*")

if __name__ == "__main__":
    apply_changes()
