# -*- coding: utf-8 -*-
"""
Discord Notifier - 디스코드 웹훅 알림 모듈

스케줄 크롤링 결과를 디스코드로 전송
"""
import os
import json
import requests
from datetime import datetime

# 환경 변수에서 웹훅 URL 로드 (우선순위: 환경변수 > .env 파일)
def get_webhook_url() -> str:
    """디스코드 웹훅 URL 가져오기"""
    # 1. 환경 변수에서 먼저 확인
    url = os.getenv('DISCORD_WEBHOOK_URL', '')
    if url:
        return url
    
    # 2. .env 파일에서 확인 (crawler 디렉토리)
    env_file = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_file):
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('DISCORD_WEBHOOK_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
    
    # 3. desk/.env 파일에서 확인
    desk_env = os.path.join(os.path.dirname(__file__), '..', '..', 'desk', '.env')
    if os.path.exists(desk_env):
        try:
            with open(desk_env, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('DISCORD_WEBHOOK_URL='):
                        return line.split('=', 1)[1].strip()
        except:
            pass
    
    return ''


def send_crawl_notification(result: dict, schedule_name: str = "Scheduled") -> bool:
    """
    크롤링 결과를 디스코드로 전송
    
    Args:
        result: 크롤링 결과 딕셔너리
        schedule_name: 스케줄 이름
    
    Returns:
        전송 성공 여부
    """
    webhook_url = get_webhook_url()
    
    if not webhook_url:
        print("⚠️ [Discord] DISCORD_WEBHOOK_URL not configured")
        return False
    
    try:
        # 결과 데이터 추출
        success = result.get('success', False)
        collected = result.get('collected', 0)
        extracted = result.get('extracted', 0)
        analyzed = result.get('analyzed', 0)
        cached = result.get('cached', 0)
        failed = result.get('failed', 0)
        message = result.get('message', '')
        
        # 상태에 따른 색상 (Discord embed color)
        color = 0x28a745 if success else 0xdc3545  # 녹색 or 빨간색
        
        # 현재 시간 (한국 시간)
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Discord Embed 구성
        embed = {
            "title": f"{'✅' if success else '❌'} ZND 크롤링 완료",
            "description": f"**{schedule_name}** 작업이 {'성공' if success else '실패'}했습니다.",
            "color": color,
            "fields": [
                {
                    "name": "📡 수집 (Collect)",
                    "value": f"{collected}개 링크",
                    "inline": True
                },
                {
                    "name": "📥 추출 (Extract)",
                    "value": f"{extracted}개",
                    "inline": True
                },
                {
                    "name": "🤖 분석 (Analyze)",
                    "value": f"{analyzed}개",
                    "inline": True
                },
                {
                    "name": "💾 캐시 (Cache)",
                    "value": f"{cached}개 저장",
                    "inline": True
                }
            ],
            "footer": {
                "text": f"ZND Crawler | {now}"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # 실패 시 오류 정보 추가
        if failed > 0:
            embed["fields"].append({
                "name": "❌ 실패",
                "value": f"{failed}개",
                "inline": True
            })
        
        if message:
            embed["fields"].append({
                "name": "📝 메시지",
                "value": message[:1024],  # Discord 필드 최대 길이
                "inline": False
            })
        
        # 웹훅 페이로드
        payload = {
            "embeds": [embed]
        }
        
        # 전송
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 204:
            print(f"📨 [Discord] Notification sent successfully")
            return True
        else:
            print(f"⚠️ [Discord] Failed to send: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ [Discord] Error: {e}")
        return False


def send_simple_message(message: str, title: str = "ZND 알림") -> bool:
    """
    간단한 텍스트 메시지 전송
    
    Args:
        message: 메시지 내용
        title: 제목
    
    Returns:
        전송 성공 여부
    """
    webhook_url = get_webhook_url()
    
    if not webhook_url:
        print("⚠️ [Discord] DISCORD_WEBHOOK_URL not configured")
        return False
    
    try:
        payload = {
            "embeds": [{
                "title": title,
                "description": message,
                "color": 0x4ecdc4,
                "timestamp": datetime.utcnow().isoformat()
            }]
        }
        
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        return response.status_code == 204
        
    except Exception as e:
        print(f"❌ [Discord] Error: {e}")
        return False
