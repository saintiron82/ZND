# -*- coding: utf-8 -*-
"""
Settings API - 설정 및 스케줄링 제어 API
"""
import os
import json
from flask import Blueprint, request, jsonify, render_template

settings_bp = Blueprint('settings', __name__)

# 스케줄 설정 파일 경로
CRAWLER_CONFIG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    'crawler', 'config'
)
SCHEDULES_FILE = os.path.join(CRAWLER_CONFIG_DIR, 'schedules.json')


# =============================================================================
# Views
# =============================================================================

@settings_bp.route('/settings')
def settings_view():
    """설정 페이지"""
    return render_template('settings.html')


# =============================================================================
# Schedule API
# =============================================================================

@settings_bp.route('/api/settings/schedules', methods=['GET'])
def get_schedules():
    """스케줄 목록 조회"""
    try:
        schedules = _load_schedules()
        return jsonify({
            'success': True,
            'schedules': schedules
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/settings/schedules/<schedule_id>', methods=['PUT'])
def update_schedule(schedule_id: str):
    """스케줄 업데이트 (활성화/비활성화, cron 변경)"""
    data = request.get_json()
    
    try:
        schedules = _load_schedules()
        
        # 해당 스케줄 찾기
        for schedule in schedules:
            if schedule['id'] == schedule_id:
                if 'enabled' in data:
                    schedule['enabled'] = data['enabled']
                if 'cron' in data:
                    schedule['cron'] = data['cron']
                if 'name' in data:
                    schedule['name'] = data['name']
                if 'phases' in data:
                    schedule['phases'] = data['phases']
                if 'description' in data:
                    schedule['description'] = data['description']
                break
        else:
            return jsonify({
                'success': False,
                'error': f'Schedule not found: {schedule_id}'
            }), 404
        
        _save_schedules(schedules)
        
        return jsonify({
            'success': True,
            'schedule': schedule
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/settings/schedules', methods=['POST'])
def create_schedule():
    """새 스케줄 생성"""
    data = request.get_json()
    
    try:
        schedules = _load_schedules()
        
        import uuid
        new_schedule = {
            'id': uuid.uuid4().hex[:8],
            'name': data.get('name', '새 스케줄'),
            'cron': data.get('cron', '0 12 * * *'),
            'enabled': data.get('enabled', True),
            'phases': data.get('phases', ['collect', 'extract']),
            'description': data.get('description', '')
        }
        
        schedules.append(new_schedule)
        _save_schedules(schedules)
        
        return jsonify({
            'success': True,
            'schedule': new_schedule
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/settings/schedules/<schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id: str):
    """스케줄 삭제"""
    try:
        schedules = _load_schedules()
        
        original_len = len(schedules)
        schedules = [s for s in schedules if s['id'] != schedule_id]
        
        if len(schedules) == original_len:
            return jsonify({
                'success': False,
                'error': f'Schedule not found: {schedule_id}'
            }), 404
        
        _save_schedules(schedules)
        
        return jsonify({
            'success': True,
            'deleted': schedule_id
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# =============================================================================
# Firestore Usage Stats
# =============================================================================

@settings_bp.route('/api/settings/firebase-stats', methods=['GET'])
def get_firebase_stats():
    """Firebase 사용량 통계"""
    try:
        from src.core import FirestoreClient
        stats = FirestoreClient.get_usage_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/settings/firebase-stats/reset', methods=['POST'])
def reset_firebase_stats():
    """Firebase 사용량 통계 리셋"""
    try:
        from src.core import FirestoreClient
        FirestoreClient.reset_usage_stats()
        return jsonify({
            'success': True,
            'message': 'Stats reset'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# =============================================================================
# Helper Functions
# =============================================================================

def _load_schedules() -> list:
    """스케줄 설정 파일 로드"""
    if os.path.exists(SCHEDULES_FILE):
        with open(SCHEDULES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('schedules', [])
    return []


def _save_schedules(schedules: list):
    """스케줄 설정 파일 저장"""
    os.makedirs(CRAWLER_CONFIG_DIR, exist_ok=True)
    with open(SCHEDULES_FILE, 'w', encoding='utf-8') as f:
        json.dump({'schedules': schedules}, f, ensure_ascii=False, indent=2)


# =============================================================================
# Discord Webhook API
# =============================================================================

def _get_env_file_path() -> str:
    """환경변수 파일 경로 찾기 (여러 위치 확인)"""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    project_root = os.path.dirname(base_dir)
    
    paths = [
        os.path.join(base_dir, '.env'),
        os.path.join(project_root, 'desk_arcive', '.env'),
    ]
    
    for path in paths:
        if os.path.exists(path):
            return path
    
    # 기본 경로 반환 (없으면 생성용)
    return os.path.join(base_dir, '.env')


@settings_bp.route('/api/settings/discord', methods=['GET'])
def get_discord_webhook():
    """Discord 웹훅 URL 조회"""
    try:
        webhook_url = _get_env_value('DISCORD_WEBHOOK_URL')
        return jsonify({
            'success': True,
            'webhook_url': webhook_url or ''
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/settings/discord', methods=['PUT'])
def update_discord_webhook():
    """Discord 웹훅 URL 저장"""
    data = request.get_json()
    webhook_url = data.get('webhook_url', '')
    
    try:
        _set_env_value('DISCORD_WEBHOOK_URL', webhook_url)
        return jsonify({
            'success': True,
            'message': 'Discord webhook URL saved'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@settings_bp.route('/api/settings/discord/test', methods=['POST'])
def test_discord_webhook():
    """Discord 웹훅 테스트 전송"""
    try:
        import requests as req
        from datetime import datetime
        
        webhook_url = _get_env_value('DISCORD_WEBHOOK_URL')
        if not webhook_url:
            return jsonify({
                'success': False,
                'error': 'Discord webhook URL not configured'
            }), 400
        
        payload = {
            "embeds": [{
                "title": "🔔 ZND Desk 테스트 알림",
                "description": "Discord 웹훅이 정상적으로 작동합니다!",
                "color": 0x4ecdc4,
                "timestamp": datetime.utcnow().isoformat()
            }]
        }
        
        response = req.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 204:
            return jsonify({'success': True})
        else:
            return jsonify({
                'success': False,
                'error': f'Discord returned {response.status_code}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def _get_env_value(key: str) -> str:
    """환경변수 파일에서 값 읽기"""
    env_file = _get_env_file_path()
    if not os.path.exists(env_file):
        return ''
    
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith(f'{key}='):
                return line.split('=', 1)[1]
    return ''


def _set_env_value(key: str, value: str):
    """환경변수 파일에 값 저장"""
    env_file = _get_env_file_path()
    lines = []
    key_found = False
    
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if line.strip().startswith(f'{key}='):
            new_lines.append(f'{key}={value}\n')
            key_found = True
        else:
            new_lines.append(line)
    
    if not key_found:
        new_lines.append(f'{key}={value}\n')
    
    with open(env_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
