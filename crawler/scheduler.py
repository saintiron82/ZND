# -*- coding: utf-8 -*-
"""
ZND Crawler Scheduler - PM2 Entry Point
APScheduler 기반 독립 스케줄러

실행: python scheduler.py
PM2: pm2 start ecosystem.config.js
"""
import os
import sys
import json
import signal
import time
from datetime import datetime

# 경로 설정
CRAWLER_DIR = os.path.dirname(os.path.abspath(__file__))
ZND_ROOT = os.path.dirname(CRAWLER_DIR)

# Add paths for imports
sys.path.insert(0, CRAWLER_DIR)  # for core.xxx
sys.path.insert(0, ZND_ROOT)     # for crawler.xxx (when called from outside)
sys.path.insert(0, os.path.join(ZND_ROOT, 'desk'))  # for desk modules

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

# Use relative imports (core.xxx) since we're inside crawler directory
from core.extractor import run_full_pipeline
from core.logger import log_crawl_event

# 설정 파일 경로
CONFIG_DIR = os.path.join(CRAWLER_DIR, 'config')
SCHEDULES_FILE = os.path.join(CONFIG_DIR, 'schedules.json')


def load_schedules() -> list:
    """스케줄 설정 로드"""
    if not os.path.exists(SCHEDULES_FILE):
        return []
    try:
        with open(SCHEDULES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('schedules', [])
    except Exception as e:
        print(f"❌ Failed to load schedules: {e}")
        return []


def save_schedules(schedules: list):
    """스케줄 설정 저장"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SCHEDULES_FILE, 'w', encoding='utf-8') as f:
        json.dump({'schedules': schedules}, f, indent=2, ensure_ascii=False)


def run_scheduled_crawl():
    """스케줄에 의해 호출되는 크롤링 작업"""
    print(f"\n{'='*50}")
    print(f"⏰ [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scheduled crawl triggered")
    print(f"{'='*50}\n")
    
    try:
        result = run_full_pipeline()
        log_crawl_event("Scheduled", f"Pipeline completed: {result.get('message', 'OK')}", 0, success=result.get('success', True))
    except Exception as e:
        log_crawl_event("Scheduled", f"Pipeline failed: {str(e)}", 0, success=False)
        print(f"❌ Scheduled crawl error: {e}")


def create_scheduler() -> BlockingScheduler:
    """스케줄러 생성 및 작업 등록"""
    scheduler = BlockingScheduler(timezone='Asia/Seoul')
    
    schedules = load_schedules()
    
    if not schedules:
        # 기본 스케줄: 매 6시간마다
        print("📋 No schedules found. Using default: every 6 hours")
        scheduler.add_job(
            run_scheduled_crawl,
            CronTrigger(hour='*/6', minute=0),
            id='default_crawl',
            name='Default 6-hour Crawl'
        )
    else:
        for sched in schedules:
            if not sched.get('enabled', True):
                continue
            
            cron = sched.get('cron', '0 8 * * *')  # 기본: 매일 8시
            parts = cron.split()
            
            try:
                trigger = CronTrigger(
                    minute=parts[0] if len(parts) > 0 else '0',
                    hour=parts[1] if len(parts) > 1 else '*',
                    day=parts[2] if len(parts) > 2 else '*',
                    month=parts[3] if len(parts) > 3 else '*',
                    day_of_week=parts[4] if len(parts) > 4 else '*'
                )
                
                scheduler.add_job(
                    run_scheduled_crawl,
                    trigger,
                    id=sched.get('id', f"job_{sched.get('name', 'unknown')}"),
                    name=sched.get('name', 'Unnamed')
                )
                print(f"✅ Registered: {sched.get('name')} ({cron})")
            except Exception as e:
                print(f"⚠️ Failed to register schedule '{sched.get('name')}': {e}")
    
    return scheduler


def signal_handler(signum, frame):
    """종료 시그널 처리"""
    print("\n🛑 Shutdown signal received. Stopping scheduler...")
    sys.exit(0)


def main():
    """메인 함수"""
    print(f"""
╔══════════════════════════════════════════════════╗
║       🕐 ZND Crawler Scheduler                   ║
║       Independent Background Service             ║
╚══════════════════════════════════════════════════╝

Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Config Dir: {CONFIG_DIR}
    """)
    
    # 종료 시그널 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 스케줄러 생성 및 시작
    scheduler = create_scheduler()
    
    print("\n📅 Registered Jobs:")
    for job in scheduler.get_jobs():
        print(f"   - {job.name}: {job.trigger}")
    
    print("\n🚀 Scheduler is running. Press Ctrl+C to stop.\n")
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("\n👋 Scheduler stopped.")


if __name__ == '__main__':
    main()
