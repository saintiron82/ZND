# src/crawler_state.py
# 크롤링 상태 관리 - 독립 크롤러 모듈과 통합
import sys
import os

# Add crawler module to path
CRAWLER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'crawler')
if CRAWLER_DIR not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# 상태 변수 (메모리 내)
_is_crawling = False
_current_task = ""


def set_crawling(status: bool, task: str = ""):
    """크롤링 상태 설정"""
    global _is_crawling, _current_task
    _is_crawling = status
    _current_task = task if status else ""


def get_crawling_status():
    """크롤링 상태 조회"""
    global _is_crawling, _current_task
    return {
        "is_crawling": _is_crawling,
        "current_task": _current_task
    }


# 로깅 함수 - crawler/logs/crawler_history.jsonl에 기록
def log_crawl_event(action: str, result: str, duration: float, success: bool = True):
    """실행 이력 기록 (crawler/logs/crawler_history.jsonl)"""
    import json
    from datetime import datetime
    
    # 독립 스케줄러의 로그 파일 경로
    ZND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    LOG_FILE = os.path.join(ZND_ROOT, 'crawler', 'logs', 'crawler_history.jsonl')
    
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action, 
            "result": result,
            "duration": round(duration, 2),
            "success": success
        }
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        print(f"📝 [Log] {action}: {result} ({duration:.2f}s)")
    except Exception as e:
        print(f"❌ Log save failed: {e}")


def get_crawl_logs(limit: int = 10):
    """최근 로그 조회 (crawler/logs/crawler_history.jsonl)"""
    import json
    
    # 독립 스케줄러의 로그 파일 경로
    ZND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    LOG_FILE = os.path.join(ZND_ROOT, 'crawler', 'logs', 'crawler_history.jsonl')
    
    if not os.path.exists(LOG_FILE):
        return []
    
    logs = []
    try:
        with open(LOG_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    logs.append(json.loads(line))
    except:
        return []
    
    return sorted(logs, key=lambda x: x.get('timestamp', ''), reverse=True)[:limit]


