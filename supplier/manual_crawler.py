# -*- coding: utf-8 -*-
"""
ZND Manual Crawler - Flask Application Entry Point
모든 API 라우트는 src/routes/ 모듈에서 Blueprint로 분리됨
"""
import os
from flask import Flask

app = Flask(__name__)

# [Debugging] Force disable caching to ensure frontend updates
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response


# ============================================================================
# Blueprint 등록
# ============================================================================

from src.routes.automation import automation_bp
from src.routes.desk import desk_bp
from src.routes.publications import publications_bp
from src.routes.batch import batch_bp
from src.routes.crawler import crawler_bp
from src.routes.cleanup import cleanup_bp
from src.routes.utility import utility_bp  # New: Utility routes

app.register_blueprint(automation_bp)
app.register_blueprint(desk_bp)
app.register_blueprint(publications_bp)
app.register_blueprint(batch_bp)
app.register_blueprint(crawler_bp)
app.register_blueprint(cleanup_bp)
app.register_blueprint(utility_bp)         # New: Utility routes


# ============================================================================
# Entry Point
# ============================================================================

if __name__ == '__main__':
    # Port 5500 as requested
    app.run(debug=True, port=8000)
