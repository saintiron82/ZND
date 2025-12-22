# -*- coding: utf-8 -*-
"""
스케줄(Schedule) API - 자동 크롤링 스케줄 관리
"""
import os
import json
from flask import Blueprint, request, jsonify

schedule_bp = Blueprint('schedule', __name__)

SCHEDULE_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config', 'auto_crawl_schedule.json')


def load_schedule_config():
    """스케줄 설정 파일 로드"""
    try:
        with open(SCHEDULE_CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {'schedules': [], 'crawl_settings': {}}


def save_schedule_config(config):
    """스케줄 설정 파일 저장"""
    os.makedirs(os.path.dirname(SCHEDULE_CONFIG_PATH), exist_ok=True)
    with open(SCHEDULE_CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=4)


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
    """▶️ 지금 바로 크롤링 실행"""
    try:
        import subprocess
        import sys
        
        desk_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        script_path = os.path.join(desk_dir, 'auto_crawl.py')
        
        # 백그라운드에서 실행
        if sys.platform == 'win32':
            subprocess.Popen(
                ['python', script_path],
                cwd=desk_dir,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            subprocess.Popen(
                ['python3', script_path],
                cwd=desk_dir,
                start_new_session=True
            )
        
        return jsonify({
            'success': True,
            'message': '자동 크롤링이 백그라운드에서 시작되었습니다'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
