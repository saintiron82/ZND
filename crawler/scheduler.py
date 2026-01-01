# -*- coding: utf-8 -*-
"""
ZND Crawler Scheduler - PM2 Entry Point
APScheduler 기반 독립 스케줄러

실행: python scheduler.py
PM2: pm2 start ecosystem.config.js

[V2] desk 코어 기반 통합 파이프라인 사용
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
DESK_DIR = os.path.join(ZND_ROOT, 'desk')

# Add paths for imports
sys.path.insert(0, CRAWLER_DIR)  # for core.xxx
sys.path.insert(0, ZND_ROOT)     # for crawler.xxx (when called from outside)
sys.path.insert(0, DESK_DIR)     # for desk modules

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

# [V2] desk 통합 파이프라인 사용 (기존 extractor 대체)
from src.scheduler_pipeline import (
    run_pipeline, 
    PipelinePhase,
    PHASES_COLLECT_ONLY,
    PHASES_UNTIL_PUBLISH
)
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


def run_scheduled_crawl(schedule_name: str = "Scheduled", phases: list = None):
    """
    스케줄에 의해 호출되는 크롤링 작업
    
    [V2] desk 통합 파이프라인 사용
    """
    print(f"\n{'='*50}")
    print(f"⏰ [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scheduled crawl triggered")
    print(f"📋 Schedule: {schedule_name}")
    print(f"{'='*50}\n")
    
    try:
        # [V2] 새 파이프라인 사용 (desk 코어 직접 호출)
        if phases is None:
            phases = PHASES_COLLECT_ONLY  # 기본: 수집만
        
        result = run_pipeline(phases=phases, schedule_name=schedule_name)
        log_crawl_event("Scheduled", f"Pipeline completed: {result.message}", 0, success=result.success)
        
        # 디스코드 알림
        if result.collected > 0 or result.extracted > 0:
            try:
                from core.discord_notifier import send_simple_message
                send_simple_message(
                    f"📡 {schedule_name} 완료\n{result.message}",
                    "🕐 스케줄 수집"
                )
            except Exception as e:
                print(f"⚠️ [Discord] Notification failed: {e}")
                
    except Exception as e:
        log_crawl_event("Scheduled", f"Pipeline failed: {str(e)}", 0, success=False)
        print(f"❌ Scheduled crawl error: {e}")


def run_scheduled_sync():
    """스케줄에 의해 호출되는 캐시 동기화 작업"""
    print(f"\n{'='*50}")
    print(f"☁️ [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scheduled sync triggered")
    print(f"{'='*50}\n")
    
    try:
        # desk 모듈의 db_client 사용
        from src.db_client import DBClient
        import os as sync_os
        
        db = DBClient()
        if not db.db:
            print("❌ [Sync] Firestore 연결 실패")
            return
        
        CACHE_DIR = sync_os.path.join(ZND_ROOT, 'desk', 'cache')
        synced_count = 0
        skipped_count = 0
        
        # 모든 날짜 폴더 동기화
        if sync_os.path.exists(CACHE_DIR):
            for date_folder in sync_os.listdir(CACHE_DIR):
                if not sync_os.path.isdir(sync_os.path.join(CACHE_DIR, date_folder)):
                    continue
                if len(date_folder) != 10:  # YYYY-MM-DD 형식만
                    continue
                
                cache_date_dir = sync_os.path.join(CACHE_DIR, date_folder)
                cache_list = []
                
                import json as sync_json
                from datetime import timezone
                
                for filename in sync_os.listdir(cache_date_dir):
                    if not filename.endswith('.json'):
                        continue
                    
                    filepath = sync_os.path.join(cache_date_dir, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8-sig') as f:
                            cache_data = sync_json.load(f)
                        
                        # synced_at이 있으면 스킵
                        synced_at = cache_data.get('synced_at')
                        updated_at = cache_data.get('updated_at') or cache_data.get('staged_at')
                        
                        if synced_at:
                            if updated_at and updated_at > synced_at:
                                pass  # 변경됨 -> 업로드
                            else:
                                skipped_count += 1
                                continue
                        
                        article_id = cache_data.get('article_id')
                        if not article_id:
                            article_id = filename.replace('.json', '')
                            cache_data['article_id'] = article_id
                        
                        cache_list.append(cache_data)
                    except:
                        pass
                
                # 배치 업로드
                if cache_list:
                    now = datetime.now(timezone.utc).isoformat()
                    for cache_data in cache_list:
                        cache_data['synced_at'] = now
                    
                    result = db.upload_cache_batch(date_folder, cache_list)
                    synced_count += result.get('success', 0)
                    
                    # 로컬 파일에 synced_at 마킹
                    for cache_data in cache_list:
                        article_id = cache_data.get('article_id')
                        filepath = sync_os.path.join(cache_date_dir, f"{article_id}.json")
                        if sync_os.path.exists(filepath):
                            try:
                                with open(filepath, 'r', encoding='utf-8-sig') as f:
                                    file_data = sync_json.load(f)
                                file_data['synced_at'] = now
                                with open(filepath, 'w', encoding='utf-8') as f:
                                    sync_json.dump(file_data, f, ensure_ascii=False, indent=2)
                            except:
                                pass
        
        print(f"☁️ [Sync] 동기화 완료: {synced_count}개, 스킵: {skipped_count}개")
        log_crawl_event("Sync", f"Synced {synced_count} items", 0, success=True)
        
        # Discord 알림 전송
        if synced_count > 0:
            try:
                from core.discord_notifier import send_simple_message
                send_simple_message(
                    f"캐시 {synced_count}개 동기화 완료 (스킵: {skipped_count}개)",
                    "☁️ 자동 동기화"
                )
            except Exception as e:
                print(f"⚠️ [Discord] 알림 실패: {e}")
        
    except Exception as e:
        log_crawl_event("Sync", f"Sync failed: {str(e)}", 0, success=False)
        print(f"❌ Scheduled sync error: {e}")


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
            
            # [V2] phases 파싱 (schedules.json에서 지정 가능)
            phases_config = sched.get('phases', ['collect', 'extract'])
            phases = []
            for phase_name in phases_config:
                try:
                    phases.append(PipelinePhase(phase_name.lower()))
                except ValueError:
                    print(f"⚠️ Unknown phase: {phase_name}")
            
            if not phases:
                phases = PHASES_COLLECT_ONLY
            
            try:
                trigger = CronTrigger(
                    minute=parts[0] if len(parts) > 0 else '0',
                    hour=parts[1] if len(parts) > 1 else '*',
                    day=parts[2] if len(parts) > 2 else '*',
                    month=parts[3] if len(parts) > 3 else '*',
                    day_of_week=parts[4] if len(parts) > 4 else '*'
                )
                
                # [V2] phases 인자 추가
                scheduler.add_job(
                    run_scheduled_crawl,
                    trigger,
                    args=[sched.get('name', 'Unnamed'), phases],
                    id=sched.get('id', f"job_{sched.get('name', 'unknown')}"),
                    name=sched.get('name', 'Unnamed')
                )
                print(f"✅ Registered: {sched.get('name')} ({cron}) - phases: {[p.value for p in phases]}")
            except Exception as e:
                print(f"⚠️ Failed to register schedule '{sched.get('name')}': {e}")
    
    # 자동 동기화 스케줄 추가 (매일 23시)
    scheduler.add_job(
        run_scheduled_sync,
        CronTrigger(hour=23, minute=0),
        id='auto_sync',
        name='자동 동기화 (23시)'
    )
    print("✅ Registered: 자동 동기화 (23:00)")
    
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
