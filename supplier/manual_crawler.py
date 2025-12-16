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

app = Flask(__name__)
db = DBClient()
robots_checker = RobotsChecker()
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

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

def _normalize_url_for_dedupe(url):
    """Normalize URL for deduplication check (ignore scheme, trailing slash)."""
    if not url: return ""
    try:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(url)
        # Normalize scheme to http (or empty) to ignore http/https diff
        # Remove trailing slash from path
        path = parsed.path.rstrip('/')
        
        # Reconstruct without scheme
        # We prefer to keep netloc/path/query/params/fragment
        # But to match http vs https, we can just strip the scheme part
        # simplified: lower case, strip scheme, strip trailing slash
        
        # Simplified manual normalization:
        # 1. Strip whitespace
        norm = url.strip()
        # 2. To lowercase (usually safe for domains, maybe not for complex query params but acceptable for dedupe)
        # Actually query params are case sensitive commonly. Let's ONLY lower casing the scheme/netloc?
        # Too complex. Let's just strip trailing slash and scheme.
        
        # Remove scheme
        if norm.startswith('https://'):
            norm = norm[8:]
        elif norm.startswith('http://'):
            norm = norm[7:]
            
        # Remove trailing slash
        if norm.endswith('/'):
            norm = norm[:-1]
            
        return norm
    except:
        return url

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
                            norm_url = _normalize_url_for_dedupe(url)
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
        # Use Playwright for best compatibility in manual mode too
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

    # [NEW] Check content length
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
    Save article - uses unified pipeline (same as auto crawler).
    """
    from src.pipeline import save_article as pipeline_save
    
    data = normalize_field_names(request.json)
    
    # Validate required fields
    required_fields = ['url', 'source_id', 'title_ko', 'summary', 'zero_echo_score', 'impact_score', 'original_title']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400
    
    # Use unified pipeline for saving
    result = pipeline_save(data, source_id=data.get('source_id'))
    
    if result.get('status') == 'saved':
        return jsonify({
            'status': 'success',
            'data_file': {
                'filename': result.get('filename'),
                'date': result.get('date'),
                'path': f"data/{result.get('date')}/{result.get('filename')}"
            }
        })
    elif result.get('status') == 'worthless':
        return jsonify({'error': f"Article marked as worthless: {result.get('reason')}"}), 400
    else:
        return jsonify({'error': result.get('error', 'Unknown error')}), 500

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
    Supports both V0.9 and Legacy schemas.
    """
    # --- V0.9 Schema Detection ---
    if 'Impact_Analysis_IS' in data or 'Evidence_Analysis_ZES' in data:
        # V0.9 Impact Score Calculation
        calculated_impact = 0.0
        is_breakdown = {}
        if 'Impact_Analysis_IS' in data:
            scores = data['Impact_Analysis_IS'].get('Scores', {})
            is_breakdown = scores
            calculated_impact += float(scores.get('IW_Score', 0))
            calculated_impact += float(scores.get('Gap_Score', 0))
            calculated_impact += float(scores.get('Context_Bonus', 0))
            # Scope_Total and Criticality_Total are nested inside IE_Breakdown_Total
            ie_breakdown = scores.get('IE_Breakdown_Total', {})
            calculated_impact += float(ie_breakdown.get('Scope_Total', 0))
            calculated_impact += float(ie_breakdown.get('Criticality_Total', 0))
            calculated_impact += float(scores.get('Adjustment_Score', 0))
        calculated_impact = round(max(0.0, min(10.0, calculated_impact)), 1)

        # V0.9 ZES Calculation (Base 5.0)
        # Formula: ZES = 5 - (Positive + Negative)
        # Since Negative weights are already negative, we sum all and subtract from base
        ZS_final = 5.0  # Base score
        zes_sum = 0.0
        zes_breakdown = {'base': 5.0, 'positive': [], 'negative': []}
        if 'Evidence_Analysis_ZES' in data:
            vector = data['Evidence_Analysis_ZES'].get('ZES_Score_Vector', {})
            positive_scores = vector.get('Positive_Scores', [])
            negative_scores = vector.get('Negative_Scores', [])
            zes_breakdown['positive'] = positive_scores
            zes_breakdown['negative'] = negative_scores
            # Sum all weighted scores
            for p in positive_scores:
                zes_sum += float(p.get('Raw_Score', 0)) * float(p.get('Weight', 1))
            for n in negative_scores:
                zes_sum += float(n.get('Raw_Score', 0)) * float(n.get('Weight', 1))
        # ZES = 5 - (sum)
        ZS_final = 5.0 - zes_sum
        ZS_final = round(max(0.0, min(10.0, ZS_final)), 1)

        return {
            'zs_final': ZS_final,
            'zs_raw': ZS_final,
            'impact_score': calculated_impact,
            'breakdown': {
                'schema': 'V0.9',
                'is_components': is_breakdown,
                'zes_vector': zes_breakdown,
                'zs_clamped': ZS_final,
                'impact_calc': calculated_impact
            }
        }

    # --- Legacy Schema Fallback ---
    V = 5.0
    evidence = data.get('evidence', {})
    credits = evidence.get('credits', [])
    credit_sum = sum(float(item.get('value', 0.0)) for item in credits)
    V -= credit_sum
    
    penalties = evidence.get('penalties', [])
    penalty_sum = sum(float(item.get('value', 0.0)) for item in penalties)
    V += penalty_sum
    
    modifiers = evidence.get('modifiers', [])
    modifier_sum = sum(float(item.get('effect', 0.0)) for item in modifiers)
    V -= modifier_sum
    
    ZS = V
    ZS_final = max(0.0, min(10.0, ZS))
    
    impact_evidence = data.get('impact_evidence', {})
    entity = impact_evidence.get('entity', {})
    entity_weight = float(entity.get('weight', 0.0))
    events = impact_evidence.get('events', [])
    event_weight_sum = sum(float(ev.get('weight', 0.0)) for ev in events)
    calculated_impact = round(entity_weight + event_weight_sum, 2)
    
    return {
        'zs_final': round(ZS_final, 2),
        'zs_raw': ZS,
        'impact_score': calculated_impact,
        'breakdown': {
            'schema': 'Legacy',
            'base': 5.0,
            'credits': credits,
            'penalties': penalties,
            'modifiers': modifiers,
            'credits_sum': credit_sum,
            'penalties_sum': penalty_sum,
            'modifiers_sum': modifier_sum,
            'zs_raw': ZS,
            'zs_clamped': ZS_final,
            'impact_entity': entity,
            'impact_events': events,
            'impact_calc': calculated_impact
        }
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

        # Check Noise Score (threshold from config)
        from src.core_logic import get_config
        high_noise_threshold = get_config('scoring', 'high_noise_threshold', default=7.0)
        if scores['zs_final'] >= high_noise_threshold:
             print(f"⚠️ [Inject] ZS is high ({scores['zs_final']}), marking as WORTHLESS.")
             db.save_history(url, 'WORTHLESS', reason='high_noise_manual_inject')
             return jsonify({
                 'status': 'error', 
                 'error': f"Article has High Noise ({scores['zs_final']}). Marked as WORTHLESS and NOT saved."
             }), 400

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

STAGING_DIR = os.path.join(os.path.dirname(__file__), 'staging')

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
    4️⃣ 조판 (Staging): 분석 완료된 캐시 → staging 폴더로 복사
    - 점수 재검증 포함
    - 마스터 검토용 미리보기
    """
    try:
        from src.score_engine import process_raw_analysis
        from src.core_logic import get_config
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        staging_date_dir = os.path.join(STAGING_DIR, today_str)
        
        # Staging 폴더 생성
        os.makedirs(staging_date_dir, exist_ok=True)
        
        staged_count = 0
        skipped_count = 0
        rejected_count = 0
        
        high_noise_threshold = get_config('scoring', 'high_noise_threshold', default=7.0)
        
        if os.path.exists(cache_date_dir):
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    # 분석 안 된 것은 스킵 (raw_analysis 있거나 saved면 분석 완료로 간주)
                    is_analyzed = (
                        cache_data.get('mll_status') == 'analyzed' or
                        cache_data.get('raw_analysis') is not None or
                        cache_data.get('saved') is True
                    )
                    if not is_analyzed:
                        skipped_count += 1
                        continue
                    
                    # 이미 staging 됨
                    if cache_data.get('staged'):
                        skipped_count += 1
                        continue
                    
                    # 점수 재검증 (raw_analysis 있으면)
                    if cache_data.get('raw_analysis'):
                        try:
                            scores = process_raw_analysis(cache_data['raw_analysis'])
                            cache_data['zero_echo_score'] = scores.get('zero_echo_score', 5.0)
                            cache_data['impact_score'] = scores.get('impact_score', 0.0)
                        except Exception as e:
                            print(f"⚠️ [Stage] Score calc error: {e}")
                    
                    # 고노이즈 필터링
                    zs = float(cache_data.get('zero_echo_score', 5.0))
                    if zs >= high_noise_threshold:
                        cache_data['rejected'] = True
                        cache_data['reject_reason'] = f'high_noise ({zs})'
                        rejected_count += 1
                    
                    # Staging 데이터 준비
                    staging_data = {
                        **cache_data,
                        'staged_at': datetime.now(timezone.utc).isoformat(),
                        'staged': True
                    }
                    
                    # Staging 폴더에 저장
                    staging_filepath = os.path.join(staging_date_dir, filename)
                    with open(staging_filepath, 'w', encoding='utf-8') as f:
                        json.dump(staging_data, f, ensure_ascii=False, indent=2)
                    
                    # 원본 캐시에도 staged 표시
                    cache_data['staged'] = True
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(cache_data, f, ensure_ascii=False, indent=2)
                    
                    staged_count += 1
                    
                except Exception as e:
                    print(f"⚠️ [Stage] Error on {filename}: {e}")
        
        print(f"📋 [Stage] 조판: {staged_count}, 스킵: {skipped_count}, 거부: {rejected_count}")
        return jsonify({
            'success': True,
            'staged': staged_count,
            'skipped': skipped_count,
            'rejected': rejected_count,
            'staging_dir': staging_date_dir,
            'message': f'조판 {staged_count}개 완료 (거부 {rejected_count}개)'
        })
    except Exception as e:
        print(f"❌ [Stage] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/automation/publish', methods=['POST'])
def automation_publish():
    """
    5️⃣ 발행: staging → data 폴더 + 웹 동기화
    - rejected 아닌 것만 발행
    """
    try:
        from src.pipeline import save_article
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        staging_date_dir = os.path.join(STAGING_DIR, today_str)
        
        published_count = 0
        skipped_count = 0
        failed_count = 0
        
        if os.path.exists(staging_date_dir):
            for filename in os.listdir(staging_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(staging_date_dir, filename)
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
                    
                    # 필수 필드 체크
                    required = ['url', 'title_ko', 'summary', 'zero_echo_score', 'impact_score']
                    missing = [f for f in required if f not in staging_data]
                    if missing:
                        print(f"⚠️ [Publish] Missing fields {missing}: {filename}")
                        skipped_count += 1
                        continue
                    
                    # 발행
                    result = save_article(staging_data, source_id=staging_data.get('source_id'))
                    
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
    """Staging 폴더의 기사 목록 반환"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        staging_date_dir = os.path.join(STAGING_DIR, date_str)
        
        articles = []
        
        if os.path.exists(staging_date_dir):
            for filename in os.listdir(staging_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(staging_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
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
                        'staged_at': data.get('staged_at', ''),
                    })
                except Exception as e:
                    print(f"⚠️ [Staging List] Error reading {filename}: {e}")
        
        # 정렬: 발행됨 → 대기중 → 거부됨
        def sort_key(a):
            if a['published']:
                return (0, a.get('staged_at', ''))
            elif a['rejected']:
                return (2, a.get('staged_at', ''))
            else:
                return (1, a.get('staged_at', ''))
        
        articles.sort(key=sort_key, reverse=True)
        
        return jsonify({
            'date': date_str,
            'articles': articles,
            'total': len(articles)
        })
    except Exception as e:
        print(f"❌ [Staging List] Error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/staging/file')
def staging_file():
    """특정 Staging 파일 상세 내용 반환"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        filename = request.args.get('filename')
        
        if not filename:
            return jsonify({'error': 'filename is required'}), 400
        
        filepath = os.path.join(STAGING_DIR, date_str, filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/staging/publish_selected', methods=['POST'])
def staging_publish_selected():
    """선택된 Staging 파일만 발행"""
    try:
        from src.pipeline import save_article
        
        data = request.json or {}
        filenames = data.get('filenames', [])
        
        if not filenames:
            return jsonify({'success': False, 'error': '선택된 파일이 없습니다.'}), 400
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        staging_date_dir = os.path.join(STAGING_DIR, today_str)
        
        published_count = 0
        failed_count = 0
        
        for filename in filenames:
            filepath = os.path.join(staging_date_dir, filename)
            
            if not os.path.exists(filepath):
                print(f"⚠️ [Publish Selected] File not found: {filename}")
                failed_count += 1
                continue
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    staging_data = json.load(f)
                
                # 이미 발행됨 또는 거부됨
                if staging_data.get('published') or staging_data.get('rejected'):
                    continue
                
                # 필수 필드 체크
                required = ['url', 'title_ko', 'summary', 'zero_echo_score', 'impact_score']
                missing = [f for f in required if f not in staging_data]
                if missing:
                    print(f"⚠️ [Publish Selected] Missing fields {missing}: {filename}")
                    failed_count += 1
                    continue
                
                # 발행
                result = save_article(staging_data, source_id=staging_data.get('source_id'))
                
                if result.get('status') == 'saved':
                    staging_data['published'] = True
                    staging_data['published_at'] = datetime.now(timezone.utc).isoformat()
                    staging_data['data_file'] = result.get('filename')
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(staging_data, f, ensure_ascii=False, indent=2)
                    
                    published_count += 1
                    print(f"✅ [Publish Selected] {filename} → {result.get('filename')}")
                else:
                    failed_count += 1
                    
            except Exception as e:
                print(f"⚠️ [Publish Selected] Error on {filename}: {e}")
                failed_count += 1
        
        print(f"🚀 [Publish Selected] 완료: {published_count}개 발행, {failed_count}개 실패")
        return jsonify({
            'success': True,
            'published': published_count,
            'failed': failed_count,
            'message': f'{published_count}개 기사 발행 완료'
        })
    except Exception as e:
        print(f"❌ [Publish Selected] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    # Port 5500 as requested
    app.run(debug=True, port=5500)
