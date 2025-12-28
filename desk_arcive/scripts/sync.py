#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
sync.py - 캐시 동기화 CLI 도구

Usage:
    python sync.py push [--date YYYY-MM-DD] [--all]  # 로컬 캐시 + 히스토리 → Firestore
    python sync.py pull [--date YYYY-MM-DD] [--all]  # Firestore → 로컬 캐시 + 히스토리
    python sync.py status                             # 동기화 상태 확인
    
동기화 대상:
    1. desk/cache/{날짜}/*.json - 모든 캐시 파일 (동기화 안된 것만)
    2. desk/data/crawling_history.json - 크롤링 히스토리 (중복 방지용)
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone, timedelta

# 프로젝트 루트를 Python 경로에 추가
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # desk/
sys.path.insert(0, PROJECT_ROOT)

from src.db_client import DBClient

# 캐시 및 데이터 디렉토리 경로
CACHE_DIR = os.path.join(PROJECT_ROOT, 'cache')
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
HISTORY_FILE = os.path.join(DATA_DIR, 'crawling_history.json')


def get_local_cache_files(date_str: str, synced_ids: set = None) -> list:
    """
    로컬 캐시 폴더에서 지정 날짜의 캐시 파일들을 읽음
    
    Args:
        date_str: 'YYYY-MM-DD' 형식
        synced_ids: 이미 동기화된 article_id set (스킵용)
    
    Returns:
        캐시 데이터 리스트 (동기화 안된 것만)
    """
    cache_date_dir = os.path.join(CACHE_DIR, date_str)
    cache_list = []
    skipped = 0
    
    if not os.path.exists(cache_date_dir):
        print(f"⚠️ 로컬 캐시 폴더가 없습니다: {cache_date_dir}")
        return cache_list
    
    synced_ids = synced_ids or set()
    
    for filename in os.listdir(cache_date_dir):
        if not filename.endswith('.json'):
            continue
        
        filepath = os.path.join(cache_date_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                # article_id가 없으면 파일명에서 추출
                article_id = data.get('article_id')
                if not article_id:
                    article_id = filename.replace('.json', '')
                    data['article_id'] = article_id
                
                # 이미 동기화된 항목 스킵
                if article_id in synced_ids:
                    skipped += 1
                    continue
                
                # synced_at 필드가 있으면 스킵 (로컬에서 표시)
                if data.get('synced_at'):
                    skipped += 1
                    continue
                
                cache_list.append(data)
                
        except Exception as e:
            print(f"⚠️ 읽기 실패: {filename} - {e}")
    
    if skipped > 0:
        print(f"   ⏭️ 이미 동기화됨: {skipped}개 스킵")
    
    return cache_list


def mark_cache_as_synced(date_str: str, article_ids: list):
    """
    로컬 캐시 파일에 synced_at 필드 추가
    """
    cache_date_dir = os.path.join(CACHE_DIR, date_str)
    if not os.path.exists(cache_date_dir):
        return
    
    synced_at = datetime.now(timezone.utc).isoformat()
    
    for filename in os.listdir(cache_date_dir):
        if not filename.endswith('.json'):
            continue
        
        filepath = os.path.join(cache_date_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            article_id = data.get('article_id', filename.replace('.json', ''))
            if article_id in article_ids:
                data['synced_at'] = synced_at
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
        except:
            pass


def save_cache_to_local(cache_list: list, date_str: str) -> int:
    """
    캐시 데이터를 로컬 폴더에 저장
    """
    cache_date_dir = os.path.join(CACHE_DIR, date_str)
    os.makedirs(cache_date_dir, exist_ok=True)
    
    saved_count = 0
    for cache_data in cache_list:
        article_id = cache_data.get('article_id')
        if not article_id:
            continue
        
        filepath = os.path.join(cache_date_dir, f"{article_id}.json")
        
        # 기존 파일이 있으면 병합
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                    # Firestore 데이터로 업데이트 (로컬 우선 아님)
                    existing.update(cache_data)
                    cache_data = existing
            except:
                pass
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            saved_count += 1
        except Exception as e:
            print(f"⚠️ 저장 실패: {article_id} - {e}")
    
    return saved_count


def get_local_cache_dates() -> list:
    """로컬 캐시 폴더의 날짜 목록 조회"""
    if not os.path.exists(CACHE_DIR):
        return []
    
    dates = []
    for name in os.listdir(CACHE_DIR):
        date_path = os.path.join(CACHE_DIR, name)
        if os.path.isdir(date_path) and len(name) == 10:  # YYYY-MM-DD 형식
            json_files = [f for f in os.listdir(date_path) if f.endswith('.json')]
            if json_files:
                dates.append(name)
    
    dates.sort(reverse=True)
    return dates


def load_local_history() -> dict:
    """로컬 크롤링 히스토리 로드"""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}


def save_local_history(history: dict):
    """로컬 크롤링 히스토리 저장"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def cmd_push(args):
    """push 명령: 로컬 캐시 + 히스토리 → Firestore"""
    print(f"\n🚀 Push: 로컬 → Firestore")
    print("=" * 50)
    
    db = DBClient()
    if not db.db:
        print("❌ Firestore 연결 실패. serviceAccountKey.json을 확인하세요.")
        return
    
    # 날짜 결정
    if args.all:
        dates = get_local_cache_dates()
        print(f"📅 전체 날짜 동기화: {len(dates)}개 날짜")
    else:
        date_str = args.date or datetime.now().strftime('%Y-%m-%d')
        dates = [date_str]
        print(f"📅 대상 날짜: {date_str}")
    
    total_success = 0
    total_failed = 0
    
    # 날짜별 캐시 업로드 (로컬 synced_at 필드로만 판단 → Firestore 조회 비용 0)
    for date_str in dates:
        print(f"\n📦 [{date_str}] 캐시 처리 중...")
        
        # 로컬 synced_at 필드만 확인 (Firestore 조회 안함 = 비용 절감)
        cache_list = get_local_cache_files(date_str)
        
        if not cache_list:
            print(f"   ✅ 새로 동기화할 캐시 없음")
            continue
        
        print(f"   📤 업로드 대상: {len(cache_list)}개")
        
        result = db.upload_cache_batch(date_str, cache_list)
        total_success += result['success']
        total_failed += result['failed']
        
        # 로컬 파일에 synced_at 마킹 (다음 push 시 스킵됨)
        uploaded_ids = [c.get('article_id') for c in cache_list if c.get('article_id')]
        mark_cache_as_synced(date_str, uploaded_ids)
    
    # 4. 크롤링 히스토리 동기화
    print(f"\n📜 크롤링 히스토리 동기화 중...")
    local_history = load_local_history()
    
    if local_history:
        history_result = db.upload_crawling_history(local_history)
        print(f"   ✅ 히스토리 {history_result.get('count', 0)}개 업로드")
    else:
        print("   ⚠️ 로컬 히스토리가 비어있음")
    
    # 5. 결과 출력
    print("\n" + "=" * 50)
    print("📊 Push 완료:")
    print(f"   ✅ 캐시 성공: {total_success}개")
    print(f"   ❌ 캐시 실패: {total_failed}개")


def cmd_pull(args):
    """pull 명령: Firestore → 로컬 캐시 + 히스토리"""
    print(f"\n⬇️ Pull: Firestore → 로컬")
    print("=" * 50)
    
    db = DBClient()
    if not db.db:
        print("❌ Firestore 연결 실패. serviceAccountKey.json을 확인하세요.")
        return
    
    # 1. 날짜 결정
    if args.all:
        dates = db.get_cache_sync_dates()
        print(f"📅 Firestore 날짜: {len(dates)}개")
    else:
        date_str = args.date or datetime.now().strftime('%Y-%m-%d')
        dates = [date_str]
        print(f"📅 대상 날짜: {date_str}")
    
    total_saved = 0
    
    # 2. 날짜별 캐시 다운로드
    for date_str in dates:
        print(f"\n📦 [{date_str}] 캐시 다운로드 중...")
        
        cache_list = db.download_cache_batch(date_str)
        
        if not cache_list:
            print(f"   ⚠️ Firestore에 캐시 없음")
            continue
        
        print(f"   ☁️ Firestore: {len(cache_list)}개")
        
        saved_count = save_cache_to_local(cache_list, date_str)
        total_saved += saved_count
        print(f"   💾 저장: {saved_count}개")
    
    # 3. 크롤링 히스토리 동기화
    print(f"\n📜 크롤링 히스토리 다운로드 중...")
    remote_history = db.download_crawling_history()
    
    if remote_history:
        local_history = load_local_history()
        # 원격 히스토리를 로컬에 병합 (원격 우선)
        local_history.update(remote_history)
        save_local_history(local_history)
        print(f"   ✅ 히스토리 {len(remote_history)}개 병합 (로컬 총 {len(local_history)}개)")
    else:
        print("   ⚠️ Firestore 히스토리가 비어있음")
    
    # 4. 결과 출력
    print("\n" + "=" * 50)
    print("📊 Pull 완료:")
    print(f"   ✅ 캐시 저장: {total_saved}개")
    print(f"   📁 경로: {CACHE_DIR}")


def cmd_status(args):
    """status 명령: 동기화 상태 확인"""
    print("\n📊 캐시 동기화 상태")
    print("=" * 50)
    
    # 1. 로컬 캐시 상태
    local_dates = get_local_cache_dates()
    print(f"\n📁 로컬 캐시:")
    
    local_total = 0
    local_unsynced = 0
    
    if local_dates:
        for date_str in local_dates[:5]:
            cache_date_dir = os.path.join(CACHE_DIR, date_str)
            total = 0
            unsynced = 0
            
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                total += 1
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        if not data.get('synced_at'):
                            unsynced += 1
                except:
                    pass
            
            local_total += total
            local_unsynced += unsynced
            
            sync_status = "✅" if unsynced == 0 else f"⚠️ {unsynced}개 미동기화"
            print(f"   {date_str}: {total}개 ({sync_status})")
            
        if len(local_dates) > 5:
            print(f"   ... 외 {len(local_dates) - 5}일")
    else:
        print("   (없음)")
    
    # 2. 로컬 히스토리 상태
    local_history = load_local_history()
    print(f"\n📜 로컬 히스토리: {len(local_history)}개 URL")
    
    # 3. Firestore 상태
    db = DBClient()
    if not db.db:
        print("\n☁️ Firestore: ⚠️ 연결 안됨")
        return
    
    firestore_dates = db.get_cache_sync_dates()
    print(f"\n☁️ Firestore 캐시:")
    if firestore_dates:
        for date_str in firestore_dates[:5]:
            print(f"   {date_str}")
        if len(firestore_dates) > 5:
            print(f"   ... 외 {len(firestore_dates) - 5}일")
    else:
        print("   (없음)")
    
    # 4. 메타데이터
    meta = db.get_sync_metadata()
    if meta:
        print(f"\n🕐 마지막 동기화:")
        if 'last_push' in meta:
            print(f"   Push: {meta.get('last_push_date', '?')} ({meta.get('last_push_count', '?')}개)")
        if 'last_pull' in meta:
            print(f"   Pull: {meta.get('last_pull_date', '?')} ({meta.get('last_pull_count', '?')}개)")
    
    # 5. 요약
    print(f"\n🔍 요약:")
    print(f"   📦 로컬 캐시: {local_total}개 (미동기화 {local_unsynced}개)")
    print(f"   📜 로컬 히스토리: {len(local_history)}개")
    
    if local_unsynced > 0:
        print(f"\n💡 Tip: 'python sync.py push --all' 로 전체 동기화")


def main():
    parser = argparse.ArgumentParser(
        description='ZND 캐시 동기화 도구',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
동기화 대상:
  1. desk/cache/{날짜}/*.json - 모든 캐시 파일
  2. desk/data/crawling_history.json - 크롤링 히스토리

예시:
  python sync.py push                    # 오늘 캐시 + 히스토리 업로드
  python sync.py push --date 2025-12-24  # 특정 날짜 업로드
  python sync.py push --all              # 전체 날짜 업로드
  python sync.py pull                    # 오늘 캐시 다운로드
  python sync.py pull --all              # 전체 날짜 다운로드
  python sync.py status                  # 동기화 상태 확인
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='명령어')
    
    # push 명령
    push_parser = subparsers.add_parser('push', help='로컬 캐시 + 히스토리 → Firestore')
    push_parser.add_argument('--date', '-d', help='날짜 (YYYY-MM-DD, 기본: 오늘)')
    push_parser.add_argument('--all', '-a', action='store_true', help='전체 날짜 동기화')
    push_parser.set_defaults(func=cmd_push)
    
    # pull 명령
    pull_parser = subparsers.add_parser('pull', help='Firestore → 로컬 캐시 + 히스토리')
    pull_parser.add_argument('--date', '-d', help='날짜 (YYYY-MM-DD, 기본: 오늘)')
    pull_parser.add_argument('--all', '-a', action='store_true', help='전체 날짜 동기화')
    pull_parser.set_defaults(func=cmd_pull)
    
    # status 명령
    status_parser = subparsers.add_parser('status', help='동기화 상태 확인')
    status_parser.set_defaults(func=cmd_status)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        return
    
    args.func(args)


if __name__ == '__main__':
    main()
