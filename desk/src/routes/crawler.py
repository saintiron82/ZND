# -*- coding: utf-8 -*-
"""
Crawler API - 페이지 뷰, 링크 수집, 콘텐츠 추출, 저장
"""
import os
import json
import glob
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
    
    # [MODIFIED] Support both 'urls' (list of strings) and 'items' (list of objects with source_id)
    raw_urls = data.get('urls', [])
    raw_items = data.get('items', [])
    
    # Normalize to items map: url -> source_id
    url_source_map = {}
    
    # 1. Process 'items' (Preferred)
    for item in raw_items:
        if isinstance(item, dict) and item.get('url'):
            url_source_map[item['url']] = item.get('source_id', 'unknown')
            
    # 2. Process 'urls' (Legacy/Fallback)
    for u in raw_urls:
         if u not in url_source_map:
             url_source_map[u] = 'unknown'

    all_target_urls = list(url_source_map.keys())

    if not all_target_urls:
        return jsonify([])

    cached_results = []
    urls_to_fetch = []
    
    for url in all_target_urls:
        cached = load_from_cache(url)
        if cached:
            # [FIX] Ensure source_id is preserved if cached item lacks it but we know it
            if url_source_map[url] != 'unknown' and cached.get('source_id', 'unknown') == 'unknown':
                 cached['source_id'] = url_source_map[url]
                 save_to_cache(url, cached) # Update cache with missing source_id
            
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
                    res['status'] = 'RAW'
                    # [FIX] Inject source_id from request
                    if res['url'] in url_source_map:
                        res['source_id'] = url_source_map[res['url']]
                    
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
        data['saved'] = True  # [FIX] Inspector에서 'New' 목록에서 제외하기 위해 추가
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
    
    # [NEW] Check for Mode
    mode = request.args.get('mode', 'normal')
    include_trash = (request.args.get('include_trash') == 'true') or (mode == 'trash') or (mode == 'all')
    show_all = (mode == 'all')
    
    # cache 디렉토리 하위의 모든 json 파일 검색 (재귀적)
    # 구조: desk/cache/YYYY-MM-DD/*.json
    search_pattern = os.path.join(CACHE_DIR, '**', '*.json')
    
    # glob은 iterator를 반환하므로 메모리 효율적
    # recursive=True를 위해 ** 사용
    files = glob.glob(search_pattern, recursive=True)
    
    # [MODIFIED] Sort Strategy
    if show_all:
         # Newest First for All View (Snapshot)
         files.sort(key=os.path.getmtime, reverse=True)
    else:
         # Oldest First for Processing (Deduplication)
         files.sort() 
    
    count = 0
    limit = 2000 if show_all else 500 # "All" 모드에서는 더 많이
    
    for filepath in files:
        if count >= limit: break
        
        try:
            filename = os.path.basename(filepath)
            if not filename.endswith('.json'): continue
            
            content = {}
            is_corrupted = False

            try:
                # 파일 읽기
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = json.load(f)
            except Exception as e:
                 if show_all:
                     is_corrupted = True
                     content = {
                        'url': f"corrupted://{filename}",
                        'title': f"❌ Corrupted: {filename}",
                        'source_id': 'unknown',
                        'status': 'CORRUPTED',
                        'error': str(e),
                        'filepath': filepath
                     }
                 else:
                     raise e

            url = content.get('url')
            if not url and not is_corrupted: continue
            
            # [NEW] Check for duplicates
            if url in seen_urls: continue
            if url: seen_urls.add(url)
            
            # 1. 캐시 파일 내 'saved' 플래그 확인 (이미 발행된 것 제외)
            if not show_all and content.get('saved'): continue
            
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

            # [FIX] Recover source_id if unknown (heuristic)
            src_id = content.get('source_id', 'unknown')
            if src_id == 'unknown':
                try:
                    if 'cached_targets' not in locals():
                        from crawler import load_targets
                        cached_targets = load_targets()
                    
                    from urllib.parse import urlparse
                    
                    # Target URL Domain
                    article_domain = urlparse(url).netloc.replace('www.', '')
                    
                    for t in cached_targets:
                        # Feed URLs might be rss.server.com, main site might be www.server.com
                        # We compare the 'root' part of domain if possible, or just containment
                        t_domain = urlparse(t.get('url', '')).netloc.replace('www.', '')
                        
                        # Match if target domain is inside article domain or vice versa
                        # (Simple containment covers subdomains)
                        if t_domain and article_domain and (t_domain in article_domain or article_domain in t_domain):
                             src_id = t['id']
                             break
                except Exception:
                    pass
            
            # [FIX] Inject recovered source_id into content object
            if src_id != 'unknown':
                content['source_id'] = src_id

            unprocessed.append({
                'url': url,
                'source_id': src_id,
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


# [NEW] Kanban Board APIs
@crawler_bp.route('/api/cache/dates')
def get_cache_dates():
    """desk/cache 하위의 날짜 폴더 목록 반환 (최신순)"""
    try:
        dirs = [d for d in os.listdir(CACHE_DIR) if os.path.isdir(os.path.join(CACHE_DIR, d)) and d != 'batches']
        dirs.sort(reverse=True)
        return jsonify({'success': True, 'dates': dirs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@crawler_bp.route('/api/cache/list_by_date')
def get_cache_by_date():
    """특정 날짜의 캐시 파일들을 상태별로 분류하여 반환 for Kanban"""
    target_date = request.args.get('date')
    if not target_date:
        return jsonify({'success': False, 'error': 'Date required'}), 400
    
    target_dir = os.path.join(CACHE_DIR, target_date)
    if not os.path.exists(target_dir):
         return jsonify({'success': False, 'error': 'Date not found'}), 404
         
    files = glob.glob(os.path.join(target_dir, "*.json"))
    files.sort(key=os.path.getmtime, reverse=True)
    
    kanban_data = {
        'inbox': [],    # NEW, RAW
        'analyzed': [], # ANALYZED (but not saved)
        'staged': [],   # Saved (but not published)
        'published': [], # Published (ACCEPTED)
        'trash': []     # REJECTED, WORTHLESS, SKIPPED, CORRUPTED
    }
    
    for filepath in files:
        filename = os.path.basename(filepath)
        content = {}
        status = 'NEW'
        is_corrupted = False
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = json.load(f)
        except Exception as e:
            is_corrupted = True
            content = {
                'url': f"corrupted://{filename}",
                'title': f"❌ Corrupted: {filename}",
                'status': 'CORRUPTED',
                'error': str(e)
            }
            
        url = content.get('url')
        
        # Determine Status
        if is_corrupted:
            kanban_data['trash'].append(content)
            continue
            
        if not url: continue
        
        # DB Status Check
        db_status = db.get_history_status(url)
        content['db_status'] = db_status
        
        # Classification Logic
        # 1. Trash
        if db_status in ['REJECTED', 'WORTHLESS', 'SKIPPED'] or content.get('status') in ['MLL_FAILED', 'INVALID']:
            kanban_data['trash'].append(content)
        # 2. Published
        elif content.get('published') or db_status == 'ACCEPTED':
             kanban_data['published'].append(content)
        # 3. Staged (Saved but not published)
        elif content.get('saved'):
             kanban_data['staged'].append(content)
        # 4. Analyzed (Has score but not saved)
        elif content.get('status') == 'ANALYZED' or content.get('impact_score'):
             kanban_data['analyzed'].append(content)
        # 5. Inbox (Others)
        else:
             kanban_data['inbox'].append(content)
             
    return jsonify({'success': True, 'data': kanban_data})

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

@crawler_bp.route('/api/cache/update_status', methods=['POST'])
def update_cache_status():
    """
    Update status of cached items (Move between Kanban columns).
    """
    try:
        data = request.json or {}
        urls = data.get('urls', [])
        target_status = data.get('target_status')
        
        if not urls or not target_status:
            return jsonify({'success': False, 'error': 'Missing urls or target_status'}), 400
            
        updated_count = 0
        from src.core_logic import get_url_hash, CACHE_DIR
        
        for url in urls:
            # Locate file matches
            url_hash = get_url_hash(url)
            search_pattern = os.path.join(CACHE_DIR, '*', f'{url_hash}.json')
            found_paths = glob.glob(search_pattern)
            
            if not found_paths:
                print(f"⚠️ Cache not found for {url}")
                continue
                
            # Usually there's only one, but take the latest if multiple
            found_paths.sort(key=os.path.getmtime, reverse=True)
            cache_path = found_paths[0]
            
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                # Apply Status Logic
                if target_status == 'inbox':
                    content['saved'] = False
                    content['published'] = False
                    content['status'] = 'RAW'
                    
                elif target_status == 'analyzed':
                    content['saved'] = False
                    content['published'] = False
                    content['status'] = 'ANALYZED'
                    
                elif target_status == 'staged':
                    content['saved'] = True
                    content['published'] = False
                    content.pop('publish_id', None)
                    content.pop('edition_name', None)
                    content.pop('published_at', None)
                    
                elif target_status == 'published':
                    content['saved'] = True
                    content['published'] = True
                    if 'published_at' not in content:
                        content['published_at'] = datetime.now(timezone.utc).isoformat()
                        
                elif target_status == 'trash':
                    content['status'] = 'TRASH'
                    content['saved'] = False
                    content['published'] = False

                # Save In-Place
                with open(cache_path, 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                    
                updated_count += 1
                
            except Exception as e:
                print(f"❌ Error updating {cache_path}: {e}")
                
        return jsonify({'success': True, 'count': updated_count})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
