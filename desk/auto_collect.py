#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZED Auto Collect - 단순 수집 스크립트
PM2 cron_restart로 실행되도록 설계

기능:
- 수집 (COLLECT) + 추출 (EXTRACT) 만 수행
- 로컬 캐시 + Firestore 저장
- 분석/발행은 Desk UI에서 수동 처리
- 스케줄별 디스코드 알림 On/Off

실행:
- 로컬: python auto_collect.py
- PM2: cron_restart로 자동 실행
"""
import os
import sys
import json
from datetime import datetime

# Path setup
DESK_DIR = os.path.dirname(os.path.abspath(__file__))
if DESK_DIR not in sys.path:
    sys.path.insert(0, DESK_DIR)

# Load environment
from dotenv import load_dotenv
load_dotenv(os.path.join(DESK_DIR, '.env'))

# Import pipeline
from src.scheduler_pipeline import run_pipeline, PHASES_COLLECT_ONLY


def get_current_schedule():
    """
    현재 시간 기반으로 가장 가까운 스케줄 반환
    실행 시간과 스케줄 시간의 차이가 10분 이내면 매칭
    """
    try:
        config_path = os.path.join(DESK_DIR, 'config', 'auto_crawl_schedule.json')
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        now = datetime.now()
        current_hour = now.hour
        current_minute = now.minute
        
        for schedule in config.get('schedules', []):
            if not schedule.get('enabled', True):
                continue
            
            cron = schedule.get('cron', '')
            parts = cron.split()
            if len(parts) >= 2:
                sched_minute = int(parts[0])
                sched_hour = int(parts[1])
                
                # 시간 차이 계산 (분 단위)
                diff = abs((current_hour * 60 + current_minute) - (sched_hour * 60 + sched_minute))
                
                # 10분 이내면 매칭
                if diff <= 10:
                    return schedule
        
        return None
    except Exception as e:
        print(f"⚠️ [Schedule] 설정 로드 실패: {e}")
        return None


def main():
    """메인 실행 함수"""
    start_time = datetime.now()
    
    # 현재 스케줄 감지
    schedule = get_current_schedule()
    schedule_name = schedule.get('name', 'Auto Collect') if schedule else 'Auto Collect'
    discord_enabled = schedule.get('discord', False) if schedule else False
    
    print(f"""
╔══════════════════════════════════════════════════╗
║       🚀 ZED Auto Collect                        ║
╚══════════════════════════════════════════════════╝

시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}
스케줄: {schedule_name}
디스코드 알림: {'✅ ON' if discord_enabled else '❌ OFF'}
실행 단계: COLLECT → EXTRACT
""")

    try:
        # 수집 + 추출만 실행 (분석 없음!)
        result = run_pipeline(
            phases=PHASES_COLLECT_ONLY,
            schedule_name=schedule_name
        )
        
        # 결과 출력
        duration = (datetime.now() - start_time).total_seconds()
        print(f"""
{'='*50}
✅ 수집 완료!

수집된 링크: {result.collected}개
추출된 기사: {result.extracted}개
소요 시간: {duration:.1f}초

메시지: {result.message}
{'='*50}
""")
        
        # Discord 알림 (스케줄 설정 기반)
        if discord_enabled and (result.collected > 0 or result.extracted > 0):
            try:
                # crawler 경로 추가
                crawler_path = os.path.join(os.path.dirname(DESK_DIR), 'crawler')
                if crawler_path not in sys.path:
                    sys.path.insert(0, crawler_path)
                
                from core.discord_notifier import send_simple_message
                
                # 전체 COLLECTED 상태 기사 수 조회
                from src.core.article_manager import ArticleManager
                manager = ArticleManager()
                total_collected = len(manager.find_collected(limit=1000))
                
                # 메시지 구성
                message = f"[{schedule_name}] ➕ 추가 {result.extracted}개가 수집되어\n📦 현재 {total_collected}개가 대기 중입니다."
                
                send_simple_message(message, "🚀 Auto Collect")
            except Exception as e:
                print(f"⚠️ [Discord] 알림 실패 (무시됨): {e}")
        
        return 0 if result.success else 1
        
    except Exception as e:
        print(f"❌ [Auto Collect] 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())

