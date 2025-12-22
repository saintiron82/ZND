# -*- coding: utf-8 -*-
"""
Crawler API - 페이지 뷰, 링크 수집, 콘텐츠 추출, 저장
"""
import os
import json
import asyncio
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, render_template

from crawler import load_targets, fetch_links
from src.db_client import DBClient
from src.crawler.utils import RobotsChecker
from src.crawler.core import AsyncCrawler
from src.core_logic import (
    load_from_cache as _core_load_from_cache,
    save_to_cache as _core_save_to_cache,
    normalize_field_names as _core_normalize_field_names,
    get_article_id,
    load_automation_config
)
from src.trash_manager import TrashManager # [NEW]

crawler_bp = Blueprint('crawler', __name__)

db = DBClient()
robots_checker = RobotsChecker()
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')
trash_manager = TrashManager(CACHE_DIR) # [NEW]


def load_from_cache(url):
    return _core_load_from_cache(url)


def save_to_cache(url, content):
    return _core_save_to_cache(url, content)


def normalize_field_names(data):
    return _core_normalize_field_names(data)


@crawler_bp.route('/crawler')
def crawler_page():
    return render_template('index.html')


@crawler_bp.route('/inspector')
def inspector_page():
    return render_template('inspector.html')


@crawler_bp.route('/api/targets')
def get_targets():
    targets = load_targets()
    return jsonify(targets)


@crawler_bp.route('/api/dedup_categories')
def get_dedup_categories():
    """중복 제거 LLM용 분류 카테고리 목록 반환"""
    try:
        config = load_automation_config(force_reload=True)
        categories = config.get('dedup_categories', {}).get('categories', [
            "AI/ML", "Cloud/Infra", "Security", "Business", 
            "Hardware", "Software", "Research", "Policy", "Startup", "Other"
        ])
        return jsonify({'categories': categories})
    except Exception as e:
        return jsonify({'categories': [], 'error': str(e)}), 500


@crawler_bp.route('/api/fetch')
def fetch():
    target_id = request.args.get('target_id')
    targets = load_targets()
    
    selected_targets = []
    if target_id == 'all':
        selected_targets = targets
    else:
        found = next((t for t in targets if t['id'] == target_id), None)
        if found:
            selected_targets = [found]
    
    if not selected_targets:
        return jsonify({'error': 'Target not found'}), 404
        
    all_links = []
    
    for target in selected_targets:
        links = fetch_links(target)
        limit = target.get('limit', 5)
        if limit:
            links = links[:limit]
            
        for link in links:
            all_links.append((link, target['id']))
    
    link_data = []
    seen_urls = set()
    
    for link_tuple in all_links:
        url = link_tuple[0]
        source_id = link_tuple[1]
        
        if url in seen_urls: continue
        seen_urls.add(url)
        
        status = db.get_history_status(url)
        cached_data = load_from_cache(url)
        
        if cached_data and cached_data.get('saved'):
            status = 'ACCEPTED'
        
        link_item = {
            'url': url,
            'source_id': source_id,
            'status': status if status else 'NEW',
            'cached': cached_data is not None
        }
        
        if cached_data:
            link_item['content'] = cached_data
        
        link_data.append(link_item)
            
    return jsonify({'links': link_data, 'total': len(link_data)})


@crawler_bp.route('/api/extract')
def extract():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    cached = load_from_cache(url)
    if cached:
        return jsonify(cached)

    if not robots_checker.can_fetch(url):
        return jsonify({'error': 'Disallowed by robots.txt'}), 403

    async def get_data():
        crawler_pw = AsyncCrawler(use_playwright=True)
        data = None
        try:
            await crawler_pw.start()
            data = await crawler_pw.process_url(url)
        except Exception as e:
            print(f"⚠️ [Extract] Playwright error: {e}")
        finally:
            await crawler_pw.close()
            
        text_len = len(data.get('text', '')) if data else 0
        if data and text_len >= 200:
            return data
            
        # Fallback to HTTP
        crawler_http = AsyncCrawler(use_playwright=False)
        try:
            return await crawler_http.process_url(url)
        finally:
            await crawler_http.close()

    try:
        content = asyncio.run(get_data())
    except Exception as e:
        return jsonify({'error': f"Extraction failed: {str(e)}"}), 500

    if not content:
        return jsonify({'error': 'Failed to extract content'}), 500

    text_len = len(content.get('text', ''))
    if text_len < 200:
        db.save_history(url, 'WORTHLESS', reason='text_too_short')
        return jsonify({'error': f"Content too short ({text_len} chars)"}), 400
    
    save_to_cache(url, content) # cache에 저장 (status 없이 저장됨 -> 아래에서 추가될 수 있지만 여기선 RAW 명시 하는게 좋음)
    content['status'] = 'RAW' # [MODIFIED] 명시
    save_to_cache(url, content) # 다시 저장 (효율은 떨어지지만 확실하게)
    return jsonify(content)


