# -*- coding: utf-8 -*-
"""
Crawler Logger - 크롤링 실행 로그 기록
"""
import os
import json
from datetime import datetime

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
LOG_FILE = os.path.join(LOG_DIR, 'crawler_history.jsonl')


def log_crawl_event(action: str, result: str, duration: float, success: bool = True):
    """실행 이력을 파일에 기록"""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        
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


def get_crawl_logs(limit: int = 20) -> list:
    """최근 로그 조회"""
    if not os.path.exists(LOG_FILE):
        return []
    
    logs = []
    try:
        with open(LOG_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    logs.append(json.loads(line))
    except Exception:
        return []
    
    # 최신순 정렬
    return sorted(logs, key=lambda x: x['timestamp'], reverse=True)[:limit]
