"""
테스트 크롤러 - 5단계 파이프라인 구조

특정 소스 ID에서 1개 기사를 단계별로 처리하는 테스트용 스크립트
각 단계를 개별적으로 실행하거나 ALL로 전체 실행 가능

사용법: 
  python test_crawler.py [command] [source_id] [options]

단계별 실행:
  python test_crawler.py collect aitimes       # 1️⃣ 링크 수집
  python test_crawler.py extract aitimes       # 2️⃣ 콘텐츠 추출
  python test_crawler.py analyze               # 3️⃣ MLL 분석
  python test_crawler.py stage                 # 4️⃣ 조판
  python test_crawler.py publish               # 5️⃣ 발행

전체 실행:
  python test_crawler.py all aitimes           # 1~4단계 연속
  python test_crawler.py full aitimes          # 1~5단계 전체
  
레거시:
  python test_crawler.py aitimes               # 기존 방식 (바로 처리)
"""
import os
import sys
import json
import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv

# 환경 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, '.env')
TARGETS_FILE = os.path.join(BASE_DIR, 'config/targets.json')
CACHE_DIR = os.path.join(BASE_DIR, 'cache')
STAGING_DIR = os.path.join(BASE_DIR, 'staging')

load_dotenv(dotenv_path=ENV_PATH)

# Import 기존 크롤러 함수들
from crawler import fetch_links, is_recent
from src.mll_client import MLLClient
from src.pipeline import process_article, get_db, save_article
from src.core_logic import (
    load_from_cache, save_to_cache, normalize_field_names, get_config
)
from src.crawler.core import AsyncCrawler


# ==============================================================================
# 유틸리티 함수
# ==============================================================================

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


# ==============================================================================
# 1️⃣ 수집 (Collect)
# ==============================================================================

def step_collect(source_id: str, limit: int = 1):
    """링크 수집 단계"""
    print(f"\n1️⃣ [COLLECT] 링크 수집 - 소스: {source_id}")
    print("=" * 50)
    
    target = get_target_by_id(source_id)
    if not target:
        print(f"❌ 소스 ID '{source_id}'를 찾을 수 없습니다.")
        list_available_sources()
        return None
    
    links = fetch_links(target)
    if not links:
        print("❌ 링크를 찾을 수 없습니다.")
        return None
    
    # 중복 필터링
    db = get_db()
    new_links = []
    for link in links[:limit*3]:  # 여유있게 가져오기
        if not db.check_history(link):
            new_links.append({'url': link, 'source_id': source_id})
            if len(new_links) >= limit:
                break
    
    print(f"📋 전체 링크: {len(links)}개")
    print(f"✅ 새 링크: {len(new_links)}개 (limit: {limit})")
    
    for i, link in enumerate(new_links):
        print(f"   {i+1}. {link['url'][:60]}...")
    
    return new_links


# ==============================================================================
# 2️⃣ 추출 (Extract)
# ==============================================================================

async def step_extract(links: list):
    """콘텐츠 추출 단계"""
    print(f"\n2️⃣ [EXTRACT] 콘텐츠 추출")
    print("=" * 50)
    
    if not links:
        print("❌ 추출할 링크가 없습니다.")
        return []
    
    extracted = []
    crawler = AsyncCrawler(use_playwright=True)
    
    try:
        await crawler.start()
        
        for item in links:
            url = item['url']
            source_id = item['source_id']
            
            # 캐시 체크
            cached = load_from_cache(url)
            if cached and cached.get('text'):
                print(f"📦 [캐시] {url[:50]}...")
                extracted.append(cached)
                continue
            
            # 크롤링
            print(f"🌐 [크롤링] {url[:50]}...")
            content = await crawler.process_url(url)
            
            if content and len(content.get('text', '')) >= 200:
                content['source_id'] = source_id
                content['url'] = url
                save_to_cache(url, content)
                extracted.append(content)
                print(f"   ✅ 저장 완료 (text: {len(content['text'])}자)")
            else:
                print(f"   ⚠️ 본문 부족 또는 실패")
    finally:
        await crawler.close()
    
    print(f"\n📊 추출 완료: {len(extracted)}개")
    return extracted


# ==============================================================================
# 3️⃣ 분석 (Analyze)
# ==============================================================================

