"""
테스트 크롤러 - 특정 소스 ID에서 딱 1개 기사만 크롤링하는 테스트용 스크립트
사용법: python test_crawler.py [source_id]
예시: python test_crawler.py aitimes
"""
import os
import sys
import json
import asyncio
from dotenv import load_dotenv

# 환경 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, '.env')
TARGETS_FILE = os.path.join(BASE_DIR, 'config/targets.json')

load_dotenv(dotenv_path=ENV_PATH)

# Import 기존 크롤러 함수들
from crawler import fetch_links, is_recent
from src.mll_client import MLLClient
from src.pipeline import process_article, get_db


def load_targets():
    """타겟 설정 로드"""
    with open(TARGETS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_target_by_id(source_id: str):
    """소스 ID로 타겟 찾기"""
    targets = load_targets()
    for target in targets:
        if target['id'] == source_id:
            return target
    return None


def list_available_sources():
    """사용 가능한 소스 목록 출력"""
    targets = load_targets()
    print("\n📋 사용 가능한 소스 ID 목록:")
    print("-" * 40)
    for t in targets:
        print(f"  • {t['id']:20} ({t['type']}) - {t['url'][:40]}...")
    print("-" * 40)


async def test_single_article(source_id: str, skip_mll: bool = False):
    """
    특정 소스에서 딱 1개 기사만 테스트 크롤링
    
    Args:
        source_id: targets.json에 정의된 소스 ID
        skip_mll: True면 MLL 평가 건너뛰기 (빠른 테스트용)
    """
    print(f"\n🧪 [테스트 모드] 소스: {source_id}")
    print("=" * 50)
    
    # 1. 타겟 찾기
    target = get_target_by_id(source_id)
    if not target:
        print(f"❌ 소스 ID '{source_id}'를 찾을 수 없습니다.")
        list_available_sources()
        return
    
    print(f"✅ 타겟 발견: {target}")
    
    # 2. 링크 가져오기
    print(f"\n🔗 링크 가져오는 중...")
    links = fetch_links(target)
    
    if not links:
        print("❌ 링크를 찾을 수 없습니다.")
        return
    
    print(f"📋 발견된 링크 수: {len(links)}")
    print(f"🎯 첫 번째 링크: {links[0]}")
    
    # 3. 중복 체크 (선택적)
    db = get_db()
    test_url = links[0]
    
    is_duplicate = db.check_history(test_url)
    if is_duplicate:
        print(f"⚠️ 이 URL은 이미 처리됨: {test_url}")
        print("   새 URL로 시도하려면 'y'를 입력하세요, 그대로 진행하려면 Enter:")
        
        user_input = input().strip().lower()
        if user_input == 'y':
            # 중복되지 않은 첫 번째 링크 찾기
            for link in links[1:]:
                if not db.check_history(link):
                    test_url = link
                    print(f"🔄 새 URL로 변경: {test_url}")
                    break
            else:
                print("❌ 모든 링크가 이미 처리되었습니다.")
                return
    
    # 4. 단일 기사 처리
    print(f"\n🚀 기사 처리 시작...")
    print(f"   URL: {test_url}")
    print(f"   MLL 사용: {'아니오' if skip_mll else '예'}")
    
    try:
        mll = MLLClient() if not skip_mll else None
        
        result = await process_article(
            url=test_url,
            source_id=source_id,
            mll_client=mll,
            skip_mll=skip_mll
        )
        
        print(f"\n📊 결과:")
        print("-" * 40)
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        
        status = result.get('status', 'unknown')
        if status == 'saved':
            print(f"\n✅ 성공! 저장된 article_id: {result.get('article_id')}")
        elif status == 'worthless':
            print(f"\n🚫 가치없음: {result.get('reason')}")
        elif status == 'mll_failed':
            print(f"\n⚠️ MLL 실패: {result.get('reason')}")
        elif status == 'already_processed':
            print(f"\n⏭️ 이미 처리됨: {result.get('history_status')}")
        else:
            print(f"\n❓ 알 수 없는 상태: {status}")
            
    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")
        import traceback
        traceback.print_exc()


def main():
    """메인 진입점"""
    if len(sys.argv) < 2:
        print("사용법: python test_crawler.py <source_id> [--skip-mll]")
        print("예시:")
        print("  python test_crawler.py aitimes")
        print("  python test_crawler.py techcrunch_ai --skip-mll")
        list_available_sources()
        return
    
    source_id = sys.argv[1]
    skip_mll = '--skip-mll' in sys.argv
    
    asyncio.run(test_single_article(source_id, skip_mll))


if __name__ == "__main__":
    main()
