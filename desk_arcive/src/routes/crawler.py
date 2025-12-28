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

# 공통 인증 모듈
from src.routes.auth import requires_auth

from crawler import load_targets, fetch_links
from src.db_client import DBClient
from src.crawler.utils import RobotsChecker
from src.crawler.core import AsyncCrawler
from src.core_logic import (
    load_from_cache as _core_load_from_cache,
    save_to_cache as _core_save_to_cache,
    normalize_field_names as _core_normalize_field_names,
    get_article_id,
    load_automation_config,
    get_stage,
    set_stage,
    Stage
)
from src.trash_manager import TrashManager # [NEW]
from src.crawler_state import set_crawling, get_crawling_status, get_crawl_logs # [MODIFIED]

crawler_bp = Blueprint('crawler', __name__)

db = DBClient()
robots_checker = RobotsChecker()
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')
trash_manager = TrashManager(CACHE_DIR) # [NEW]


@crawler_bp.route('/api/crawl/status')
def crawl_status():
    """크롤링 진행 상태 반환"""
    return jsonify(get_crawling_status())

@crawler_bp.route('/api/logs/crawler')
def crawler_logs():
    """최근 크롤링 로그 반환 (페이지네이션 지원)"""
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))
    return jsonify(get_crawl_logs(limit, offset))


def load_from_cache(url):
    return _core_load_from_cache(url)


def save_to_cache(url, content):
    return _core_save_to_cache(url, content)


def normalize_field_names(data):
    return _core_normalize_field_names(data)


@crawler_bp.route('/crawler')
@requires_auth
def crawler_page():
    return render_template('index.html', active='cache')


@crawler_bp.route('/inspector')
@requires_auth
def inspector_page():
    return render_template('inspector.html', active='inspector')


@crawler_bp.route('/api/targets')
def get_targets():
    _, targets = load_targets()
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
@requires_auth
def fetch():
    target_id = request.args.get('target_id')
    _, targets = load_targets()
    
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
@requires_auth
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
@requires_auth
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
@requires_auth
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
        # [NEW] Update Status
        fetch_count = len(urls_to_fetch)
        if fetch_count > 0:
            set_crawling(True, f"Extracting {fetch_count} URLs")

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
    finally:
        set_crawling(False)


