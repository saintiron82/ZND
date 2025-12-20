import os
import json
import asyncio
import glob
import hashlib
from flask import Flask, render_template, request, jsonify
from crawler import load_targets, fetch_links
from src.db_client import DBClient
from src.crawler.utils import RobotsChecker
from src.crawler.core import AsyncCrawler
from datetime import datetime, timezone

# Import shared core logic (source of truth for all crawlers)
from src.core_logic import (
    get_url_hash as _core_get_url_hash,
    get_article_id,
    get_cache_path as _core_get_cache_path,
    load_from_cache as _core_load_from_cache,
    save_to_cache as _core_save_to_cache,
    normalize_field_names as _core_normalize_field_names,
    update_manifest as _core_update_manifest,
    normalize_url_for_dedupe,
    HistoryStatus,
    get_data_filename,
)
from src.batch_logic import create_batch, get_batches, publish_batch, discard_batch

app = Flask(__name__)

# [Debugging] Force disable caching to ensure frontend updates
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

db = DBClient()
robots_checker = RobotsChecker()
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')
# [REMOVED] CACHE_DIR - 이제 cache가 조판 역할도 수행

# --- URL-based Text Caching ---

# These functions now delegate to core_logic module for consistency
def get_url_hash(url):
    """Generate a short hash from URL for cache filename."""
    return _core_get_url_hash(url)

def get_cache_path(url, date_str=None):
    """Get cache file path for URL. Uses today's date if not specified."""
    return _core_get_cache_path(url, date_str)

def load_from_cache(url):
    """Load cached content for URL. Searches ALL date folders, not just today."""
    return _core_load_from_cache(url)

def save_to_cache(url, content):
    """Save content to cache for URL. Auto-generates article_id and cached_at if not present."""
    return _core_save_to_cache(url, content)

def normalize_field_names(data):
    """
    Normalize field names to handle case variations.
    e.g., zero_Echo_score, Zero_echo_score -> zero_echo_score
    Also migrates legacy zero_noise_score field.
    """
    return _core_normalize_field_names(data)

def update_manifest(date_str):
    """
    Updates or creates index.json for the given date directory.
    Aggregates all .json files (excluding index.json) and saves them as a list.
    """
    return _core_update_manifest(date_str)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/inspector')
def inspector():
    return render_template('inspector.html')

@app.route('/api/targets')
def get_targets():
    targets = load_targets()
    return jsonify(targets)

@app.route('/api/dedup_categories')
def get_dedup_categories():
    """중복 제거 LLM용 분류 카테고리 목록 반환 (매번 config 새로 읽음)"""
    try:
        from src.core_logic import load_automation_config
        # 매번 새로 읽어서 config 변경사항 즉시 반영
        config = load_automation_config(force_reload=True)
        categories = config.get('dedup_categories', {}).get('categories', [
            "AI/ML", "Cloud/Infra", "Security", "Business", 
            "Hardware", "Software", "Research", "Policy", "Startup", "Other"
        ])
        return jsonify({'categories': categories})
    except Exception as e:
        print(f"❌ [Dedup Categories] Error: {e}")
        return jsonify({'categories': [], 'error': str(e)}), 500


@app.route('/api/dates')
def get_dates():
    """Get list of available dates from data folder."""
    try:
        dates = []
        if os.path.exists(DATA_DIR):
            for item in os.listdir(DATA_DIR):
                item_path = os.path.join(DATA_DIR, item)
                # Check if it's a directory and matches YYYY-MM-DD format
                if os.path.isdir(item_path) and len(item) == 10 and item[4] == '-' and item[7] == '-':
                    # Count articles in this folder (excluding index.json)
                    json_files = [f for f in os.listdir(item_path) if f.endswith('.json') and f != 'index.json']
                    dates.append({
                        'date': item,
                        'count': len(json_files)
                    })
        
        # Sort by date descending (newest first)
        dates.sort(key=lambda x: x['date'], reverse=True)
        return jsonify(dates)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/articles_by_date')
