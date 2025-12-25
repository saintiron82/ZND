# -*- coding: utf-8 -*-
"""
공통 인증 모듈 (Basic Auth)
- 모든 Desk API 엔드포인트에서 공유
- 로그인 시 Discord 알림 전송
"""
import os
import sys
from functools import wraps
from datetime import datetime, timezone
from flask import request, Response
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
load_dotenv(env_path)

# Discord 알림 모듈
try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'crawler'))
    from core.discord_notifier import get_webhook_url
    import requests
    DISCORD_ENABLED = True
except ImportError:
    DISCORD_ENABLED = False

# 중복 알림 방지용 (IP+사용자 조합, 10분간 유효)
_recent_logins = {}
LOGIN_COOLDOWN_SECONDS = 600  # 10분


def check_auth(username, password):
    """인증 정보 확인"""
    valid_username = os.getenv('DESK_USERNAME', 'master')
    valid_password = os.getenv('DESK_PASSWORD', '')
    return username == valid_username and password == valid_password


def send_login_notification(username: str, ip: str, path: str):
    """로그인 성공 시 Discord 알림 전송"""
    if not DISCORD_ENABLED:
        return
    
    # 중복 알림 방지 (같은 IP+사용자는 10분 내 재알림 안 함)
    login_key = f"{ip}:{username}"
    now = datetime.now(timezone.utc)
    
    if login_key in _recent_logins:
        last_login = _recent_logins[login_key]
        diff = (now - last_login).total_seconds()
        if diff < LOGIN_COOLDOWN_SECONDS:
            return  # 쿨다운 중, 알림 생략
    
    _recent_logins[login_key] = now
    
    # 오래된 기록 정리 (메모리 누수 방지)
    expired_keys = [k for k, v in _recent_logins.items() 
                   if (now - v).total_seconds() > LOGIN_COOLDOWN_SECONDS * 2]
    for k in expired_keys:
        del _recent_logins[k]
    
    try:
        webhook_url = get_webhook_url()
        if not webhook_url:
            return
        
        # 한국 시간으로 표시
        kst_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        payload = {
            "embeds": [{
                "title": "🔐 Desk 로그인 감지",
                "description": "관리자 패널에 로그인이 감지되었습니다.",
                "color": 0xf39c12,  # 주황색 (경고)
                "fields": [
                    {"name": "👤 사용자", "value": username, "inline": True},
                    {"name": "🌐 IP", "value": ip or "알 수 없음", "inline": True},
                    {"name": "📍 경로", "value": path or "/", "inline": True},
                    {"name": "⏰ 시간", "value": kst_time, "inline": False}
                ],
                "footer": {"text": "ZND Desk Security"},
                "timestamp": datetime.utcnow().isoformat()
            }]
        }
        
        requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        print(f"📨 [Auth] Login notification sent for {username} from {ip}")
        
    except Exception as e:
        print(f"⚠️ [Auth] Discord notification failed: {e}")


def requires_auth(f):
    """Basic Auth 데코레이터 - 모든 API 엔드포인트에 적용"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return Response(
                '🔒 관리자 인증이 필요합니다.',
                401,
                {'WWW-Authenticate': 'Basic realm="Desk Admin"'}
            )
        
        # 로그인 성공 시 Discord 알림
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()  # 첫 번째 IP 사용
        
        send_login_notification(auth.username, client_ip, request.path)
        
        return f(*args, **kwargs)
    return decorated
