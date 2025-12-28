# -*- coding: utf-8 -*-
"""
ZND 자동 크롤링 스케줄러 (Thin Wrapper)
- PM2에서 실행되어 automation API를 호출
- 실제 로직은 automation.py에 통합됨
"""
import os
import sys
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# API Configuration
API_BASE = os.getenv('DESK_API_URL', 'http://localhost:5500')
API_KEY = os.getenv('DESK_API_KEY', '')


def log(msg: str):
    """타임스탬프 포함 로그 출력"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {msg}")


def run_auto_crawl():
    """
    자동 크롤링 - API 호출 래퍼
    실제 로직은 /api/automation/collect-extract 에서 처리
    """
    log("🚀 자동 크롤링 시작 (API 호출)")
    
    headers = {}
    if API_KEY:
        headers['Authorization'] = f'Bearer {API_KEY}'
    
    try:
        # 수집 + 추출 API 호출 (MLL 분석은 수동)
        url = f"{API_BASE}/api/automation/collect-extract"
        log(f"📡 API 호출: {url}")
        
        response = requests.post(url, headers=headers, timeout=300)
        
        if response.status_code == 200:
            result = response.json()
            collected = result.get('collected', 0)
            extracted = result.get('extracted', 0)
            failed = result.get('failed', 0)
            
            log("=" * 50)
            log(f"🎉 자동 크롤링 완료!")
            log(f"   - 수집: {collected}개")
            log(f"   - 추출: {extracted}개")
            log(f"   - 실패: {failed}개")
            log("=" * 50)
        else:
            log(f"❌ API 오류: {response.status_code} - {response.text}")
            
    except requests.exceptions.ConnectionError:
        log(f"❌ 연결 실패: Desk 서버가 실행 중인지 확인하세요 ({API_BASE})")
    except Exception as e:
        log(f"❌ 오류 발생: {e}")


def main():
    """엔트리 포인트"""
    try:
        run_auto_crawl()
    except KeyboardInterrupt:
        log("⚠️ 사용자에 의해 중단됨")
    except Exception as e:
        log(f"❌ 오류 발생: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
