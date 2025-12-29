# -*- coding: utf-8 -*-
"""
ZND Desk - Flask Application Entry Point
새 Desk 시스템 메인 앱
"""
import os
from dotenv import load_dotenv
from flask import Flask, redirect, render_template

# 환경 변수 로드
base_dir = os.path.dirname(__file__)
env_path = os.path.join(base_dir, '.env')
load_dotenv(env_path)

app = Flask(__name__, 
    template_folder='templates',
    static_folder='static'
)


# =============================================================================
# Blueprint 등록
# =============================================================================

from src.api.analyzer import analyzer_bp
from src.api.publisher import publisher_bp
from src.api.board import board_bp
from src.api.settings import settings_bp
from src.api.collector import collector_bp

app.register_blueprint(analyzer_bp)
app.register_blueprint(publisher_bp)
app.register_blueprint(board_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(collector_bp)


# =============================================================================
# Root Route
# =============================================================================

@app.route('/')
def index():
    """기본 진입점 - 보드(Board)로 리다이렉트"""
    return redirect('/board')


@app.route('/settings')
def settings():
    """설정 페이지 (추후 구현)"""
    return "설정 페이지 (구현 예정)"

@app.route('/inspector')
def inspector_page():
    """Independent Inspector V2 Window"""
    return render_template('inspector_v2.html', active='inspector')


# =============================================================================
# Health Check
# =============================================================================

@app.route('/health')
def health():
    """헬스 체크"""
    return {'status': 'ok', 'version': os.getenv('SCHEMA_VERSION', '3.0')}


# =============================================================================
# Run Server
# =============================================================================

if __name__ == '__main__':
    port = int(os.getenv('DESK_PORT', 5001))
    debug = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'
    
    # Initialize Article Registry (SSOT for article metadata)
    from src.core.article_registry import init_registry
    from src.core.firestore_client import FirestoreClient
    
    print("📦 Initializing Article Registry...")
    db_client = FirestoreClient()
    init_registry(db_client=db_client)
    
    print(f"🚀 ZND Desk v2.0 starting on port {port}...")
    print(f"📍 Analyzer: http://localhost:{port}/analyzer")
    print(f"📍 Publisher: http://localhost:{port}/publisher")
    print(f"📍 Board: http://localhost:{port}/board")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