@crawler_bp.route('/api/force_extract')
def force_extract():
    """강제 추출 - 캐시 무시"""
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    if not robots_checker.can_fetch(url):
        return jsonify({'error': 'Disallowed by robots.txt'}), 403

    async def get_data():
        crawler = AsyncCrawler(use_playwright=True)
        try:
            await crawler.start()
            return await crawler.process_url(url)
        finally:
            await crawler.close()

    try:
        content = asyncio.run(get_data())
        if content and content.get('url'):
            save_to_cache(url, content)
        return jsonify(content or {})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@crawler_bp.route('/api/extract_batch', methods=['POST'])
def extract_batch():
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify([])

    cached_results = []
    urls_to_fetch = []
    
    for url in urls:
        cached = load_from_cache(url)
        if cached:
            cached_results.append(cached)
        else:
            urls_to_fetch.append(url)

    async def get_data_batch(url_list):
        crawler = AsyncCrawler(use_playwright=True)
        try:
            await crawler.start()
            return await crawler.process_urls(url_list)
        finally:
            await crawler.close()

    try:
        fetched_results = []
        if urls_to_fetch:
            fetched_results = asyncio.run(get_data_batch(urls_to_fetch))
            
            for res in fetched_results:
                if res.get('url'):
                    res['status'] = 'RAW' # [MODIFIED] 배치 수집도 RAW 상태
                    save_to_cache(res['url'], res)
        
        all_results = cached_results + fetched_results
        
        valid_results = []
        for res in all_results:
            text_len = len(res.get('text', ''))
            if text_len < 200:
                db.save_history(res['url'], 'WORTHLESS', reason='text_too_short')
            else:
                valid_results.append(res)

        return jsonify(valid_results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@crawler_bp.route('/api/save', methods=['POST'])
def save():
    """Save to staging (cache only)"""
    from src.core_logic import save_to_cache, get_article_id
    
    data = normalize_field_names(request.json)
    
    required_fields = ['url', 'summary', 'zero_echo_score', 'impact_score']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400
            
    if not data.get('title_ko') and not data.get('title'):
        return jsonify({'error': 'Missing field: title_ko or title'}), 400
    
    try:
        url = data['url']
        data['status'] = 'reviewed'
        data['staged'] = True
        data['staged_at'] = datetime.now(timezone.utc).isoformat()
        
        save_to_cache(url, data)
        
        return jsonify({
            'status': 'success',
            'message': 'Article saved to staging.',
            'article_id': get_article_id(url)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@crawler_bp.route('/api/skip', methods=['POST'])
def skip():
    """Skip article"""
    from src.pipeline import mark_skipped
    
    data = request.json
    url = data.get('url')
    reason = data.get('reason', 'manual_skip')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    result = mark_skipped(url, reason)
    return jsonify({'status': 'success', **result})


@crawler_bp.route('/api/update_cache', methods=['POST'])
def update_cache():
    """캐시 업데이트 (LLM 분석 결과 병합)"""
    try:
        data = request.json
        url = data.get('url')
        mll_result = data.get('mll_result', {})
        
        if not url:
            return jsonify({'error': 'URL required'}), 400
            
        existing = load_from_cache(url) or {}
        merged = {**existing, **normalize_field_names(mll_result)}
        merged['status'] = 'ANALYZED'  # [MODIFIED] 분석 완료 상태
        merged['analyzed_at'] = datetime.now(timezone.utc).isoformat()
        
        save_to_cache(url, merged)
        return jsonify({'status': 'success', 'message': 'Cache updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@crawler_bp.route('/api/unprocessed_items')
def get_unprocessed_items():
    """
    모든 캐시 파일 중 아직 발행되지 않은(미처리) 항목만 반환
    - 날짜 제한 없음 (desk/cache 하위 전체 검색)
    - 필터 조건: content.get('saved') is not True AND DB status is not ACCEPTED/WORTHLESS
    """
    import glob
    
    # 1. DB History (이미 처리된 URL 확인용)
    unprocessed = []
    seen_urls = set()
    
    # [NEW] Check for Trash Mode
    include_trash = request.args.get('include_trash') == 'true'
    
    # cache 디렉토리 하위의 모든 json 파일 검색 (재귀적)
    
    # cache 디렉토리 하위의 모든 json 파일 검색 (재귀적)
    # 구조: desk/cache/YYYY-MM-DD/*.json
    search_pattern = os.path.join(CACHE_DIR, '**', '*.json')
    
    # glob은 iterator를 반환하므로 메모리 효율적
    # recursive=True를 위해 ** 사용
    files = glob.glob(search_pattern, recursive=True)
    
    # [MODIFIED] 오래된 순 정렬 (Oldest First)
    # 이유: 원본(가장 먼저 수집된 것)을 기준으로 중복을 체크하기 위함.
    # 만약 과거에 이미 수집되고 처리된(Saved) 파일이 있다면, seen_urls에 먼저 등록되고
    # 이후에 수집된(Newest) 중복 파일은 seen_urls 체크에서 걸러지게 됨.
    files.sort() 
    
    count = 0
    limit = 500 # 너무 많으면 UI 터지니까 안전장치 (필요시 조정)
    
    for filepath in files:
        if count >= limit: break
        
        try:
            filename = os.path.basename(filepath)
            if not filename.endswith('.json'): continue
            
            # 파일 읽기
            with open(filepath, 'r', encoding='utf-8') as f:
                content = json.load(f)
            
            url = content.get('url')
            if not url: continue
            
            # [NEW] Check for duplicates
            if url in seen_urls: continue
            seen_urls.add(url)
            
            # 1. 캐시 파일 내 'saved' 플래그 확인 (이미 발행된 것 제외)
            if content.get('saved'): continue
            
            # 2. DB History Status 확인 (더 확실한 검증)
            status = db.get_history_status(url)
            
            is_trash_status = status in ['ACCEPTED', 'WORTHLESS', 'SKIPPED', 'REJECTED']
            
            # [MODIFIED] Trash filtering logic
            if not include_trash:
                # Normal mode: Hide processed/trash items
                if is_trash_status: continue
            
            # (If include_trash is True, we include everything, including ACCEPTED/REJECTED)
            # But maybe we still want to filter 'ACCEPTED' (Published)?
            # Usually Trash View is for 'Rejected/Skipped'. 'Accepted' is Published.
            # Let's include everything if trash mode is ON, or refine?
            # User request: "거부되어서 발행이 취소된 리스트" -> REJECTED/SKIPPED/WORTHLESS.
            # ACCEPTED는 '발행됨'이므로 휴지통이 아님. 하지만 목록에 보여도 됨.
            
            # For now, simplistic approach:
            # If include_trash is False, hide all status items.
            # If include_trash is True, show everything.
            
            # 3. 추가 필터: 만약 Trash Mode인데 Status가 없는(NEW) 항목은? -> 보여줌.
            # 결과적으로 include_trash=True면 '모든 캐시 파일'을 보여줌.
                
            # 여기까지 오면 포함 대상
            # status가 None이면 NEW, 아니면(MLL_FAILED 등) 그대로 사용
            final_status = status if status else 'NEW'
                
            # 여기까지 오면 '미발행(Unprocessed)' 상태임
            # status가 None이면 NEW, 아니면(MLL_FAILED 등) 그대로 사용
            final_status = status if status else 'NEW'
            
            unprocessed.append({
                'url': url,
                'source_id': content.get('source_id', 'unknown'),
                'title': content.get('title') or content.get('title_ko'),
                'status': final_status,
                'cached': True,
                'content': content
            })
            count += 1
            
        except Exception as e:
            # 개별 파일 에러는 무시하고 진행
            print(f"Error reading cache {filepath}: {e}")
            continue

    return jsonify({'links': unprocessed, 'total': len(unprocessed)})


@crawler_bp.route('/api/delete_items', methods=['POST'])
def delete_items():
    """
    [NEW] 선택 항목 영구 삭제 (Status=REJECTED, File=Delete)
    Body: { "urls": ["url1", "..."] }
    """
    try:
        data = request.get_json()
        urls = data.get('urls', [])
        
        if not urls:
            return jsonify({'success': False, 'error': 'No URLs provided'}), 400
            
        result = trash_manager.dispose_items(urls)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