@crawler_bp.route('/api/save', methods=['POST'])
@requires_auth
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
        # [UNIFIED] Use set_stage for consistent classification
        set_stage(data, Stage.ANALYZED)
        data['analyzed_at'] = datetime.now(timezone.utc).isoformat()
        
        save_to_cache(url, data)
        
        return jsonify({
            'status': 'success',
            'message': 'Article analyzed and saved (Status: ANALYZED).',
            'article_id': get_article_id(url)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@crawler_bp.route('/api/skip', methods=['POST'])
@requires_auth
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
@requires_auth
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
@requires_auth
def get_unprocessed_items():
    """
    모든 캐시 파일 중 아직 발행되지 않은(미처리) 항목만 반환
    - hours 파라미터: 현재 시점부터 N시간 이내 항목만 (0 = 전체)
    - 필터 조건: content.get('saved') is not True AND DB status is not ACCEPTED/WORTHLESS
    """
    import glob
    from datetime import datetime, timezone, timedelta
    
    # 1. 시간 범위 파라미터
    hours_param = request.args.get('hours', '0')
    try:
        filter_hours = int(hours_param)
    except:
        filter_hours = 0
    
    cutoff_time = None
    if filter_hours > 0:
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=filter_hours)
    
    # 2. DB History (이미 처리된 URL 확인용)
    unprocessed = []
    seen_urls = set()
    
    # [NEW] Check for Mode
    # mode='all': Show everything including Saved/Staged (for Inspecting history)
    # include_trash: Explicitly show Rejected/Trash items
    
    mode = request.args.get('mode', 'normal')
    show_all = (mode == 'all')
    
    # [FIX] mode='all' should NOT automatically include trash. Trash must be explicit.
    include_trash = (request.args.get('include_trash') == 'true') or (mode == 'trash')
    
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
    limit = 10000  # 사실상 무제한 (분석 작업대는 모든 항목 표시)
    
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
            
            # [NEW] 시간 범위 필터링 (Enhanced)
            if cutoff_time:
                # Priority: updated_at > crawled_at > cached_at
                ts_str = content.get('updated_at') or content.get('crawled_at') or content.get('cached_at') or content.get('saved_at')
                if ts_str:
                    try:
                        # ISO format parsing
                        crawled_at = datetime.fromisoformat(crawled_at_str.replace('Z', '+00:00'))
                        if crawled_at.tzinfo is None:
                            crawled_at = crawled_at.replace(tzinfo=timezone.utc)
                        if crawled_at < cutoff_time:
                            continue  # 시간 범위 밖
                    except:
                        pass  # 파싱 실패 시 포함
            
            # 2. Logic Unification with Desk.py
            # File Content is the Source of Truth for current status
            
            # --- Unified Classification Logic for Visibility ---
            
            # Desk Logic for Rejection:
            is_file_rejected = content.get('rejected', False) or content.get('status') in ['MLL_FAILED', 'INVALID', 'TRASH', 'CORRUPTED', 'SKIPPED', 'WORTHLESS', 'REJECTED']
            
            db_status = db.get_history_status(url)
            is_db_rejected = db_status in ['REJECTED', 'WORTHLESS', 'SKIPPED']

            # Resurrect check: if file says ANALYZED/NEW, ignore DB rejection
            is_analyzed_file = (
                content.get('status') == 'ANALYZED' or
                content.get('mll_status') == 'analyzed' or
                content.get('impact_score') is not None or
                content.get('zero_echo_score') is not None
            )
            is_resurrected = is_analyzed_file and not is_file_rejected
            
            # Determine if effective rejected
            is_effective_rejected = is_file_rejected or (is_db_rejected and not is_resurrected)
            
            # Determine if effective published
            is_published = content.get('published', False) or db_status == 'ACCEPTED'
            
            # Determine if staging (saved)
            is_saved = content.get('saved', False) or content.get('status') == 'ACCEPTED'

            # --- Filtering based on Mode ---
            
            if include_trash:
                # Mode: Trash Only (or include) meaning we WANT rejected items
                # But typically 'Trash Mode' means SHOW ONLY TRASH
                if not is_effective_rejected: continue
                # Pass through if rejected
                
            elif show_all:
                # Mode: All (Show Inbox + Analyzed + potentially Staged/Published for history view?)
                # Inspector 'View All' usually means "Don't hide Staged/Published/Analyzed"
                # BUT Hide Rejected (Trash)
                if is_effective_rejected: continue
                
            else:
                # Mode: Normal (Show Inbox + Analyzed)
                # Hide Staged/Published (Completed work)
                # Hide Rejected (Trash)
                if is_effective_rejected: continue
                if is_published: continue
                if is_saved: continue # Hide Staged items in default view (Since they are done in Inspector's eyes, moved to Desk)

            
            # [FIX] Prefer File status if explicit
            final_status = content.get('status')
            if not final_status or final_status == 'NEW':
                final_status = db_status if db_status else 'NEW'

            # [FIX] Recover source_id if unknown (heuristic)
            src_id = content.get('source_id', 'unknown')
            if src_id == 'unknown':
                try:
                    if 'cached_targets' not in locals():
                        from crawler import load_targets
                        cached_settings, cached_targets = load_targets()
                    
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
@requires_auth
def get_cache_dates():
    """desk/cache 하위의 날짜 폴더 목록 반환 (최신순)"""
    try:
        dirs = [d for d in os.listdir(CACHE_DIR) if os.path.isdir(os.path.join(CACHE_DIR, d)) and d != 'batches']
        dirs.sort(reverse=True)
        return jsonify({'success': True, 'dates': dirs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@crawler_bp.route('/api/cache/list_by_date')
@requires_auth
def get_cache_by_date():
    """특정 날짜 또는 전체 캐시 파일들을 상태별로 분류하여 반환 for Kanban"""
    target_date = request.args.get('date', '')
    
    # [NEW] 시간 범위 파라미터 (start_time, end_time - ISO format)
    start_time_param = request.args.get('start_time', '')
    end_time_param = request.args.get('end_time', '')
    
    # Legacy support: hours 파라미터
    hours_param = request.args.get('hours', '0')
    
    start_cutoff = None
    end_cutoff = None
    
    # 새 방식: start_time/end_time 우선
    if start_time_param:
        try:
            start_cutoff = datetime.fromisoformat(start_time_param.replace('Z', '+00:00'))
            if start_cutoff.tzinfo is None:
                start_cutoff = start_cutoff.replace(tzinfo=timezone.utc)
        except:
            pass
    
    if end_time_param:
        try:
            end_cutoff = datetime.fromisoformat(end_time_param.replace('Z', '+00:00'))
            if end_cutoff.tzinfo is None:
                end_cutoff = end_cutoff.replace(tzinfo=timezone.utc)
        except:
            pass
    
    # 레거시 방식: hours 파라미터 (start_time이 없을 때만)
    if not start_cutoff and hours_param != '0':
        try:
            filter_hours = int(hours_param)
            if filter_hours > 0:
                from datetime import timedelta
                start_cutoff = datetime.now(timezone.utc) - timedelta(hours=filter_hours)
        except:
            pass
    
    # 전체 또는 특정 날짜
    if target_date == 'all' or not target_date:
        # 모든 날짜 폴더 검색
        import glob
        files = glob.glob(os.path.join(CACHE_DIR, '**', '*.json'), recursive=True)
    else:
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
        # [FIX] Skip batch files (aligned with Desk logic)
        if 'batch_' in filename or 'batches' in filepath.split(os.sep) or filename == 'index.json':
            continue
            
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
        
        # Determine Status
        if is_corrupted:
             kanban_data['trash'].append(content)
             continue
        
        # [FIX] Define url before use
        url = content.get('url')
        if not url: continue
        
        # DB Status Check (for reference, not for classification)
        db_status = db.get_history_status(url)
        content['db_status'] = db_status
        
        # --- UNIFIED CLASSIFICATION: Use classify_article() ---
        from src.core_logic import classify_article
        classification = classify_article(content)
        stage = classification['stage']
        is_published = classification['is_published']
        category_key = classification['category_key']
        
        # [MODIFIED] 시간 필터링 - start_cutoff ~ end_cutoff 범위
        if (start_cutoff or end_cutoff) and not is_corrupted:
            # Priority: updated_at > crawled_at > cached_at
            ts_str = content.get('updated_at') or content.get('crawled_at') or content.get('cached_at') or content.get('saved_at')
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    # Check range
                    if start_cutoff and ts < start_cutoff:
                        continue  # Before start time
                    if end_cutoff and ts > end_cutoff:
                        continue  # After end time
                except:
                    pass  # Parse error - keep it
        
        # Kanban Column Assignment (using category_key for consistency)
        # Map category_key to kanban columns
        if category_key == 'published':
            kanban_data['published'].append(content)
        elif category_key == 'rejected':
            kanban_data['trash'].append(content)
        elif category_key == 'staged':
            kanban_data['staged'].append(content)
        elif category_key == 'analyzed':
            kanban_data['analyzed'].append(content)
        else:
            kanban_data['inbox'].append(content)
             
    return jsonify({'success': True, 'data': kanban_data})

@crawler_bp.route('/api/delete_items', methods=['POST'])
@requires_auth
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
@requires_auth
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
                
                # Apply Status Logic using set_stage() / set_published()
                from src.core_logic import set_published
                
                if target_status == 'inbox':
                    set_stage(content, Stage.INBOX)
                    content['saved'] = False
                    content['published'] = False
                    
                elif target_status == 'analyzed':
                    set_stage(content, Stage.ANALYZED)
                    
                elif target_status == 'staged':
                    set_stage(content, Stage.STAGED)
                    content['published'] = False
                    content.pop('publish_id', None)
                    content.pop('edition_name', None)
                    content.pop('published_at', None)
                    
                elif target_status == 'published':
                    # Published is independent flag, not a stage change
                    set_published(content, True)
                    
                elif target_status == 'unpublished':
                    # Remove published flag (keep stage unchanged)
                    set_published(content, False)
                    content.pop('published_at', None)
                        
                elif target_status == 'trash':
                    set_stage(content, Stage.TRASH)

                # Save In-Place
                with open(cache_path, 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
                    
                updated_count += 1
                
            except Exception as e:
                print(f"❌ Error updating {cache_path}: {e}")
                
        return jsonify({'success': True, 'count': updated_count})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
