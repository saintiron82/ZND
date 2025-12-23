# -*- coding: utf-8 -*-
"""
스케줄(Schedule) API - 자동 크롤링 스케줄 관리
독립 스케줄러(d:\ZND\crawler) 설정 파일 연동
"""
import os
import sys
import json
from flask import Blueprint, request, jsonify

schedule_bp = Blueprint('schedule', __name__)

# 독립 스케줄러의 설정 파일 경로
ZND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
SCHEDULE_CONFIG_PATH = os.path.join(ZND_ROOT, 'crawler', 'config', 'schedules.json')
CRAWLER_LOG_PATH = os.path.join(ZND_ROOT, 'crawler', 'logs', 'crawler_history.jsonl')


def load_schedule_config():
    """스케줄 설정 파일 로드 (crawler/config/schedules.json)"""
    try:
        with open(SCHEDULE_CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {'schedules': [], 'crawl_settings': {}}


def save_schedule_config(config):
    """스케줄 설정 파일 저장"""
    os.makedirs(os.path.dirname(SCHEDULE_CONFIG_PATH), exist_ok=True)
    with open(SCHEDULE_CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


@schedule_bp.route('/api/schedule', methods=['GET'])
def get_schedules():
    """📅 스케줄 목록 조회"""
    config = load_schedule_config()
    return jsonify({
        'success': True,
        'schedules': config.get('schedules', []),
        'crawl_settings': config.get('crawl_settings', {})
    })


@schedule_bp.route('/api/schedule', methods=['POST'])
def add_schedule():
    """➕ 새 스케줄 추가"""
    try:
        data = request.json or {}
        
        schedule_id = data.get('id')
        name = data.get('name', '새 스케줄')
        cron = data.get('cron', '0 8 * * *')
        enabled = data.get('enabled', True)
        description = data.get('description', '')
        
        if not schedule_id:
            # 자동 ID 생성
            import uuid
            schedule_id = str(uuid.uuid4())[:8]
        
        config = load_schedule_config()
        schedules = config.get('schedules', [])
        
        # 중복 ID 체크
        if any(s['id'] == schedule_id for s in schedules):
            return jsonify({'success': False, 'error': f'ID {schedule_id} 이미 존재함'}), 400
        
        schedules.append({
            'id': schedule_id,
            'name': name,
            'cron': cron,
            'enabled': enabled,
            'description': description
        })
        
        config['schedules'] = schedules
        save_schedule_config(config)
        
        return jsonify({
            'success': True,
            'message': f'스케줄 "{name}" 추가됨',
            'schedule': schedules[-1]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/api/schedule/<schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    """✏️ 스케줄 수정"""
    try:
        data = request.json or {}
        config = load_schedule_config()
        schedules = config.get('schedules', [])
        
        for i, s in enumerate(schedules):
            if s['id'] == schedule_id:
                if 'name' in data:
                    schedules[i]['name'] = data['name']
                if 'cron' in data:
                    schedules[i]['cron'] = data['cron']
                if 'enabled' in data:
                    schedules[i]['enabled'] = data['enabled']
                if 'description' in data:
                    schedules[i]['description'] = data['description']
                
                config['schedules'] = schedules
                save_schedule_config(config)
                
                return jsonify({
                    'success': True,
                    'message': f'스케줄 "{schedules[i]["name"]}" 수정됨',
                    'schedule': schedules[i]
                })
        
        return jsonify({'success': False, 'error': f'스케줄 {schedule_id} 없음'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/api/schedule/<schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    """🗑️ 스케줄 삭제"""
    try:
        config = load_schedule_config()
        schedules = config.get('schedules', [])
        
        original_len = len(schedules)
        schedules = [s for s in schedules if s['id'] != schedule_id]
        
        if len(schedules) == original_len:
            return jsonify({'success': False, 'error': f'스케줄 {schedule_id} 없음'}), 404
        
        config['schedules'] = schedules
        save_schedule_config(config)
        
        return jsonify({
            'success': True,
            'message': f'스케줄 삭제됨'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/api/schedule/<schedule_id>/toggle', methods=['POST'])
def toggle_schedule(schedule_id):
    """🔘 스케줄 On/Off 토글"""
    try:
        config = load_schedule_config()
        schedules = config.get('schedules', [])
        
        for i, s in enumerate(schedules):
            if s['id'] == schedule_id:
                schedules[i]['enabled'] = not schedules[i].get('enabled', True)
                config['schedules'] = schedules
                save_schedule_config(config)
                
                status = "활성화" if schedules[i]['enabled'] else "비활성화"
                return jsonify({
                    'success': True,
                    'message': f'스케줄 "{schedules[i]["name"]}" {status}됨',
                    'enabled': schedules[i]['enabled']
                })
        
        return jsonify({'success': False, 'error': f'스케줄 {schedule_id} 없음'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/api/schedule/run_now', methods=['POST'])
def run_crawl_now():
    """▶️ 지금 바로 크롤링 실행 (독립 스케줄러 모듈 호출)"""
    try:
        # 크롤러 모듈 경로 추가
        crawler_dir = os.path.join(ZND_ROOT, 'crawler')
        if crawler_dir not in sys.path:
            sys.path.insert(0, crawler_dir)
        if ZND_ROOT not in sys.path:
            sys.path.insert(0, ZND_ROOT)
        
        from core.extractor import run_full_pipeline
        from src.crawler_state import set_crawling, log_crawl_event
        import time
        
        set_crawling(True, "Manual Trigger")
        start_time = time.time()
        
        try:
            result = run_full_pipeline()
            duration = time.time() - start_time
            log_crawl_event("Manual", result.get('message', 'OK'), duration, success=result.get('success', True))
            
            return jsonify({
                'success': True,
                'message': result.get('message', '크롤링 완료'),
                'result': result
            })
        finally:
            set_crawling(False)
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/api/scheduler/status', methods=['GET'])
def get_scheduler_status():
    """🔍 스케줄러 상태 조회 (PM2 프로세스 확인)"""
    try:
        import subprocess
        
        # PM2 process 확인
        is_running = False
        try:
            result = subprocess.run(
                ['pm2', 'jlist'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                processes = json.loads(result.stdout)
                for proc in processes:
                    if proc.get('name') == 'znd-crawler' and proc.get('pm2_env', {}).get('status') == 'online':
                        is_running = True
                        break
        except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
            # PM2가 없거나 응답 없으면 로그 기반으로 판단
            pass
        
        # 최근 로그 확인 (1시간 이내 활동 있으면 활성으로 간주)
        last_active = None
        try:
            if os.path.exists(CRAWLER_LOG_PATH):
                with open(CRAWLER_LOG_PATH, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if lines:
                        last_log = json.loads(lines[-1])
                        last_active = last_log.get('timestamp')
        except:
            pass
        
        return jsonify({
            'success': True,
            'pm2_running': is_running,
            'last_active': last_active,
            'config_path': SCHEDULE_CONFIG_PATH
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@schedule_bp.route('/api/scheduler/logs', methods=['GET'])
def get_scheduler_logs():
    """📋 스케줄러 실행 로그 조회"""
    try:
        limit = request.args.get('limit', 20, type=int)
        
        if not os.path.exists(CRAWLER_LOG_PATH):
            return jsonify([])
        
        logs = []
        with open(CRAWLER_LOG_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        logs.append(json.loads(line))
                    except:
                        pass
        
        # 최신순 정렬
        logs = sorted(logs, key=lambda x: x.get('timestamp', ''), reverse=True)[:limit]
        
        return jsonify(logs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