def step_analyze(articles: list = None):
    """MLL 분석 단계"""
    print(f"\n3️⃣ [ANALYZE] MLL 분석")
    print("=" * 50)
    
    # articles가 없으면 오늘 캐시에서 미분석 찾기
    if articles is None:
        today_str = datetime.now().strftime('%Y-%m-%d')
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        articles = []
        
        if os.path.exists(cache_date_dir):
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                filepath = os.path.join(cache_date_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if not data.get('mll_status') and not data.get('raw_analysis'):
                        if len(data.get('text', '')) >= 200:
                            articles.append(data)
    
    if not articles:
        print("❌ 분석할 기사가 없습니다.")
        return []
    
    mll = MLLClient()
    analyzed = []
    
    for article in articles:
        url = article.get('url', 'unknown')
        text = article.get('text', '')
        
        print(f"🤖 [분석 중] {article.get('title', url)[:40]}...")
        
        max_text = get_config('crawler', 'max_text_length_for_analysis', default=3000)
        truncated_text = text[:max_text]
        
        try:
            mll_result = mll.analyze_text(truncated_text)
            
            if mll_result:
                mll_result = normalize_field_names(mll_result)
                article.update(mll_result)
                article['mll_status'] = 'analyzed'
                article['analyzed_at'] = datetime.now(timezone.utc).isoformat()
                
                # 캐시 업데이트
                save_to_cache(url, article)
                analyzed.append(article)
                
                zs = article.get('zero_echo_score', 'N/A')
                is_ = article.get('impact_score', 'N/A')
                print(f"   ✅ 완료 (ZS: {zs}, IS: {is_})")
            else:
                article['mll_status'] = 'failed'
                save_to_cache(url, article)
                print(f"   ⚠️ MLL 응답 없음")
        except Exception as e:
            print(f"   ❌ 에러: {e}")
    
    print(f"\n📊 분석 완료: {len(analyzed)}개")
    return analyzed


# ==============================================================================
# 4️⃣ 조판 (Stage)
# ==============================================================================

def step_stage(articles: list = None):
    """조판 단계 - staging 폴더로 이동"""
    print(f"\n4️⃣ [STAGE] 조판")
    print("=" * 50)
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    staging_date_dir = os.path.join(STAGING_DIR, today_str)
    os.makedirs(staging_date_dir, exist_ok=True)
    
    # articles가 없으면 오늘 캐시에서 분석완료 찾기
    if articles is None:
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        articles = []
        
        if os.path.exists(cache_date_dir):
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                filepath = os.path.join(cache_date_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if data.get('mll_status') == 'analyzed' and not data.get('staged'):
                        articles.append((data, filepath))
    else:
        # 캐시 파일 경로 추가
        articles = [(a, None) for a in articles]
    
    if not articles:
        print("❌ 조판할 기사가 없습니다.")
        return []
    
    staged = []
    high_noise_threshold = get_config('scoring', 'high_noise_threshold', default=7.0)
    
    for item in articles:
        article = item[0] if isinstance(item, tuple) else item
        cache_path = item[1] if isinstance(item, tuple) else None
        
        url = article.get('url', 'unknown')
        title = article.get('title_ko', article.get('title', 'N/A'))
        zs = float(article.get('zero_echo_score', 5.0))
        
        # 고노이즈 필터링
        if zs >= high_noise_threshold:
            article['rejected'] = True
            article['reject_reason'] = f'high_noise ({zs})'
            print(f"� [거부] {title[:30]}... (ZS: {zs})")
        else:
            print(f"✅ [조판] {title[:30]}... (ZS: {zs})")
        
        # Staging 저장
        article['staged'] = True
        article['staged_at'] = datetime.now(timezone.utc).isoformat()
        
        from src.core_logic import get_url_hash
        filename = f"{get_url_hash(url)}.json"
        staging_path = os.path.join(staging_date_dir, filename)
        
        with open(staging_path, 'w', encoding='utf-8') as f:
            json.dump(article, f, ensure_ascii=False, indent=2)
        
        staged.append(article)
        
        # 캐시도 업데이트
        if cache_path and os.path.exists(cache_path):
            article_copy = article.copy()
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(article_copy, f, ensure_ascii=False, indent=2)
    
    print(f"\n📊 조판 완료: {len(staged)}개 (staging/{today_str})")
    return staged


# ==============================================================================
# 5️⃣ 발행 (Publish)
# ==============================================================================

def step_publish(articles: list = None):
    """발행 단계"""
    print(f"\n5️⃣ [PUBLISH] 발행")
    print("=" * 50)
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    staging_date_dir = os.path.join(STAGING_DIR, today_str)
    
    # articles가 없으면 staging에서 찾기
    if articles is None:
        articles = []
        if os.path.exists(staging_date_dir):
            for filename in os.listdir(staging_date_dir):
                if not filename.endswith('.json'):
                    continue
                filepath = os.path.join(staging_date_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if not data.get('rejected') and not data.get('published'):
                        articles.append((data, filepath))
    else:
        articles = [(a, None) for a in articles if not a.get('rejected')]
    
    if not articles:
        print("❌ 발행할 기사가 없습니다.")
        return []
    
    published = []
    
    for item in articles:
        article = item[0] if isinstance(item, tuple) else item
        staging_path = item[1] if isinstance(item, tuple) else None
        
        title = article.get('title_ko', article.get('title', 'N/A'))
        
        # 필수 필드 체크
        required = ['url', 'title_ko', 'summary', 'zero_echo_score', 'impact_score']
        missing = [f for f in required if f not in article]
        if missing:
            print(f"⚠️ [스킵] {title[:30]}... (필드 누락: {missing})")
            continue
        
        # 발행
        result = save_article(article, source_id=article.get('source_id'))
        
        if result.get('status') == 'saved':
            article['published'] = True
            article['published_at'] = datetime.now(timezone.utc).isoformat()
            article['data_file'] = result.get('filename')
            
            if staging_path:
                with open(staging_path, 'w', encoding='utf-8') as f:
                    json.dump(article, f, ensure_ascii=False, indent=2)
            
            published.append(article)
            print(f"✅ [발행] {title[:30]}... → {result.get('filename')}")
        else:
            print(f"❌ [실패] {title[:30]}... ({result.get('reason', 'unknown')})")
    
    print(f"\n📊 발행 완료: {len(published)}개")
    return published


# ==============================================================================
# 통합 실행
# ==============================================================================

async def run_all(source_id: str, include_publish: bool = False):
    """1~4 또는 1~5 단계 연속 실행"""
    # 1️⃣ 수집
    links = step_collect(source_id, limit=1)
    if not links:
        return
    
    # 2️⃣ 추출
    articles = await step_extract(links)
    if not articles:
        return
    
    # 3️⃣ 분석
    analyzed = step_analyze(articles)
    if not analyzed:
        return
    
    # 4️⃣ 조판
    staged = step_stage(analyzed)
    
    # 5️⃣ 발행 (선택)
    if include_publish:
        step_publish(staged)
    else:
        print("\n⏸️ 발행 대기 중 (staging에서 검토 후 publish 실행)")


# ==============================================================================
# 레거시 호환
# ==============================================================================

async def test_single_article(source_id: str, skip_mll: bool = False):
    """기존 방식 - 바로 처리 (레거시 호환)"""
    print(f"\n🧪 [레거시 모드] 소스: {source_id}")
    print("=" * 50)
    
    target = get_target_by_id(source_id)
    if not target:
        print(f"❌ 소스 ID '{source_id}'를 찾을 수 없습니다.")
        list_available_sources()
        return
    
    links = fetch_links(target)
    if not links:
        print("❌ 링크를 찾을 수 없습니다.")
        return
    
    db = get_db()
    test_url = links[0]
    
    if db.check_history(test_url):
        print(f"⚠️ 이 URL은 이미 처리됨: {test_url}")
        for link in links[1:]:
            if not db.check_history(link):
                test_url = link
                print(f"🔄 새 URL로 변경: {test_url}")
                break
        else:
            print("❌ 모든 링크가 이미 처리되었습니다.")
            return
    
    mll = MLLClient() if not skip_mll else None
    result = await process_article(
        url=test_url,
        source_id=source_id,
        mll_client=mll,
        skip_mll=skip_mll
    )
    
    print(f"\n📊 결과:")
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))


# ==============================================================================
# 메인
# ==============================================================================

def print_usage():
    """사용법 출력"""
    print("""
🧪 테스트 크롤러 - 5단계 파이프라인

사용법: python test_crawler.py [command] [source_id] [options]

📋 단계별 실행:
  collect <source_id>     1️⃣ 링크 수집
  extract <source_id>     2️⃣ 콘텐츠 추출
  analyze                 3️⃣ MLL 분석 (캐시에서 미분석 찾기)
  stage                   4️⃣ 조판 (staging 폴더로)
  publish                 5️⃣ 발행 (staging → data)

⚡ 통합 실행:
  all <source_id>         1~4단계 연속 (발행 대기)
  full <source_id>        1~5단계 전체 실행

🔧 레거시:
  <source_id>             기존 방식 (바로 처리)
  <source_id> --skip-mll  MLL 건너뛰기

📋 기타:
  list                    소스 목록 보기
""")
    list_available_sources()


def main():
    """메인 진입점"""
    if len(sys.argv) < 2:
        print_usage()
        return
    
    command = sys.argv[1].lower()
    
    # 소스 목록
    if command == 'list':
        list_available_sources()
        return
    
    # 단계별 실행
    if command == 'collect':
        source_id = sys.argv[2] if len(sys.argv) > 2 else None
        if not source_id:
            print("❌ source_id를 지정하세요")
            return
        step_collect(source_id)
        
    elif command == 'extract':
        source_id = sys.argv[2] if len(sys.argv) > 2 else None
        if not source_id:
            print("❌ source_id를 지정하세요")
            return
        links = step_collect(source_id)
        if links:
            asyncio.run(step_extract(links))
            
    elif command == 'analyze':
        step_analyze()
        
    elif command == 'stage':
        step_stage()
        
    elif command == 'publish':
        step_publish()
        
    elif command == 'all':
        source_id = sys.argv[2] if len(sys.argv) > 2 else None
        if not source_id:
            print("❌ source_id를 지정하세요")
            return
        asyncio.run(run_all(source_id, include_publish=False))
        
    elif command == 'full':
        source_id = sys.argv[2] if len(sys.argv) > 2 else None
        if not source_id:
            print("❌ source_id를 지정하세요")
            return
        asyncio.run(run_all(source_id, include_publish=True))
    
    else:
        # 레거시 모드
        source_id = command
        skip_mll = '--skip-mll' in sys.argv
        asyncio.run(test_single_article(source_id, skip_mll))


if __name__ == "__main__":
    main()
