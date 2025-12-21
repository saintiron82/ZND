# Routes module - Flask Blueprint 모음
# 각 Blueprint를 여기서 import하여 manual_crawler.py에서 쉽게 등록

from .automation import automation_bp
from .desk import desk_bp
from .publications import publications_bp
from .batch import batch_bp
from .crawler import crawler_bp
from .cleanup import cleanup_bp

__all__ = [
    'automation_bp',
    'desk_bp', 
    'publications_bp',
    'batch_bp',
    'crawler_bp',
    'cleanup_bp'
]