def get_articles_by_date():
    """Get list of cached articles for a specific date (reads from CACHE folder)."""
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Date parameter is required'}), 400
    
    try:
        # Build a map of URL -> data filename for quick lookup
        url_to_data_file = {}
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                data_date_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(data_date_path):
                    continue
                for data_file in os.listdir(data_date_path):
                    if not data_file.endswith('.json') or data_file == 'index.json':
                        continue
                    data_filepath = os.path.join(data_date_path, data_file)
                    try:
                        with open(data_filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if data.get('url'):
                                url_to_data_file[data['url']] = {
                                    'filename': data_file,
                                    'date': date_folder,
                                    'path': data_filepath
                                }
                    except:
                        pass
        
        # Read from CACHE folder
        cache_date_dir = os.path.join(CACHE_DIR, date_str)
        if not os.path.exists(cache_date_dir):
            return jsonify({'error': f'No cache for date: {date_str}'}), 404
        
        articles = []
        for filename in os.listdir(cache_date_dir):
            if not filename.endswith('.json'):
                continue
            
            filepath = os.path.join(cache_date_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # Check status from history
                    url = data.get('url', '')
                    status = db.get_history_status(url) if url else 'NEW'
                    
                    # Find linked data file
                    linked_data = url_to_data_file.get(url)
                    
                    articles.append({
                        'url': url,
                        'title_ko': data.get('title_ko', data.get('title', '')),
                        'original_title': data.get('original_title', ''),
                        'source_id': data.get('source_id', 'unknown'),
                        'zero_echo_score': data.get('zero_echo_score'),
                        'impact_score': data.get('impact_score'),
                        'summary': data.get('summary', ''),
                        'filename': filename,
                        'filepath': filepath,  # cache path for deletion
                        'status': status if status else 'NEW',
                        'cached': True,
                        'data_file': linked_data,  # 연결된 data 파일 정보
                        'content': data
                    })
            except json.JSONDecodeError as e:
                # Auto-delete corrupted cache file
                print(f"🗑️ [Cache] Corrupted JSON detected, auto-deleting: {filepath}")
                print(f"   Error: {e}")
                try:
                    os.remove(filepath)
                    print(f"   ✅ Deleted corrupted file: {filename}")
                except Exception as del_err:
                    print(f"   ❌ Failed to delete: {del_err}")
            except Exception as e:
                print(f"⚠️ Error reading {filename}: {e}")
        
        # Sort by impact_score descending (if available), else by filename
        articles.sort(key=lambda x: (x.get('impact_score') or 0, x.get('filename', '')), reverse=True)
        
        return jsonify({
            'date': date_str,
            'articles': articles,
            'total': len(articles)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search_cache')
def search_cache():
    """Search cache files by filename across all dates. Also shows linked data file."""
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify({'error': 'Query parameter (q) is required'}), 400
    
    try:
        # Build a map of URL -> data filename for quick lookup
        url_to_data_file = {}
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                data_date_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(data_date_path):
                    continue
                for data_file in os.listdir(data_date_path):
                    if not data_file.endswith('.json') or data_file == 'index.json':
                        continue
                    data_filepath = os.path.join(data_date_path, data_file)
                    try:
                        with open(data_filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if data.get('url'):
                                url_to_data_file[data['url']] = {
                                    'filename': data_file,
                                    'date': date_folder,
                                    'path': data_filepath
                                }
                    except:
                        pass
        
        results = []
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            
                            # Search in: filename, title, article_id
                            title_field = (data.get('title', '') or data.get('title_ko', '') or '').lower()
                            article_id = (data.get('article_id', '') or '').lower()
                            
                            # Check if query matches any field
                            if query in filename.lower() or query in title_field or query in article_id:
                                url = data.get('url', '')
                                linked_data = url_to_data_file.get(url)
                                
                                results.append({
                                    'filename': filename,
                                    'date': date_folder,
                                    'path': filepath,
                                    'url': url,
                                    'title': data.get('title', data.get('title_ko', '')),
                                    'article_id': data.get('article_id', ''),
                                    'data_file': linked_data  # 연결된 data 파일 정보
                                })
                    except Exception:
                        # Include file even if can't read
                        if query in filename.lower():
                            results.append({
                                'filename': filename,
                                'date': date_folder,
                                'path': filepath
                            })
        
        results.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return jsonify({
            'query': query,
            'results': results,
            'total': len(results)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/find_by_article_ids', methods=['POST'])
def find_by_article_ids():
    """Find cache files by article_ids. Returns mapping of article_id -> cache data."""
    data = request.json
    article_ids = data.get('article_ids', [])
    
    if not article_ids:
        return jsonify({'error': 'article_ids array is required'}), 400
    
    try:
        # Build article_id -> cache data mapping
        result = {}
        article_id_set = set(article_ids)
        
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            cache_data = json.load(f)
                            aid = cache_data.get('article_id')
                            if aid and aid in article_id_set:
                                result[aid] = {
                                    'url': cache_data.get('url'),
                                    'source_id': cache_data.get('source_id'),
                                    'saved': cache_data.get('saved', False),
                                    'title_ko': cache_data.get('title_ko', cache_data.get('title', '')),
                                    'cache_path': filepath,
                                    'content': cache_data
                                }
                    except:
                        pass
        
        return jsonify({
            'found': result,
            'found_count': len(result),
            'requested_count': len(article_ids)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _get_duplicate_groups():
    """Helper to find duplicate cache files."""
    url_to_files = {}  # Normalized_URL -> list of cache files
    
    if os.path.exists(CACHE_DIR):
        for date_folder in os.listdir(CACHE_DIR):
            date_path = os.path.join(CACHE_DIR, date_folder)
            if not os.path.isdir(date_path):
                continue
            
            for filename in os.listdir(date_path):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(date_path, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        url = data.get('url', '')
                        if url:
                            norm_url = normalize_url_for_dedupe(url)
                            if norm_url not in url_to_files:
                                url_to_files[norm_url] = []
                            url_to_files[norm_url].append({
                                'filename': filename,
                                'date': date_folder,
                                'path': filepath,
                                'cached_at': data.get('cached_at', ''),
                                'original_url': url
                            })
                except:
                    pass
                    
    # Filter to only groups with > 1 file
    return {k: v for k, v in url_to_files.items() if len(v) > 1}

@app.route('/api/find_duplicate_caches')
def find_duplicate_caches():
    """Find duplicate cache files (same URL in multiple files)."""
    try:
        duplicates = _get_duplicate_groups()
        
        # Sort files within each duplicate group by cached_at (keep newest)
        for _, files in duplicates.items():
            files.sort(key=lambda x: x.get('cached_at', ''), reverse=True)
        
        return jsonify({
            'duplicates': duplicates,
            'total_duplicate_urls': len(duplicates),
            'total_duplicate_files': sum(len(f) - 1 for f in duplicates.values())  # -1 to keep one
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cleanup_duplicate_caches', methods=['POST'])
def cleanup_duplicate_caches():
    """Delete duplicate cache files, keeping the newest one for each URL."""
    try:
        deleted_count = 0
        duplicates = _get_duplicate_groups()
        
        # Delete duplicates (keep newest)
        for _, files in duplicates.items():
            if len(files) > 1:
                # Sort by cached_at descending (newest first)
                files.sort(key=lambda x: x.get('cached_at', ''), reverse=True)
                # Delete all except the first (newest)
                for file_info in files[1:]:
                    try:
                        os.remove(file_info['path'])
                        deleted_count += 1
                        print(f"🗑️ [Cleanup] Deleted duplicate: {file_info['path']} (Dup of {files[0]['original_url']})")
                    except Exception as e:
                        print(f"⚠️ [Cleanup] Failed to delete: {file_info['path']} - {e}")
        
        return jsonify({
            'status': 'success',
            'deleted_count': deleted_count,
            'message': f'Deleted {deleted_count} duplicate cache files'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/find_orphan_data_files')
def find_orphan_data_files():
    """Find DATA files that have no corresponding cache file (by URL or article_id)."""
    try:
        # Build sets of URLs and article_ids from cache
        cached_urls = set()
        cached_article_ids = set()
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            url = data.get('url')
                            article_id = data.get('article_id')
                            if url:
                                cached_urls.add(url)
                            if article_id:
                                cached_article_ids.add(article_id)
                    except:
                        pass
        
        # Find DATA files without corresponding cache (check both URL and article_id)
        orphan_files = []
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                date_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json') or filename in ['daily_summary.json', 'index.json']:
                        continue
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            url = data.get('url')
                            article_id = data.get('article_id')
                            # Check if connected by URL OR article_id
                            is_connected = (url and url in cached_urls) or (article_id and article_id in cached_article_ids)
                            if not is_connected:
                                orphan_files.append({
                                    'filename': filename,
                                    'date': date_folder,
                                    'path': filepath,
                                    'url': url,
                                    'article_id': article_id,
                                    'title': data.get('title_ko', data.get('title', ''))
                                })
                    except:
                        pass
        
        return jsonify({
            'orphan_files': orphan_files,
            'total': len(orphan_files),
            'cached_urls_count': len(cached_urls),
            'cached_article_ids_count': len(cached_article_ids)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cleanup_orphan_data_files', methods=['POST'])
def cleanup_orphan_data_files():
    """Delete DATA files that have no corresponding cache file (by URL or article_id)."""
    try:
        # Build sets of URLs and article_ids from cache
        cached_urls = set()
        cached_article_ids = set()
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            url = data.get('url')
                            article_id = data.get('article_id')
                            if url:
                                cached_urls.add(url)
                            if article_id:
                                cached_article_ids.add(article_id)
                    except:
                        pass
        
        # Delete DATA files without corresponding cache (check both URL and article_id)
        deleted_count = 0
        dates_affected = set()
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                date_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json') or filename in ['daily_summary.json', 'index.json']:
                        continue
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            url = data.get('url')
                            article_id = data.get('article_id')
                            # Check if connected by URL OR article_id
                            is_connected = (url and url in cached_urls) or (article_id and article_id in cached_article_ids)
                            if not is_connected:
                                os.remove(filepath)
                                deleted_count += 1
                                dates_affected.add(date_folder)
                                print(f"🗑️ [Cleanup] Deleted unconnected data file: {filepath}")
                    except Exception as e:
                        print(f"⚠️ [Cleanup] Error processing {filepath}: {e}")
        
        # Update daily summaries for affected dates
        for date_str in dates_affected:
            try:
                db._update_daily_summary(date_str)
            except:
                pass
        
        return jsonify({
            'status': 'success',
            'deleted_count': deleted_count,
            'message': f'Deleted {deleted_count} unconnected data files'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete_cache_file', methods=['POST'])
def delete_cache_file():
    """Delete a cache file by its filepath. Only works for cache folder, not data folder."""
    data = request.json
    filepath = data.get('filepath')
    
    if not filepath:
        return jsonify({'error': 'Filepath is required'}), 400
    
    # Security: Only allow deletion within CACHE directory (NOT data)
    abs_filepath = os.path.abspath(filepath)
    abs_cache_dir = os.path.abspath(CACHE_DIR)
    
    if not abs_filepath.startswith(abs_cache_dir):
        return jsonify({'error': 'Can only delete files in cache directory'}), 403
    
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"🗑️ [Delete] Deleted cache: {filepath}")
            return jsonify({'status': 'success', 'message': f'Deleted: {filepath}'})
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        print(f"❌ [Delete] Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cleanup_cache_file', methods=['POST'])
def cleanup_cache_file():
    """Clean up a cache file - keep only url, article_id, cached_at. Remove body/title/etc."""
    data = request.json
    filepath = data.get('filepath')
    
    if not filepath:
        return jsonify({'error': 'Filepath is required'}), 400
    
    # Security: Only allow cleanup within CACHE directory
    abs_filepath = os.path.abspath(filepath)
    abs_cache_dir = os.path.abspath(CACHE_DIR)
    
    if not abs_filepath.startswith(abs_cache_dir):
        return jsonify({'error': 'Can only clean files in cache directory'}), 403
    
    try:
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Read current data
        with open(filepath, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
        
        # Keep only essential fields
        cleaned_data = {
            'url': current_data.get('url', ''),
            'article_id': current_data.get('article_id', ''),
            'cached_at': current_data.get('cached_at', ''),
            'source_id': current_data.get('source_id', ''),
            'cleaned_at': datetime.now().isoformat(),
            'status': 'CLEANED'
        }
        
        # Write back cleaned data
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
        
        print(f"🧹 [Cleanup] Cleaned cache: {filepath}")
        return jsonify({'status': 'success', 'message': f'Cleaned: {filepath}'})
    except Exception as e:
        print(f"❌ [Cleanup] Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fetch')
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
        
        # Apply limit per targets
        limit = target.get('limit', 5)
        if limit:
            links = links[:limit]
            
        # Store as tuple (url, source_id)
        for link in links:
             all_links.append((link, target['id']))
    
    # Return all links with status
    link_data = []
    seen_urls = set()
    
    for link_tuple in all_links:
        url = link_tuple[0]
        source_id = link_tuple[1]
        
        if url in seen_urls: continue
        seen_urls.add(url)
        
        status = db.get_history_status(url)
        
        # Check if cached and load content
        cached_data = load_from_cache(url)
        
        # [FIX] 캐시에 saved: true가 있으면 ACCEPTED 처리
        if cached_data and cached_data.get('saved'):
            status = 'ACCEPTED'
        
        link_item = {
            'url': url,
            'source_id': source_id,
            'status': status if status else 'NEW',
            'cached': cached_data is not None
        }
        
        # Include cached content if available
        if cached_data:
            link_item['content'] = cached_data
        
        link_data.append(link_item)
            
    return jsonify({'links': link_data, 'total': len(link_data)})

@app.route('/api/extract')
def extract():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # Check cache first (ONLY cache, not data folder)
    cached = load_from_cache(url)
    if cached:
        print(f"📦 [Extract] Loaded from cache: {url}")
        return jsonify(cached)

    # Check robots.txt before crawling
    if not robots_checker.can_fetch(url):
        return jsonify({'error': 'Disallowed by robots.txt'}), 403

    # Check history logic as fallback or for other statuses
    if db.check_history(url):
        status = db.get_history_status(url)
        # If it was skipped/worthless, maybe we still want to re-crawl or show status?
        # But if it was ACCEPTED, find_article_by_url should have caught it.
        # If file is missing but history says ACCEPTED, we might need to re-crawl.
        if status == 'ACCEPTED':
             pass # Already handled by find_article_by_url or file is missing
        elif status in ['SKIPPED', 'WORTHLESS', 'INVALID']:
             # Optionally warn user? For now, we proceed to crawl if user requested specifically?
             # Or just return empty/error?
             # Let's let it re-crawl if the user explicitly clicked it, unless strictly blocked.
             pass
        
    async def get_data():
        # 1. Try Playwright first (Best for JS, but risks being blocked)
        print(f"🕷️ [Manual Extract] Attempting Playwright fetch: {url}")
        crawler_pw = AsyncCrawler(use_playwright=True) 
        data = None
        try:
            await crawler_pw.start()
            data = await crawler_pw.process_url(url)
        except Exception as e:
             print(f"⚠️ [Manual Extract] Playwright error: {e}")
        finally:
            await crawler_pw.close()
            
        # Check if Playwright succeeded
        text_len = len(data.get('text', '')) if data else 0
        if data and text_len >= 200:
            print(f"✅ [Manual Extract] Playwright success (text_len={text_len}).")
            return data
            
        print(f"⚠️ [Manual Extract] Playwright returned insufficient data (len={text_len}). Falling back to HTTP...")

        # 2. Fallback to HTTP (requests) - Often works if Playwright is blocked
        crawler_http = AsyncCrawler(use_playwright=False)
        try:
            # No start/close needed for HttpFetcher usually, but good practice if AsyncCrawler requires it
            # AsyncCrawler code calls start/close on fetcher. HttpFetcher doesn't really need start but has close.
            return await crawler_http.process_url(url)
        finally:
            await crawler_http.close()

    try:
        content = asyncio.run(get_data())
    except Exception as e:
        return jsonify({'error': f"Extraction failed: {str(e)}"}), 500

    if not content:
        return jsonify({'error': 'Failed to extract content'}), 500

    # [NEW] Check content length (Final check)
    text_len = len(content.get('text', ''))
    if text_len < 200:
        db.save_history(url, 'WORTHLESS', reason='text_too_short_manual')
        print(f"⚠️ [Manual Extract] Text too short ({text_len}), marked as WORTHLESS: {url}")
        return jsonify({'error': f"Article content too short ({text_len} chars). Marked as WORTHLESS."}), 400
    
    # [NEW] Save to cache
    save_to_cache(url, content)
        
    return jsonify(content)

@app.route('/api/force_extract')
def force_extract():
    """Force extract from URL - ignores cache and existing data files, always crawls fresh."""
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    # Check robots.txt
    if not robots_checker.can_fetch(url):
        return jsonify({'error': 'Disallowed by robots.txt'}), 403
    
    print(f"🔄 [Force Extract] Starting fresh crawl for: {url}")
    
    async def get_data():
        crawler = AsyncCrawler(use_playwright=True)
        try:
            await crawler.start()
            return await crawler.process_url(url)
        finally:
            await crawler.close()
    
    try:
        content = asyncio.run(get_data())
    except Exception as e:
        return jsonify({'error': f"Extraction failed: {str(e)}"}), 500
    
    if not content:
        return jsonify({'error': 'Failed to extract content'}), 500
    
    # Check content length
    text_len = len(content.get('text', ''))
    if text_len < 200:
        db.save_history(url, 'WORTHLESS', reason='text_too_short_manual')
        print(f"⚠️ [Force Extract] Text too short ({text_len}), marked as WORTHLESS: {url}")
        return jsonify({'error': f"Article content too short ({text_len} chars). Marked as WORTHLESS."}), 400
    
    # Save to cache (overwrites existing if any)
    save_to_cache(url, content)
    print(f"✅ [Force Extract] Successfully cached: {url}")
    
    return jsonify(content)

@app.route('/api/update_cache', methods=['POST'])
def update_cache():
    """Update cache with analysis results (LLM JSON response). Merges with existing cache to preserve original content."""
    data = request.json
    url = data.get('url')
    new_content = data.get('content')
    
    if not url or not new_content:
        return jsonify({'error': 'URL and content are required'}), 400
    
    try:
        # Load existing cache first to preserve original content (title, text)
        existing = load_from_cache(url) or {}
        
        # Normalize the new content field names (Handles nested Impact/ZeroEcho objects)
        new_content_normalized = normalize_field_names(new_content)
        
        # REMOVE text/title/article_id from new_content to prevent overwriting original
        # These fields should ONLY come from crawling, not from evaluation JSON
        # article_id must be preserved from cache or generated from URL hash
        protected_fields = ('text', 'title', 'article_id')
        safe_content = {k: v for k, v in new_content_normalized.items() if k not in protected_fields}
        
        # Merge: existing data + safe content (preserves original title, text, article_id)
        merged = {**existing, **safe_content}
        
        save_to_cache(url, merged)
        return jsonify({'status': 'success', 'message': 'Cache updated (merged)'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract_batch', methods=['POST'])
def extract_batch():
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify([])

    # [NEW] Check cache first, separate cached and uncached URLs
    cached_results = []
    urls_to_fetch = []
    
    for url in urls:
        cached = load_from_cache(url)
        if cached:
            cached_results.append(cached)
        else:
            urls_to_fetch.append(url)
    
    print(f"📦 [Batch] Cache hits: {len(cached_results)}, Need to fetch: {len(urls_to_fetch)}")

    async def get_data_batch(url_list):
        crawler = AsyncCrawler(use_playwright=True)
        try:
            await crawler.start()
            # process_urls is faster than process_url in loop
            return await crawler.process_urls(url_list)
        finally:
            await crawler.close()

    try:
        # Only fetch URLs not in cache
        fetched_results = []
        if urls_to_fetch:
            fetched_results = asyncio.run(get_data_batch(urls_to_fetch))
            
            # Save fetched results to cache
            for res in fetched_results:
                if res.get('url'):
                    save_to_cache(res['url'], res)
        
        # Combine cached and fetched results
        all_results = cached_results + fetched_results
        
        # [NEW] Filter worthless
        valid_results = []
        for res in all_results:
            text_len = len(res.get('text', ''))
            if text_len < 200:
                 db.save_history(res['url'], 'WORTHLESS', reason='text_too_short_manual_batch')
                 print(f"⚠️ [Manual Batch] Text too short ({text_len}), marked as WORTHLESS: {res['url']}")
            else:
                 valid_results.append(res)

        return jsonify(valid_results)
    except Exception as e:
        return jsonify({'error': f"Batch extraction failed: {str(e)}"}), 500

@app.route('/api/save', methods=['POST'])
def save():
    """
    Save article to Staging (Cache) ONLY.
    DOES NOT write to Firestore or create data file yet.
    """
    from src.core_logic import save_to_cache, get_article_id
    from datetime import datetime, timezone
    
    data = normalize_field_names(request.json)
    
    # Validate required fields
    required_fields = ['url', 'summary', 'zero_echo_score', 'impact_score']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400
            
    # title validation
    if not data.get('title_ko') and not data.get('title'):
        return jsonify({'error': 'Missing field: title_ko or title'}), 400
    
    try:
        url = data['url']
        
        # Mark as Reviewed/Staged
        data['status'] = 'reviewed'
        data['staged'] = True
        data['staged_at'] = datetime.now(timezone.utc).isoformat()
        
        # Save to cache
        save_to_cache(url, data)
        
        return jsonify({
            'status': 'success',
            'message': 'Article saved to staging (cache). Ready to publish.',
            'article_id': get_article_id(url)
        })
        
    except Exception as e:
        print(f"❌ [Save Staging] Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/skip', methods=['POST'])
def skip():
    """Skip article - uses unified pipeline."""
    from src.pipeline import mark_skipped
    
    data = request.json
    url = data.get('url')
    reason = data.get('reason', 'manual_skip')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    result = mark_skipped(url, reason)
    return jsonify({'status': 'success', **result})

@app.route('/api/check_quality', methods=['POST'])
def check_quality():
    data = request.json
    urls = data.get('urls', [])
    
    if not urls:
        return jsonify([])
        
    async def check_urls(url_list):
        import aiohttp
        results = []
        async with aiohttp.ClientSession() as session:
            for url in url_list:
                try:
                    # Fast check: just get headers or small body
                    # But we need body length for "invalid content" check
                    # Use a short timeout
                    async with session.get(url, timeout=5, ssl=False) as response:
                        if response.status != 200:
                            results.append({'url': url, 'status': 'invalid'})
                            continue
                        
                        # Read first 10KB to check if it's empty
                        content = await response.content.read(10240) 
                        text = content.decode('utf-8', errors='ignore')
                        
                        # Very basic heuristic: if body text is too short
                        # This is rough because we are reading raw HTML
                        if len(text) < 500: 
                             results.append({'url': url, 'status': 'invalid'})
                        else:
                             results.append({'url': url, 'status': 'valid'})
                except Exception:
                    results.append({'url': url, 'status': 'invalid'})
        return results

    try:
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500



def _calculate_scores(data):
    """
    Helper function to calculate ZeroEcho Score and Impact Score.
    Delegates to score_engine.process_raw_analysis for Single Source of Truth.
    
    Supports V1.0, V0.9, and Legacy schemas.
    """
    from src.score_engine import process_raw_analysis
    
    # Use score_engine as the single source of truth
    result = process_raw_analysis(data)
    
    if not result:
        # Fallback for completely empty/invalid data
        return {
            'zs_final': 5.0,
            'zs_raw': 5.0,
            'impact_score': 0.0,
            'breakdown': {'schema': 'Unknown', 'error': 'No valid data'}
        }
    
    # Map score_engine result to expected format for verify_score API
    schema = result.get('schema_version', 'Unknown')
    
    # Build breakdown based on schema version
    if schema == 'V1.0':
        # V1.0 breakdown
        impact_evidence = result.get('impact_evidence', {})
        evidence = result.get('evidence', {})
        
        breakdown = {
            'schema': 'V1.0',
            'is_components': impact_evidence.get('calculations', {}),
            'zes_metrics': evidence.get('breakdown', {}),
            'zs_clamped': result.get('zero_echo_score', 5.0),
            'impact_calc': result.get('impact_score', 0.0)
        }
    elif schema == 'V0.9':
        # V0.9 breakdown
        impact_evidence = result.get('impact_evidence', {})
        evidence = result.get('evidence', {})
        
        breakdown = {
            'schema': 'V0.9',
            'is_components': impact_evidence.get('scores', {}),
            'zes_vector': {
                'base': 5.0,
                'positive': evidence.get('score_vector', {}).get('Positive_Scores', []),
                'negative': evidence.get('score_vector', {}).get('Negative_Scores', [])
            },
            'zs_clamped': result.get('zero_echo_score', 5.0),
            'impact_calc': result.get('impact_score', 0.0)
        }
    else:
        # Legacy breakdown
        evidence = result.get('evidence', {})
        impact_evidence = result.get('impact_evidence', {})
        
        breakdown = {
            'schema': 'Legacy',
            'base': 5.0,
            'credits': evidence.get('credits', []),
            'penalties': evidence.get('penalties', []),
            'modifiers': evidence.get('modifiers', []),
            'zs_clamped': result.get('zero_echo_score', 5.0),
            'impact_calc': result.get('impact_score', 0.0)
        }
    
    return {
        'zs_final': result.get('zero_echo_score', 5.0),
        'zs_raw': result.get('zero_echo_score', 5.0),
        'impact_score': result.get('impact_score', 0.0),
        'breakdown': breakdown
    }

@app.route('/api/verify_score', methods=['POST'])
def verify_score():
    data = normalize_field_names(request.json)
    try:
        calc_result = _calculate_scores(data)
        
        calculated_zs = calc_result['zs_final']
        calculated_impact = calc_result['impact_score']
        breakdown = calc_result['breakdown']
        
        # ZS Check
        recorded_zs = float(data.get('zero_echo_score', 0))
        diff = abs(recorded_zs - calculated_zs)
        is_match = (diff <= 0.1)
        
        # Impact Check
        recorded_impact = float(data.get('impact_score', 0))
        impact_diff = abs(recorded_impact - calculated_impact)
        impact_match = (impact_diff <= 0.1)
        
        # Add rec info to breakdown for UI
        breakdown['impact_rec'] = recorded_impact
        breakdown['impact_diff'] = impact_diff
        
        debug_info = {
            'calculated_zs': calculated_zs,
            'recorded_zs': recorded_zs,
            'diff': f"{diff:.2f}",
            'Impact Calc': calculated_impact,
            'Impact Rec': recorded_impact
        }
        
        return jsonify({
            'match': is_match,
            'impact_match': impact_match,
            'calculated_zs': calculated_zs,
            'diff': diff,
            'debug': debug_info,
            'breakdown': breakdown,
            'message': 'Score Match' if is_match else f'Mismatch! Calc: {calculated_zs} vs Rec: {recorded_zs}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inject_correction', methods=['POST'])
def inject_correction():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    try:
        # [NEW] Recalculate scores based on valid evidence
        scores = _calculate_scores(data)
        
        # Update data with calculated scores
        data['zero_echo_score'] = scores['zs_final']
        data['impact_score'] = scores['impact_score']

        # [REMOVED] 노이즈 필터링 제거 - 모든 기사 저장 가능
        # 점수와 무관하게 사용자가 직접 판단

        # [NEW] Force update date to NOW (execution time) so it saves in today's folder
        now_utc = datetime.now(timezone.utc)
        data['crawled_at'] = now_utc.isoformat()
        
        success, message = db.inject_correction_with_backup(data, url)
        
        # [NEW] Update Manifest
        try:
            # Extract date from crawled_at or use current date if needed
            # crawled_at format: "2025-12-09T..."
            crawled_at = data.get('crawled_at')
            if crawled_at:
                date_str = crawled_at.split('T')[0]
                update_manifest(date_str)
        except Exception as e:
            print(f"Warning: Failed to update manifest after injection: {e}")
        
        if success:
            return jsonify({
                'status': 'success', 
                'message': f"{message} (ZS updated to {scores['zs_final']}, Impact to {scores['impact_score']})",
                'new_scores': scores
            })
        else:
            return jsonify({'error': message}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/worthless', methods=['POST'])
def mark_worthless():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    try:
        db.save_history(url, 'WORTHLESS', reason='manual_worthless')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/refresh', methods=['POST'])
def refresh_article():
    """Reset article to NEW state - clear cache and history."""
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    try:
        # 1. Delete from cache - search ALL date folders
        url_hash = get_url_hash(url)
        deleted_count = 0
        
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                
                cache_file = os.path.join(date_path, f'{url_hash}.json')
                if os.path.exists(cache_file):
                    os.remove(cache_file)
                    deleted_count += 1
                    print(f"🗑️ [Refresh] Deleted cache: {cache_file}")
        
        if deleted_count == 0:
            print(f"⚠️ [Refresh] No cache found for URL hash: {url_hash}")
        
        # 2. Remove from history (reset to NEW)
        db.remove_from_history(url)
        print(f"🔄 [Refresh] Removed from history: {url}")
        
        return jsonify({'status': 'success', 'message': f'Article reset to NEW state (deleted {deleted_count} cache files)'})
    except Exception as e:
        print(f"❌ [Refresh] Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/reload_history', methods=['POST'])
def reload_server_history():
    try:
        db.reload_history()
        return jsonify({'status': 'success', 'message': 'History reloaded from disk'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/find_duplicate_data')
def find_duplicate_data():
    """Find duplicate DATA files (processed articles) by URL."""
    try:
        url_to_files = {}
        
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                date_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json') or filename in ['daily_summary.json', 'index.json']:
                        continue
                    
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            url = data.get('url', '')
                            if url:
                                norm_url = _normalize_url_for_dedupe(url)
                                if norm_url not in url_to_files:
                                    url_to_files[norm_url] = []
                                url_to_files[norm_url].append({
                                    'filename': filename,
                                    'date': date_folder,
                                    'path': filepath,
                                    'crawled_at': data.get('crawled_at', ''),
                                    'title': data.get('title_ko', data.get('title', '')),
                                    'original_url': url
                                })
                    except:
                        pass
        
        # Filter to only URLs with duplicates
        duplicates = {url: files for url, files in url_to_files.items() if len(files) > 1}
        
        # Sort files within each duplicate group by crawled_at (keep newest)
        for _, files in duplicates.items():
            files.sort(key=lambda x: x.get('crawled_at', ''), reverse=True)
            
        return jsonify({
            'duplicates': duplicates,
            'total_duplicate_urls': len(duplicates),
            'total_duplicate_files': sum(len(f) - 1 for f in duplicates.values())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cleanup_duplicate_data', methods=['POST'])
def cleanup_duplicate_data():
    """
    Delete duplicate DATA files.
    Priority to keep:
    1. Data file with article_id matching the current CACHE.
    2. If no cache match (or cache missing), keep the newest file (crawled_at).
    Delete all others in the group.
    """
    try:
        deleted_count = 0
        dates_affected = set()
        
        # Scan for duplicates again
        url_to_files = {}
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                date_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json') or filename in ['daily_summary.json', 'index.json']:
                        continue
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            url = data.get('url', '')
                            if url:
                                norm_url = _normalize_url_for_dedupe(url)
                                if norm_url not in url_to_files:
                                    url_to_files[norm_url] = []
                                url_to_files[norm_url].append({
                                    'filename': filename,
                                    'path': filepath,
                                    'crawled_at': data.get('crawled_at', ''),
                                    'date': date_folder,
                                    'original_url': url,
                                    'article_id': data.get('article_id')
                                })
                    except:
                        pass

        # Cleanup
        for norm_url, files in url_to_files.items():
            if len(files) > 1:
                # Get current cache info for this URL (using the first original_url as representative)
                # Note: original_url might differ slightly (http vs https), but load_from_cache uses exact URL hash.
                # Ideally we try to find cache for ANY of the original URLs in the group? 
                # Or just the first one? Users said "same URL".
                # Let's try to find cache for the most likely URL (e.g. https).
                # But actually, `load_from_cache` expects the exact URL string used to generate hash.
                # Let's stick to the URL from the newest file as the "canonical" one to check cache.
                
                # Pre-sort by newest to pick a good candidate for cache check
                files.sort(key=lambda x: x.get('crawled_at', ''), reverse=True)
                candidate_url = files[0]['original_url']
                
                cached_data = load_from_cache(candidate_url)
                cached_article_id = cached_data.get('article_id') if cached_data else None
                
                # Custom Sort Function
                def priority_sort(file_info):
                    # 1. Match Cache (Strongest)
                    is_cache_match = (file_info.get('article_id') == cached_article_id) and (cached_article_id is not None) and (file_info.get('article_id') is not None)
                    
                    # 2. Has Article ID (Completeness)
                    # If cache is missing, we still prefer a file that HAS an ID over one that might be corrupt/missing it
                    has_article_id = (file_info.get('article_id') is not None) and (file_info.get('article_id') != "")
                    
                    # 3. Timestamp (Recency)
                    timestamp = file_info.get('crawled_at', '')
                    
                    # Sort tuple: (True, True, "2025...") > (False, True, "2024...")
                    return (is_cache_match, has_article_id, timestamp)

                # Sort descending (True first, Newest first)
                files.sort(key=priority_sort, reverse=True)
                
                # Debug log
                winner = files[0]
                is_winner_match = (winner.get('article_id') == cached_article_id) and (cached_article_id is not None)
                print(f"🔍 [Data Cleanup] Group: {norm_url}")
                print(f"   Cache ID: {cached_article_id}")
                print(f"   Winner: {winner['filename']} (ID: {winner.get('article_id')}, Match: {is_winner_match})")
                
                # Delete all except the first (Winner)
                # This satisfies "1. 모든 URL 중 한개는 무조건 남겨야 한다." because we slice [1:]
                for file_info in files[1:]:
                    try:
                        os.remove(file_info['path'])
                        deleted_count += 1
                        dates_affected.add(file_info['date'])
                        reason = []
                        if is_winner_match: reason.append("Mismatch Cache")
                        elif not file_info.get('article_id'): reason.append("No ID")
                        reason.append("Older")
                        
                        print(f"🗑️ [Data Cleanup] Deleted: {os.path.basename(file_info['path'])} ({', '.join(reason)})")
                    except Exception as e:
                        print(f"⚠️ [Data Cleanup] Failed to delete: {file_info['path']} - {e}")

        # Update Manifest/Summary for affected dates
        for date_str in dates_affected:
            try:
                update_manifest(date_str)
            except:
                pass

        return jsonify({
            'status': 'success',
            'deleted_count': deleted_count,
            'message': f'Deleted {deleted_count} duplicate data files'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==============================================================================
# 자동화 파이프라인 API (5단계 + ALL)
# ==============================================================================

# [REMOVED] CACHE_DIR = ... - 이제 cache가 조판 역할도 수행


@app.route('/api/automation/collect', methods=['POST'])
def automation_collect():
    """
    1️⃣ 링크 수집: 모든 활성 타겟에서 새 링크 수집
    - 히스토리에 없는 링크만 반환
    """
    try:
        targets = load_targets()
        all_links = []
        
        for target in targets:
            links = fetch_links(target)
            limit = target.get('limit', 5)
            links = links[:limit]
            
            for link in links:
                # 히스토리 체크 (이미 처리된 것 제외)
                if not db.check_history(link):
                    all_links.append({
                        'url': link,
                        'source_id': target['id'],
                        'target_name': target.get('name', target['id'])
                    })
        
        # 중복 제거
        seen = set()
        unique_links = []
        for item in all_links:
            if item['url'] not in seen:
                seen.add(item['url'])
                unique_links.append(item)
        
        print(f"📡 [Collect] 수집 완료: {len(unique_links)} 새 링크")
        return jsonify({
            'success': True,
            'links': unique_links,
            'total': len(unique_links),
            'message': f'{len(unique_links)}개 새 링크 수집 완료'
        })
    except Exception as e:
        print(f"❌ [Collect] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/automation/extract', methods=['POST'])
def automation_extract():
    """
    2️⃣ 콘텐츠 추출: 수집된 링크 → 캐시 저장
    - 이미 캐시된 것은 건너뜀
    """
    try:
        data = request.json or {}
        # 링크 목록이 없으면 자동 수집
        links = data.get('links')
        
        if not links:
            # 자동으로 collect 먼저 실행
            targets = load_targets()
            links = []
            for target in targets:
                fetched = fetch_links(target)[:target.get('limit', 5)]
                for url in fetched:
                    if not db.check_history(url):
                        links.append({'url': url, 'source_id': target['id']})
        
        extracted_count = 0
        skipped_count = 0
        failed_count = 0
        
        async def extract_all():
            nonlocal extracted_count, skipped_count, failed_count
            crawler = AsyncCrawler(use_playwright=True)
            try:
                await crawler.start()
                for item in links:
                    url = item['url'] if isinstance(item, dict) else item
                    source_id = item.get('source_id', 'unknown') if isinstance(item, dict) else 'unknown'
                    
                    # 캐시 체크
                    cached = load_from_cache(url)
                    if cached and cached.get('text'):
                        skipped_count += 1
                        continue
                    
                    try:
                        content = await crawler.process_url(url)
                        if content and len(content.get('text', '')) >= 200:
                            content['source_id'] = source_id
                            save_to_cache(url, content)
                            extracted_count += 1
                        else:
                            failed_count += 1
                    except Exception as e:
                        print(f"⚠️ [Extract] Failed: {url[:50]}... - {e}")
                        failed_count += 1
            finally:
                await crawler.close()
        
        asyncio.run(extract_all())
        
        print(f"📥 [Extract] 추출: {extracted_count}, 스킵: {skipped_count}, 실패: {failed_count}")
        return jsonify({
            'success': True,
            'extracted': extracted_count,
            'skipped': skipped_count,
            'failed': failed_count,
            'message': f'추출 {extracted_count}개 완료 (스킵 {skipped_count}, 실패 {failed_count})'
        })
    except Exception as e:
        print(f"❌ [Extract] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/automation/analyze', methods=['POST'])
def automation_analyze():
    """
    3️⃣ MLL 분석: mll_status가 없는 캐시만 분석
    """
    try:
        from src.mll_client import MLLClient
        from src.core_logic import get_config
        
        mll = MLLClient()
        today_str = datetime.now().strftime('%Y-%m-%d')
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        
        analyzed_count = 0
        skipped_count = 0
        failed_count = 0
        
        # 오늘 캐시 폴더 스캔
        if os.path.exists(cache_date_dir):
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    # 이미 분석됨
                    if cache_data.get('mll_status') or cache_data.get('raw_analysis'):
                        skipped_count += 1
                        continue
                    
                    # 본문이 없으면 스킵
                    text = cache_data.get('text', '')
                    if len(text) < 200:
                        skipped_count += 1
                        continue
                    
                    # MLL 분석
                    max_text = get_config('crawler', 'max_text_length_for_analysis', default=3000)
                    truncated_text = text[:max_text]
                    
                    mll_result = mll.analyze_text(truncated_text)
                    
                    if mll_result:
                        # 분석 결과 병합
                        mll_result = normalize_field_names(mll_result)
                        cache_data.update(mll_result)
                        cache_data['mll_status'] = 'analyzed'
                        cache_data['analyzed_at'] = datetime.now(timezone.utc).isoformat()
                        
                        with open(filepath, 'w', encoding='utf-8') as f:
                            json.dump(cache_data, f, ensure_ascii=False, indent=2)
                        
                        analyzed_count += 1
                    else:
                        cache_data['mll_status'] = 'failed'
                        with open(filepath, 'w', encoding='utf-8') as f:
                            json.dump(cache_data, f, ensure_ascii=False, indent=2)
                        failed_count += 1
                        
                except Exception as e:
                    print(f"⚠️ [Analyze] Error on {filename}: {e}")
                    failed_count += 1
        
        print(f"🤖 [Analyze] 분석: {analyzed_count}, 스킵: {skipped_count}, 실패: {failed_count}")
        return jsonify({
            'success': True,
            'analyzed': analyzed_count,
            'skipped': skipped_count,
            'failed': failed_count,
            'message': f'MLL 분석 {analyzed_count}개 완료'
        })
    except Exception as e:
        print(f"❌ [Analyze] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/automation/stage', methods=['POST'])
def automation_stage():
    """
    4️⃣ 조판 (Staging): 분석 완료된 캐시 점수 재검증 및 고노이즈 필터링
    - 이제 cache가 조판 역할을 동시에 수행 (별도 staging 폴더 없음)
    - 점수 재검증 + 고노이즈 자동 거부 처리
    """
    try:
        from src.score_engine import process_raw_analysis
        from datetime import datetime, timedelta
        
        staged_count = 0
        skipped_count = 0
        
        # 최근 3일치 캐시 스캔
        for i in range(3):
            scan_date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            cache_date_dir = os.path.join(CACHE_DIR, scan_date)
            
            if not os.path.exists(cache_date_dir):
                continue

            print(f"🕵️ [Stage] Scanning cache folder: {scan_date}")

            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    # 분석 안 된 것은 스킵
                    is_analyzed = (
                        cache_data.get('mll_status') == 'analyzed' or
                        cache_data.get('raw_analysis') is not None or
                        cache_data.get('zero_echo_score') is not None
                    )
                    if not is_analyzed:
                        skipped_count += 1
                        continue
                    
                    # 이미 processed (staged) 처리된 것은 스킵
                    if cache_data.get('staged'):
                        skipped_count += 1
                        continue
                    
                    # 이미 발행된 것은 스킵
                    if cache_data.get('published'):
                        skipped_count += 1
                        continue

                    # 점수 재검증 (raw_analysis 있으면)
                    updated = False
                    if cache_data.get('raw_analysis'):
                        try:
                            scores = process_raw_analysis(cache_data['raw_analysis'])
                            cache_data['zero_echo_score'] = scores.get('zero_echo_score', 5.0)
                            cache_data['impact_score'] = scores.get('impact_score', 0.0)
                            updated = True
                        except Exception as e:
                            print(f"⚠️ [Stage] Score calc error: {e}")
                    
                    # [REMOVED] 고노이즈 자동 필터링 제거 - 모든 기사 staging에 유지
                    # 사용자가 직접 판단하도록 변경
                    
                    # staged 표시 및 저장
                    cache_data['staged'] = True
                    cache_data['staged_at'] = datetime.now(timezone.utc).isoformat()
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(cache_data, f, ensure_ascii=False, indent=2)
                    
                    staged_count += 1
                    
                except Exception as e:
                    print(f"⚠️ [Stage] Error on {filename}: {e}")
        
        print(f"📋 [Stage] 조판: {staged_count}, 스킵: {skipped_count}")
        return jsonify({
            'success': True,
            'staged': staged_count,
            'skipped': skipped_count,
            'message': f'조판 {staged_count}개 완료 (스킵 {skipped_count}개)'
        })
    except Exception as e:
        print(f"❌ [Stage] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500




@app.route('/api/automation/publish', methods=['POST'])
def automation_publish():
    """
    5️⃣ 발행: cache → data 폴더 파일 생성
    - rejected 아닌 것만 발행
    - 이 시점에 data/ 폴더에 최종 파일이 생성됨
    """

    try:
        from src.pipeline import save_article
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        
        published_count = 0
        skipped_count = 0
        failed_count = 0
        
        if os.path.exists(cache_date_dir):
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        staging_data = json.load(f)
                    
                    # 이미 발행됨
                    if staging_data.get('published'):
                        skipped_count += 1
                        continue
                    
                    # rejected는 스킵
                    if staging_data.get('rejected'):
                        skipped_count += 1
                        continue
                    
                    # 필수 필드 체크 (title_ko 또는 title 중 하나 필요)
                    required = ['url', 'summary', 'zero_echo_score', 'impact_score']
                    missing = [f for f in required if f not in staging_data]
                    
                    # title 필드 검증 (title_ko 또는 title 중 하나 필요)
                    has_title = staging_data.get('title_ko') or staging_data.get('title')
                    if not has_title:
                        missing.append('title_ko or title')
                    
                    if missing:
                        print(f"⚠️ [Publish] Missing fields {missing}: {filename}")
                        skipped_count += 1
                        continue
                    
                    # 발행 (노이즈 필터링 건너뜀)
                    result = save_article(staging_data, source_id=staging_data.get('source_id'), skip_evaluation=True)
                    
                    if result.get('status') == 'saved':
                        # 발행 완료 표시
                        staging_data['published'] = True
                        staging_data['published_at'] = datetime.now(timezone.utc).isoformat()
                        staging_data['data_file'] = result.get('filename')
                        
                        with open(filepath, 'w', encoding='utf-8') as f:
                            json.dump(staging_data, f, ensure_ascii=False, indent=2)
                        
                        published_count += 1
                    else:
                        failed_count += 1
                        
                except Exception as e:
                    print(f"⚠️ [Publish] Error on {filename}: {e}")
                    failed_count += 1
        
        print(f"🚀 [Publish] 발행: {published_count}, 스킵: {skipped_count}, 실패: {failed_count}")
        return jsonify({
            'success': True,
            'published': published_count,
            'skipped': skipped_count,
            'failed': failed_count,
            'message': f'발행 {published_count}개 완료'
        })
    except Exception as e:
        print(f"❌ [Publish] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/automation/all', methods=['POST'])
def automation_all():
    """
    ⚡ ALL: 1~4단계 연속 실행 (발행 제외)
    """
    try:
        results = {}
        
        # 1. 수집
        with app.test_client() as client:
            resp = client.post('/api/automation/collect')
            results['collect'] = resp.get_json()
        
        # 2. 추출
        with app.test_client() as client:
            resp = client.post('/api/automation/extract', 
                              json={'links': results['collect'].get('links', [])})
            results['extract'] = resp.get_json()
        
        # 3. 분석
        with app.test_client() as client:
            resp = client.post('/api/automation/analyze')
            results['analyze'] = resp.get_json()
        
        # 4. 조판
        with app.test_client() as client:
            resp = client.post('/api/automation/stage')
            results['stage'] = resp.get_json()
        
        print(f"⚡ [ALL] 파이프라인 완료")
        return jsonify({
            'success': True,
            'results': results,
            'message': '1~4단계 파이프라인 완료 (발행 대기중)'
        })
    except Exception as e:
        print(f"❌ [ALL] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/staging')
def staging_preview():
    """Staging 미리보기 페이지"""
    return render_template('staging.html')




@app.route('/api/staging/list')
def staging_list():
    """Cache 폴더의 기사 목록 반환 (조판 UI용) - 분석된 기사만 표시"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        include_published = request.args.get('include_published', 'false').lower() == 'true'
        
        cache_date_dir = os.path.join(CACHE_DIR, date_str)
        # print(f"🕵️ [Staging List] Request Date: {date_str}, Include Pub: {include_published}")
        
        articles = []
        
        if os.path.exists(cache_date_dir):
            from src.score_engine import detect_schema_version, SCHEMA_V1_0, SCHEMA_LEGACY

            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # [NEW] 분석되지 않은 기사는 조판 목록에서 제외
                    is_analyzed = (
                        data.get('mll_status') == 'analyzed' or
                        data.get('raw_analysis') is not None or
                        data.get('zero_echo_score') is not None
                    )
                    if not is_analyzed:
                        continue
                    
                    # [FILTER] 기발행 필터링 (기본적으로 제외)
                    if not include_published and data.get('published'):
                        continue

                    articles.append({
                        'filename': filename,
                        'filepath': filepath,
                        'article_id': data.get('article_id', ''),
                        'url': data.get('url', ''),
                        'title': data.get('title', ''),
                        'title_ko': data.get('title_ko', ''),
                        'summary': data.get('summary', ''),
                        'zero_echo_score': data.get('zero_echo_score'),
                        'impact_score': data.get('impact_score'),
                        'source_id': data.get('source_id', ''),
                        'rejected': data.get('rejected', False),
                        'reject_reason': data.get('reject_reason', ''),
                        'published': data.get('published', False),
                        'publish_id': data.get('publish_id', ''),
                        'edition_name': data.get('edition_name', ''),
                        'staged_at': data.get('staged_at', ''),
                        'dedup_status': data.get('dedup_status'),
                        'category': data.get('category'),
                        'crawled_at': data.get('crawled_at') or data.get('cached_at') or data.get('saved_at') or data.get('staged_at') or datetime.now().isoformat()
                    })
                except Exception as e:
                    print(f"⚠️ [Staging List] Error reading {filename}: {e}")
        
        # 정렬: 대기중 → 발행됨 → 거부됨, 날짜 내림차순
        articles.sort(key=lambda x: (
            2 if not x['published'] and not x['rejected'] else (1 if x['published'] else 0),
            x.get('crawled_at', '')
        ), reverse=True)
        
        return jsonify({
            'date': date_str,
            'articles': articles,
            'total': len(articles)
        })
    except Exception as e:
        print(f"❌ [Staging List] Error: {e}")
        return jsonify({'error': str(e)}), 500




@app.route('/api/staging/recalculate', methods=['POST'])
def automation_stage_recalc():
    """
    ⚡ Cache 폴더의 기사 점수 재계산 (전체 또는 선택)
    """
    try:
        from src.score_engine import process_raw_analysis
        
        data = request.json or {}
        date_str = data.get('date') or request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        target_filenames = data.get('filenames', []) # 선택된 파일만 처리 (없으면 전체)
        schema_version_override = data.get('schema_version') # UI에서 선택한 스키마 버전

        cache_date_dir = os.path.join(CACHE_DIR, date_str)
        
        if not os.path.exists(cache_date_dir):
            return jsonify({'success': False, 'error': 'Cache folder not found'}), 404
            
        count = 0
        errors = 0
        
        # 파일 목록 결정
        if target_filenames:
            files_to_process = target_filenames
        else:
            files_to_process = [f for f in os.listdir(cache_date_dir) if f.endswith('.json')]
            
        for filename in files_to_process:
            filepath = os.path.join(cache_date_dir, filename)
            
            if not os.path.exists(filepath):
                 continue

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    article_data = json.load(f)
                
                # raw_analysis가 있어야만 재계산 가능
                if 'raw_analysis' in article_data and article_data['raw_analysis']:
                    # force_schema_version 전달
                    scores = process_raw_analysis(article_data['raw_analysis'], force_schema_version=schema_version_override)
                    article_data['zero_echo_score'] = scores.get('zero_echo_score', 5.0)
                    article_data['impact_score'] = scores.get('impact_score', 0.0)
                    
                    # 계산에 사용된 스키마 버전 기록 (선택 사항)
                    if 'impact_evidence' not in article_data: article_data['impact_evidence'] = {}
                    if scores.get('schema_version'):
                        article_data['impact_evidence']['schema_version'] = scores['schema_version']
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(article_data, f, ensure_ascii=False, indent=2)
                    count += 1
            except Exception as e:
                print(f"⚠️ Recalc error {filename}: {e}")
                errors += 1
                
        return jsonify({
            'success': True, 
            'message': f"{count}개 기사 점수 재계산 완료 (실패 {errors}건)"
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/reject_selected', methods=['POST'])
def automation_stage_reject_selected():
    """
    🗑️ 선택된 기사 일괄 거부 (Reject)
    """
    try:
        data = request.json or {}
        date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
        filenames = data.get('filenames', [])
        
        if not filenames:
            return jsonify({'success': False, 'error': 'No filenames provided'}), 400
            
        cache_date_dir = os.path.join(CACHE_DIR, date_str)
        count = 0
        
        for filename in filenames:
            filepath = os.path.join(cache_date_dir, filename)
            if not os.path.exists(filepath):
                continue
                
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    article_data = json.load(f)
                
                article_data['rejected'] = True
                article_data['reject_reason'] = 'manual_batch_reject'
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(article_data, f, ensure_ascii=False, indent=2)
                count += 1
            except Exception as e:
                print(f"⚠️ Reject error {filename}: {e}")
                
        return jsonify({
            'success': True,
            'message': f"{count}개 기사 거부 처리 완료"
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/restore_selected', methods=['POST'])
def automation_stage_restore_selected():
    """
    ♻️ 선택된 기사 복구 (Restore rejected articles)
    """
    try:
        data = request.json or {}
        date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
        filenames = data.get('filenames', [])
        
        if not filenames:
            return jsonify({'success': False, 'error': 'No filenames provided'}), 400
            
        cache_date_dir = os.path.join(CACHE_DIR, date_str)
        count = 0
        
        for filename in filenames:
            filepath = os.path.join(cache_date_dir, filename)
            if not os.path.exists(filepath):
                # 다른 날짜에도 있을 수 있으므로 검색
                for date_folder in os.listdir(CACHE_DIR):
                    check_path = os.path.join(CACHE_DIR, date_folder, filename)
                    if os.path.exists(check_path):
                        filepath = check_path
                        break
                        
            if not os.path.exists(filepath):
                continue
                
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    article_data = json.load(f)
                
                # 거부 상태 해제
                article_data['rejected'] = False
                if 'reject_reason' in article_data:
                    del article_data['reject_reason']
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(article_data, f, ensure_ascii=False, indent=2)
                count += 1
                print(f"♻️ [Restore] 복구됨: {filename}")
            except Exception as e:
                print(f"⚠️ Restore error {filename}: {e}")
                
        return jsonify({
            'success': True,
            'message': f"{count}개 기사 복구 완료"
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/file')
def staging_file():
    """특정 Staging 파일 상세 내용 반환"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        filename = request.args.get('filename')
        
        if not filename:
            return jsonify({'error': 'filename is required'}), 400
        
        filepath = os.path.join(CACHE_DIR, date_str, filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/staging/update_categories', methods=['POST'])
def staging_update_categories():
    """카테고리 정보를 모든 날짜 폴더의 캐시에 저장 (보낸 기사만 대상, 크로스 날짜 지원)"""
    try:
        data = request.json or {}
        category_results = data.get('results', [])  # [{ category, article_ids }, ...]
        sent_ids = set(data.get('sent_ids', []))  # LLM에 보낸 기사 ID 목록
        
        # article_id -> category 맵 구축
        category_map = {}
        for group in category_results:
            category = group.get('category', '미분류')
            for article_id in group.get('article_ids', []):
                category_map[article_id] = category
        
        updated_count = 0
        uncategorized_count = 0
        
        # 모든 날짜 폴더 순회 (크로스 날짜 지원)
        if not os.path.exists(CACHE_DIR):
            return jsonify({'success': False, 'error': 'Cache directory not found'}), 404
        
        for date_folder in os.listdir(CACHE_DIR):
            cache_date_dir = os.path.join(CACHE_DIR, date_folder)
            if not os.path.isdir(cache_date_dir):
                continue
            
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        article_data = json.load(f)
                    
                    # filename에서 article_id 추출
                    parts = filename.replace('.json', '').split('_')
                    article_id = parts[-1] if len(parts) > 1 else parts[0]
                    
                    # article.article_id도 확인 (우선순위)
                    stored_article_id = article_data.get('article_id') or article_id
                    
                    # 보낸 기사가 아니면 건너뜀 (sent_ids가 있는 경우에만)
                    # 수정: Positive(카테고리 있음)는 무조건 업데이트, Negative(중복)는 sent_ids에 있을 때만 처리
                    is_in_result = stored_article_id in category_map or article_id in category_map
                    is_in_scope = not sent_ids or (stored_article_id in sent_ids or article_id in sent_ids)
                    
                    if not is_in_result and not is_in_scope:
                        continue
                    
                    # 카테고리 지정
                    if is_in_result:

                        cat = category_map.get(stored_article_id) or category_map.get(article_id, '미분류')
                        article_data['category'] = cat
                        article_data['dedup_status'] = 'selected'
                    else:
                        # LLM에 보냈지만 결과에 없음 = 중복으로 제거됨
                        article_data['dedup_status'] = 'duplicate'
                        uncategorized_count += 1
                    
                    # 캐시 파일 저장
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(article_data, f, ensure_ascii=False, indent=2)
                    
                    updated_count += 1
                    print(f"✅ [Update Category] {filename}: {article_data.get('category')} ({date_folder})")
                    
                except Exception as e:
                    print(f"⚠️ [Update Category] Error on {filename}: {e}")
        
        print(f"📂 [Update Category] 업데이트: {updated_count}개 (미분류/중복: {uncategorized_count}개)")
        return jsonify({
            'success': True,
            'updated': updated_count,
            'uncategorized': uncategorized_count,
            'message': f'{updated_count}개 기사 카테고리 업데이트 완료'
        })
    except Exception as e:
        print(f"❌ [Update Category] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/reset_dedup', methods=['POST'])
def staging_reset_dedup():
    """모든 staging 파일의 dedup_status와 category 초기화"""
    try:
        data = request.json or {}
        date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
        
        cache_date_dir = os.path.join(CACHE_DIR, date_str)
        
        if not os.path.exists(cache_date_dir):
            return jsonify({'success': False, 'error': 'Staging folder not found'}), 404
        
        reset_count = 0
        
        for filename in os.listdir(cache_date_dir):
            if not filename.endswith('.json'):
                continue
            
            filepath = os.path.join(cache_date_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    article_data = json.load(f)
                
                # dedup_status와 category 초기화
                if 'dedup_status' in article_data:
                    del article_data['dedup_status']
                if 'category' in article_data:
                    del article_data['category']
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(article_data, f, ensure_ascii=False, indent=2)
                
                reset_count += 1
                
            except Exception as e:
                print(f"⚠️ [Reset Dedup] Error on {filename}: {e}")
        
        print(f"🔄 [Reset Dedup] {reset_count}개 파일 초기화 완료")
        return jsonify({
            'success': True,
            'reset': reset_count,
            'message': f'{reset_count}개 기사 중복 상태 초기화 완료'
        })
    except Exception as e:
        print(f"❌ [Reset Dedup] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/delete_legacy', methods=['POST'])
def staging_delete_legacy():
    """LEGACY_CALL article_id를 가진 staging 파일 및 캐시 삭제"""
    try:
        deleted_staging = 0
        deleted_cache = 0
        
        # Staging 폴더 순회
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        article_id = data.get('article_id', '')
                        if article_id == 'LEGACY_CALL' or 'LEGACY' in article_id:
                            os.remove(filepath)
                            deleted_staging += 1
                            print(f"🗑️ [Delete Legacy] Deleted staging: {filepath}")
                    except Exception as e:
                        print(f"⚠️ [Delete Legacy] Error on {filename}: {e}")
        
        # Cache 폴더 순회
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    
                    filepath = os.path.join(date_path, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        article_id = data.get('article_id', '')
                        if article_id == 'LEGACY_CALL' or 'LEGACY' in article_id:
                            os.remove(filepath)
                            deleted_cache += 1
                            print(f"🗑️ [Delete Legacy] Deleted cache: {filepath}")
                    except Exception as e:
                        print(f"⚠️ [Delete Legacy] Error on {filename}: {e}")
        
        total = deleted_staging + deleted_cache
        print(f"🗑️ [Delete Legacy] 삭제 완료: staging {deleted_staging}개, cache {deleted_cache}개")
        return jsonify({
            'success': True,
            'deleted_staging': deleted_staging,
            'deleted_cache': deleted_cache,
            'message': f'LEGACY_CALL 삭제 완료: staging {deleted_staging}개, cache {deleted_cache}개'
        })
    except Exception as e:
        print(f"❌ [Delete Legacy] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/delete_file', methods=['POST'])
def staging_delete_file():
    """staging 파일 완전 삭제"""
    try:
        data = request.json or {}
        filename = data.get('filename')
        date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
        
        if not filename:
            return jsonify({'success': False, 'error': 'filename required'})
        
        deleted = False
        
        # Staging 폴더에서 삭제
        staging_file = os.path.join(CACHE_DIR, date_str, filename)
        if os.path.exists(staging_file):
            os.remove(staging_file)
            deleted = True
            print(f"🗑️ [Delete File] Deleted staging: {staging_file}")
        
        # 다른 날짜에도 있을 수 있으므로 검색
        if not deleted:
            for date_folder in os.listdir(CACHE_DIR):
                check_path = os.path.join(CACHE_DIR, date_folder, filename)
                if os.path.exists(check_path):
                    os.remove(check_path)
                    deleted = True
                    print(f"🗑️ [Delete File] Deleted staging: {check_path}")
                    break
        
        if deleted:
            return jsonify({'success': True, 'message': f'{filename} 삭제 완료'})
        else:
            return jsonify({'success': False, 'error': f'{filename} 파일을 찾을 수 없습니다'})
    
    except Exception as e:
        print(f"❌ [Delete File] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/clear_cache', methods=['POST'])
def staging_clear_cache():
    """날짜별 캐시 삭제"""
    try:
        data = request.json or {}
        date_str = data.get('date')
        
        if not date_str:
            return jsonify({'success': False, 'error': 'date required'})
        
        deleted_count = 0
        
        # Cache 폴더에서 해당 날짜 폴더 삭제
        cache_date_path = os.path.join(CACHE_DIR, date_str)
        if os.path.exists(cache_date_path) and os.path.isdir(cache_date_path):
            import shutil
            file_count = len([f for f in os.listdir(cache_date_path) if f.endswith('.json')])
            shutil.rmtree(cache_date_path)
            deleted_count = file_count
            print(f"🧹 [Clear Cache] Deleted cache folder: {cache_date_path} ({file_count} files)")
        
        if deleted_count > 0:
            return jsonify({'success': True, 'message': f'{date_str} 캐시 {deleted_count}개 파일 삭제 완료'})
        else:
            return jsonify({'success': True, 'message': f'{date_str} 캐시가 없거나 이미 삭제됨'})
    
    except Exception as e:
        print(f"❌ [Clear Cache] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/publish_selected', methods=['POST'])
def staging_publish_selected():
    """선택된 Staging 파일만 발행 (New or Append to Issue)"""
    try:
        from src.pipeline import save_article
        from src.pipeline import get_db
        db = get_db()
        
        data = request.json or {}
        filenames = data.get('filenames', [])
        mode = data.get('mode', 'new') # 'new' or 'append'
        target_publish_id = data.get('target_publish_id')
        
        if not filenames:
            return jsonify({'success': False, 'error': '선택된 파일이 없습니다.'}), 400
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        
        # 1. Prepare Edition Info
        edition_code = ""
        edition_name = ""
        publish_id = ""
        
        if mode == 'new':
            # Generate new edition code
            # Get today's issues to determine next index
            issues = db.get_issues_by_date(today_str)
            
            # Simple logic: count today's issues + 1
            # But issues might not be from today if get_issues_by_date returns all without filter?
            # get_issues_by_date in db_client filters by date if date_str provided.
            # Assuming it returns sorted desc.
            if issues:
                last_code = issues[0].get('edition_code', '')
                try:
                    last_idx = int(last_code.split('_')[-1])
                    next_idx = last_idx + 1
                except:
                    next_idx = len(issues) + 1
            else:
                next_idx = 1
                
            yy = today_str[2:4]
            mm = today_str[5:7]
            dd = today_str[8:10]
            edition_code = f"{yy}{mm}{dd}_{next_idx}"
            edition_name = f"{int(mm)}/{int(dd)} {next_idx}차 발행"
            
            # Create Record
            pub_data = {
                'edition_code': edition_code,
                'edition_name': edition_name,
                'article_count': 0,
                'articles': [],
                'published_at': datetime.now(timezone.utc).isoformat(),
                'date': today_str,
                'status': 'preview'  # 2단계 발행: 기본값 preview
            }
            publish_id = db.create_publication_record(pub_data)
            if not publish_id:
                return jsonify({'success': False, 'error': 'Failed to create publication record'}), 500
        
        elif mode == 'append':
            if not target_publish_id:
                return jsonify({'success': False, 'error': 'Target publish ID required for append mode'}), 400
            
            publish_id = target_publish_id
            pub_record = db.get_publication(publish_id)
            if not pub_record:
                return jsonify({'success': False, 'error': 'Target publication not found'}), 404
            
            edition_code = pub_record.get('edition_code')
            edition_name = pub_record.get('edition_name')
        
        # 2. Process Articles
        published_count = 0
        failed_count = 0
        published_articles_meta = [] # For index file
        
        for filename in filenames:
            # Try to find file in today's folder, or check other folders?
            # Typically user selects from a list that implies a path. 
            # If filenames includes path relative to cache, use it. 
            # If just filename, try today's cache.
            
            filepath = os.path.join(cache_date_dir, filename)
            if not os.path.exists(filepath):
                 # Search in other folders if not found
                 found = False
                 for d in os.listdir(CACHE_DIR):
                     check_path = os.path.join(CACHE_DIR, d, filename)
                     if os.path.exists(check_path):
                         filepath = check_path
                         found = True
                         break
                 if not found:
                     print(f"⚠️ [Publish] File not found: {filename}")
                     failed_count += 1
                     continue
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    staging_data = json.load(f)
                
                # Check required fields... (Simplified for now, trusting previous logic)
                
                # Update Metadata
                staging_data['publish_id'] = publish_id
                staging_data['edition_code'] = edition_code
                staging_data['edition_name'] = edition_name
                
                # Publish
                result = save_article(staging_data, source_id=staging_data.get('source_id'), skip_evaluation=True)
                
                if result.get('status') == 'saved':
                    staging_data['published'] = True
                    staging_data['published_at'] = datetime.now(timezone.utc).isoformat()
                    staging_data['data_file'] = result.get('filename')
                    
                    # Update Cache
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(staging_data, f, ensure_ascii=False, indent=2)
                    
                    published_count += 1
                    
                    published_articles_meta.append({
                        'id': result.get('article_id', staging_data.get('article_id')),
                        'title': staging_data.get('title_ko') or staging_data.get('title'),
                        'url': staging_data.get('url'),
                        'filename': result.get('filename'),
                        'date': result.get('date') # Store source folder date
                    })
                    print(f"✅ [Publish] {filename} -> {edition_name}")
                else:
                    failed_count += 1
                    
            except Exception as e:
                print(f"⚠️ [Publish] Error on {filename}: {e}")
                failed_count += 1
        
        # 3. Update Index File
        # We need full list of articles for this issue. 
        # If append, we need to get existing list.
        # But save_issue_index_file overwrites. 
        # We should fetch current list from DB or recreating it?
        # Let's rely on DB record if append.
        
        final_article_list = published_articles_meta
        if mode == 'append':
             # Get existing articles from DB record to merge?
             # Or just trust that we can rebuild it?
             # Let's fetch existing
             current_record = db.get_publication(publish_id)
             existing_list = current_record.get('articles', [])
             final_article_list = existing_list + published_articles_meta
        
        # Create Index Data
        index_data = {
            'id': publish_id,
            'edition_code': edition_code,
            'edition_name': edition_name,
            'published_at': datetime.now(timezone.utc).isoformat(),
            'date': today_str,
            'article_count': len(final_article_list),
            'articles': final_article_list
        }
        
        # Save Index File
        db.save_issue_index_file(index_data)
        
        # Update DB Record
        db.update_publication_record(publish_id, {
            'article_count': len(final_article_list),
            'articles': final_article_list,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
        print(f"🚀 [Publish] Completed. {published_count} published to {edition_name}")
        return jsonify({
            'success': True,
            'published': published_count,
            'failed': failed_count,
            'publish_id': publish_id,
            'edition_name': edition_name,
            'message': f'{published_count}개 기사 발행 완료 ({edition_name})'
        })
    except Exception as e:
        print(f"❌ [Publish] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==============================================================================
# Publications API
# ==============================================================================

@app.route('/api/publications/list')
def publications_list():
    """발행 회차 목록 반환 (status 필터 지원)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        date_str = request.args.get('date')  # Optional filter
        status_filter = request.args.get('status')  # 'preview', 'released', or None (all)
        
        issues = db.get_issues_by_date(date_str)
        
        # status 필터 적용
        if status_filter:
            issues = [i for i in issues if i.get('status') == status_filter]
        
        return jsonify({
            'success': True,
            'issues': issues
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/publications/release', methods=['POST'])
def publications_release():
    """Preview 상태의 회차를 Released로 변경 (2단계 발행)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        data = request.json or {}
        publish_id = data.get('publish_id')
        
        if not publish_id:
            return jsonify({'success': False, 'error': 'publish_id required'}), 400
        
        record = db.get_publication(publish_id)
        if not record:
            return jsonify({'success': False, 'error': 'Publication not found'}), 404
        
        # Release 상태로 업데이트
        update_data = {
            'status': 'released',
            'released_at': datetime.now(timezone.utc).isoformat()
        }
        
        success = db.update_publication_record(publish_id, update_data)
        
        if success:
            print(f"🎉 [Release] {record.get('edition_name')} → Released")
            return jsonify({
                'success': True,
                'publish_id': publish_id,
                'edition_name': record.get('edition_name'),
                'message': f"{record.get('edition_name')} 릴리즈 완료"
            })
        else:
            return jsonify({'success': False, 'error': 'Update failed'}), 500
            
    except Exception as e:
        print(f"❌ [Release] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/publications/view')
def publications_view():
    """특정 발행 회차의 기사 목록 반환 (인덱스 파일 또는 DB 기반)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        publish_id = request.args.get('publish_id')
        if not publish_id:
            return jsonify({'success': False, 'error': 'publish_id required'}), 400
            
        record = db.get_publication(publish_id)
        if not record:
            return jsonify({'success': False, 'error': 'Publication not found'}), 404
            
        # Return articles list from the record
        # Note: These are simplified metadata. If UI needs full content, 
        # it might need to fetch individual files or we assume metadata is enough for list.
        # Typically UI needs: title, summary, score, url, tags...
        # The 'articles' in record currently only has {id, title, url, filename}.
        # For full view, we might need to Read the Data Files.
        
        # Let's try to load the full data from the data files listed in 'articles'.
        full_articles = []
        pub_date_str = record.get('date', '')
        if not pub_date_str and record.get('published_at'):
             pub_date_str = record.get('published_at').split('T')[0]
             
        for item in record.get('articles', []):
            filename = item.get('filename')
            # Use article's specific date if available, else publication date
            art_date = item.get('date') or pub_date_str
            
            if filename:
                 data_dir = os.path.join(DATA_DIR, art_date)
                 filepath = os.path.join(data_dir, filename)
                 if os.path.exists(filepath):
                     try:
                         with open(filepath, 'r', encoding='utf-8') as f:
                             art_data = json.load(f)
                             full_articles.append(art_data)
                     except:
                         full_articles.append(item) # Fallback
                 else:
                     full_articles.append(item) # Fallback: return meta even if file missing
            else:
                full_articles.append(item)

        return jsonify({
            'success': True,
            'publication': record,
            'articles': full_articles
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/publications/move_articles', methods=['POST'])
def publications_move_articles():
    """선택된 기사들을 특정 회차로 이동 (이미 발행된 기사 이동 or Staging->Published)"""
    # This might reuse logic from publish_selected but specifically for existing items.
    # For now, let's treat it as 'Append' calling publish_selected if they are from Staging.
    # If they are already published, we need 'Unpublish from Old' + 'Publish to New'.
    return jsonify({'success': False, 'error': 'Not implemented yet (Use Publish -> Append for Staging items)'}), 501


@app.route('/api/staging/restore_selected', methods=['POST'])
def staging_restore_selected():
    """거부된 기사 복구 (rejected=false로 변경)"""
    try:
        data = request.json or {}
        filenames = data.get('filenames', [])
        
        if not filenames:
            return jsonify({'success': False, 'error': '복구할 파일이 없습니다.'}), 400
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        restored_count = 0
        failed_count = 0
        
        for filename in filenames:
            # Search in today and recent date folders
            found = False
            for d in os.listdir(CACHE_DIR):
                cache_path = os.path.join(CACHE_DIR, d, filename)
                if os.path.exists(cache_path):
                    try:
                        with open(cache_path, 'r', encoding='utf-8') as f:
                            article = json.load(f)
                        
                        # Remove rejected flag
                        article['rejected'] = False
                        article.pop('reject_reason', None)
                        article.pop('rejected_at', None)
                        
                        with open(cache_path, 'w', encoding='utf-8') as f:
                            json.dump(article, f, ensure_ascii=False, indent=2)
                        
                        restored_count += 1
                        found = True
                        print(f"✅ [Restore] {filename} 복구 완료")
                        break
                    except Exception as e:
                        print(f"⚠️ [Restore] Error restoring {filename}: {e}")
                        failed_count += 1
                        found = True
                        break
            
            if not found:
                print(f"⚠️ [Restore] File not found: {filename}")
                failed_count += 1
        
        return jsonify({
            'success': True,
            'restored': restored_count,
            'failed': failed_count,
            'message': f'{restored_count}개 기사 복구 완료'
        })
    except Exception as e:
        print(f"❌ [Restore] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/delete_from_db', methods=['POST'])
def staging_delete_from_db():
    """🔥 Firestore DB에서 선택된 기사 삭제 (로컬 파일은 유지)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        data = request.json or {}
        articles = data.get('articles', [])  # [{filename, url, article_id}, ...]
        
        if not articles:
            return jsonify({'success': False, 'error': '삭제할 기사가 없습니다.'}), 400
        
        deleted_count = 0
        failed_count = 0
        
        for article in articles:
            url = article.get('url', '')
            article_id = article.get('article_id', '')
            
            try:
                # Delete from Firestore using URL-based ID
                if url:
                    from src.core_logic import get_article_id
                    doc_id = get_article_id(url)
                    
                    doc_ref = db.db.collection('articles').document(doc_id)
                    doc = doc_ref.get()
                    
                    if doc.exists:
                        doc_ref.delete()
                        deleted_count += 1
                        print(f"🔥 [DB Delete] Deleted from Firestore: {doc_id}")
                    else:
                        print(f"⚠️ [DB Delete] Not found in Firestore: {doc_id}")
                        failed_count += 1
                else:
                    print(f"⚠️ [DB Delete] No URL provided for article")
                    failed_count += 1
                    
            except Exception as e:
                print(f"⚠️ [DB Delete] Error deleting article: {e}")
                failed_count += 1
        
        return jsonify({
            'success': True,
            'deleted': deleted_count,
            'failed': failed_count,
            'message': f'{deleted_count}개 기사 DB에서 삭제 완료'
        })
    except Exception as e:
        print(f"❌ [DB Delete] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/staging/unpublish_selected', methods=['POST'])
def staging_unpublish_selected():
    """
    🔄 발행 취소: 데이터 파일 삭제 + 캐시 상태 리셋
    - data/ 폴더의 발행 파일 삭제
    - cache 파일에서 published, data_file 상태 제거
    - Firestore에서도 삭제 (선택적)
    """
    try:
        data = request.json or {}
        filenames = data.get('filenames', [])  # cache 파일명 목록
        delete_firestore = data.get('delete_firestore', False)
        
        if not filenames:
            return jsonify({'success': False, 'error': '선택된 파일이 없습니다.'}), 400
        
        unpublished_count = 0
        failed_count = 0
        
        for filename in filenames:
            try:
                # 캐시 파일 찾기 (모든 날짜 폴더에서)
                cache_filepath = None
                cache_data = None
                
                for date_folder in os.listdir(CACHE_DIR):
                    check_path = os.path.join(CACHE_DIR, date_folder, filename)
                    if os.path.exists(check_path):
                        cache_filepath = check_path
                        break
                
                if not cache_filepath:
                    print(f"⚠️ [Unpublish] Cache not found: {filename}")
                    failed_count += 1
                    continue
                
                # 캐시 파일 읽기
                with open(cache_filepath, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                # 발행되지 않은 파일은 스킵
                if not cache_data.get('published'):
                    continue
                
                # 1. 데이터 파일 삭제
                data_file = cache_data.get('data_file')
                if data_file:
                    # 모든 날짜 폴더에서 데이터 파일 찾아 삭제
                    for date_folder in os.listdir(DATA_DIR):
                        data_path = os.path.join(DATA_DIR, date_folder, data_file)
                        if os.path.exists(data_path):
                            os.remove(data_path)
                            print(f"🗑️ [Unpublish] Deleted data file: {data_path}")
                            
                            # manifest 업데이트
                            update_manifest(date_folder)
                            break
                
                # 2. Firestore 삭제 (선택적)
                if delete_firestore and cache_data.get('url'):
                    try:
                        # URL로 Firestore 문서 찾아 삭제
                        doc = db.get_article_by_url(cache_data['url'])
                        if doc and doc.get('id'):
                            db.delete_article(doc['id'])
                            print(f"🔥 [Unpublish] Deleted from Firestore: {doc['id']}")
                    except Exception as fs_err:
                        print(f"⚠️ [Unpublish] Firestore delete failed: {fs_err}")
                
                # 3. 캐시 파일 상태 리셋
                cache_data.pop('published', None)
                cache_data.pop('data_file', None)
                cache_data.pop('published_at', None)
                
                with open(cache_filepath, 'w', encoding='utf-8') as f:
                    json.dump(cache_data, f, ensure_ascii=False, indent=2)
                
                # 4. History에서 상태 리셋 (재발행 가능하도록)
                if cache_data.get('url'):
                    db.remove_from_history(cache_data['url'])
                
                unpublished_count += 1
                print(f"✅ [Unpublish] {filename} 발행 취소 완료")
                
            except Exception as e:
                print(f"⚠️ [Unpublish] Error on {filename}: {e}")
                failed_count += 1
        
        print(f"🔄 [Unpublish] 완료: {unpublished_count}개 취소, {failed_count}개 실패")
        return jsonify({
            'success': True,
            'unpublished': unpublished_count,
            'failed': failed_count,
            'message': f'{unpublished_count}개 기사 발행 취소 완료'
        })
    except Exception as e:
        print(f"❌ [Unpublish] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==============================================================================
# Hybrid Batch Processing API
# ==============================================================================

BATCH_DIR = os.path.join(CACHE_DIR, 'batches')

@app.route('/api/batch/list_ready')
def list_ready_batches():
    """List all available batch files in cache/batches."""
    try:
        if not os.path.exists(BATCH_DIR):
            return jsonify({'batches': []})
            
        batches = []
        for filename in os.listdir(BATCH_DIR):
            if not filename.endswith('.json'):
                continue
                
            filepath = os.path.join(BATCH_DIR, filename)
            try:
                # Filename format: {date}_{target}_{id}.json
                stat = os.stat(filepath)
                
                parts = filename.replace('.json', '').split('_')
                date_str = parts[0] if len(parts) > 0 else 'Unknown'
                target_id = parts[1] if len(parts) > 1 else 'Unknown'
                
                with open(filepath, 'r', encoding='utf-8') as f:
                     # Peek at count purely from file load (safer than parsing filename if format varies)
                     data_meta = json.load(f)
                     count = data_meta.get('count', 0)
                
                batches.append({
                    'filename': filename,
                    'date': date_str,
                    'target_id': target_id,
                    'count': count,
                    'size': stat.st_size,
                    'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
            except Exception as e:
                pass
                
        # Sort by date descending
        batches.sort(key=lambda x: x['filename'], reverse=True)
        return jsonify({'batches': batches})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch/get_content')
def get_batch_content():
    """Get the content of a specific batch file."""
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': 'Filename required'}), 400
        
    filepath = os.path.join(BATCH_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # We return the whole wrapper { articles: [...] }
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _find_cache_by_article_id(article_id):
    """
    Search for cache file by article_id in recent cache folders (last 7 days).
    Returns cached_data dict provided it contains the 'url', or None.
    """
    # Search today and past 7 days
    from datetime import datetime, timedelta
    
    for i in range(8):
        date_str = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        date_dir = os.path.join(CACHE_DIR, date_str)
        
        if not os.path.exists(date_dir):
            continue
            
        # Iterate files
        for filename in os.listdir(date_dir):
            if not filename.endswith('.json'):
                continue
                
            filepath = os.path.join(date_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # Check ID match
                if str(data.get('article_id')) == str(article_id):
                    return data
            except:
                continue
    return None

@app.route('/api/batch/inject', methods=['POST'])
def inject_batch_results():
    """
    Inject analyzed results from external process.
    Matches with cache via 'article_id', calculates scores, and saves to data/.
    """
    try:
        results = request.json
        print(f"📥 [Batch Inject] Received Payload Type: {type(results)}")
        
        if not isinstance(results, list):
            print(f"❌ [Batch Inject] Error: Payload is not a list. Got {type(results)}")
            return jsonify({'error': 'Input must be a JSON list'}), 400
            
        print(f"📥 [Batch Inject] Processing {len(results)} items...")
            
        processed_count = 0
        accepted_count = 0
        errors = []
        
        for item in results:
            print(f"🔍 [Batch Inject] Processing Item: Keys={list(item.keys()) if isinstance(item, dict) else 'NotDict'}")
            try:
                article_id = item.get('article_id') or item.get('Article_ID')
                
                if not article_id:
                    errors.append(f"Missing article_id in item: {str(item)[:50]}")
                    continue
                    
                url = item.get('url')
                
                cached_data = None
                if url:
                    cached_data = _core_load_from_cache(url)
                
                # If URL not provided or cache miss, try searching by ID
                if not cached_data:
                    found = _find_cache_by_article_id(article_id)
                    if found:
                        cached_data = found
                        # Ensure we have the URL now
                        if not url: url = cached_data.get('url')
                
                if not cached_data:
                    errors.append(f"Cache not found for {article_id}")
                    continue
                
                # 2. Process & Calculate Scores via ScoreEngine (Single Source of Truth)
                from src.score_engine import process_raw_analysis
                
                # The 'item' is the LLM output (raw_analysis or wrapper)
                # This will handle V1.0 (articles array element) and V0.9 logic
                engine_result = process_raw_analysis(item)
                
                # Merge Engine Results into Cache
                if engine_result:
                    # Basic Fields
                    if 'title_ko' in engine_result: cached_data['title_ko'] = engine_result['title_ko']
                    if 'summary' in engine_result: cached_data['summary'] = engine_result['summary']
                    
                    # Scores (ONLY from Engine)
                    cached_data['zero_echo_score'] = engine_result.get('zero_echo_score', 0.0)
                    cached_data['impact_score'] = engine_result.get('impact_score', 0.0)
                    
                    # Evidence (Important for UI)
                    if 'evidence' in engine_result: cached_data['evidence'] = engine_result['evidence']
                    if 'impact_evidence' in engine_result: cached_data['impact_evidence'] = engine_result['impact_evidence']
                    
                    # Store Raw Analysis for record
                    cached_data['raw_analysis'] = item 
                    
                else:
                    # If Engine fails, we treat it as failure.
                    # DO NOT use LLM provided values directly.
                    errors.append(f"ScoreEngine failed to process item: {article_id}")
                    continue
                    
                # Normalize field names just in case
                cached_data = _core_normalize_field_names(cached_data)
                
                # 3. Save to Staging (노이즈 필터링 없음 - 모든 기사 저장)
                date_folder = datetime.now().strftime('%Y-%m-%d')
                staging_dir = os.path.join(CACHE_DIR, date_folder)
                os.makedirs(staging_dir, exist_ok=True)
                
                filename = get_data_filename(cached_data.get('source_id', 'batch'), cached_data['url'])
                filepath = os.path.join(staging_dir, filename)
                
                # 분석 완료 표시
                cached_data['mll_status'] = 'analyzed'
                cached_data['analyzed_at'] = datetime.now(timezone.utc).isoformat()
                cached_data['staged'] = True
                cached_data['staged_at'] = datetime.now(timezone.utc).isoformat()
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(cached_data, f, ensure_ascii=False, indent=2)
                
                # Update Cache
                _core_save_to_cache(cached_data['url'], cached_data)
                
                processed_count += 1
                accepted_count += 1  # 모든 기사가 staging에 저장됨
                
            except Exception as inner_e:
                errors.append(f"Error processing item: {inner_e}")
        
        return jsonify({
            'status': 'success',
            'processed': processed_count,
            'accepted': accepted_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500



# ==============================================================================
# Batch Management APIs (Typesetting)
# ==============================================================================

@app.route('/api/batch/create', methods=['POST'])
def api_create_batch():
    """Trigger creation of a new batch (Typesetting)."""
    try:
        batch_id, message = create_batch()
        if not batch_id:
            return jsonify({'error': message}), 400
        return jsonify({'status': 'success', 'batch_id': batch_id, 'message': message})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch/list', methods=['GET'])
def api_list_batches():
    """List all batches."""
    try:
        batches = get_batches()
        return jsonify({'batches': batches, 'count': len(batches)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch/publish', methods=['POST'])
def api_publish_batch():
    """Publish a specific batch."""
    data = request.json
    batch_id = data.get('batch_id')
    if not batch_id:
        return jsonify({'error': 'batch_id is required'}), 400
        
    try:
        success, message = publish_batch(batch_id)
        if success:
            return jsonify({'status': 'success', 'message': message})
        else:
            return jsonify({'error': message}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch/discard', methods=['POST'])
def api_discard_batch():
    """Discard a specific batch."""
    data = request.json
    batch_id = data.get('batch_id')
    if not batch_id:
        return jsonify({'error': 'batch_id is required'}), 400
        
    try:
        success, message = discard_batch(batch_id)
        if success:
            return jsonify({'status': 'success', 'message': message})
        else:
            return jsonify({'error': message}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':

    # Port 5500 as requested
    app.run(debug=True, port=5500)
