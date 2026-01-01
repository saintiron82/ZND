# -*- coding: utf-8 -*-
"""
ZND Desk - Flask Application Entry Point
새 Desk 시스템 메인 앱
"""
import os
from dotenv import load_dotenv
from flask import Flask, redirect, render_template, request, Response

# 환경 변수 로드
base_dir = os.path.dirname(__file__)
env_path = os.path.join(base_dir, '.env')
load_dotenv(env_path)

app = Flask(__name__, 
    template_folder='templates',
    static_folder='static'
)

# =============================================================================
# Context Processor - 환경 정보를 모든 템플릿에 전달
# =============================================================================

@app.context_processor
def inject_env():
    """모든 템플릿에서 znd_env 변수 사용 가능"""
    return {
        'znd_env': os.getenv('ZND_ENV', 'dev')
    }


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
# Authentication
# =============================================================================

def check_auth(username, password):
    """Check if a username / password combination is valid."""
    expected_username = os.getenv('DESK_USERNAME')
    expected_password = os.getenv('DESK_PASSWORD')
    
    # 환경 변수가 설정되지 않은 경우 (보안을 위해 차단)
    if not expected_username or not expected_password:
        return False
        
    return username == expected_username and password == expected_password

def authenticate():
    """Sends a 401 response that enables basic auth"""
    return Response(
    'Could not verify your access level for that URL.\n'
    'You have to login with proper credentials', 401,
    {'WWW-Authenticate': 'Basic realm="ZND Desk Login Required"'})

@app.before_request
def require_auth():
    """모든 요청에 대해 인증 확인 (Health Check 제외)"""
    # Health Check는 로드밸런서/모니터링을 위해 제외
    if request.path == '/health':
        return
    
    # 정적 파일도 보호할지 여부는 선택사항이나, "모든 사이트 차단" 요청이므로 포함.
    # 단, 브라우저가 favicon 등을 요청할 때 인증 prompt가 중복으로 뜰 수 있으므로
    # 이미 인증된 세션(브라우저가 헤더 저장)을 사용하므로 큰 문제 없음.
    
    auth = request.authorization
    if not auth or not check_auth(auth.username, auth.password):
        return authenticate()


# =============================================================================
# Root Route
# =============================================================================

@app.route('/')
def index():
    """기본 진입점 - 보드(Board)로 리다이렉트"""
    return redirect('/board')


@app.route('/desk')
def desk_redirect():
    """Desk 진입점 - Board로 리다이렉트 (Nginx 호환성)"""
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
    port = int(os.getenv('DESK_PORT', 5500))
    debug = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'
    
    # Flask reloader 중복 초기화 방지
    # debug 모드에서 reloader가 프로세스를 두 번 시작함 (parent + child)
    # WERKZEUG_RUN_MAIN이 설정된 프로세스(child)에서만 초기화 실행
    is_reloader_process = os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
    
    if not debug or is_reloader_process:
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
    else:
        print("⏳ Flask reloader starting... (initialization will run in child process)")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
