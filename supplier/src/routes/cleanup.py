# -*- coding: utf-8 -*-
"""
Cleanup API - 중복 정리, 검색, 데이터 관리
"""
import os
import json
from datetime import datetime
from flask import Blueprint, request, jsonify

from src.db_client import DBClient
from src.core_logic import (
    normalize_url_for_dedupe,
    get_url_hash as _core_get_url_hash,
    get_cache_path as _core_get_cache_path,
    update_manifest as _core_update_manifest,
)

cleanup_bp = Blueprint('cleanup', __name__)

db = DBClient()
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')


def update_manifest(date_str):
    return _core_update_manifest(date_str)


@cleanup_bp.route('/api/dates')
def get_dates():
    """날짜별 데이터 폴더 목록"""
    try:
        dates = []
        if os.path.exists(DATA_DIR):
            for item in os.listdir(DATA_DIR):
                item_path = os.path.join(DATA_DIR, item)
                if os.path.isdir(item_path) and len(item) == 10 and item[4] == '-' and item[7] == '-':
                    json_files = [f for f in os.listdir(item_path) if f.endswith('.json') and f != 'index.json']
                    dates.append({
                        'date': item,
                        'count': len(json_files)
                    })
        
        dates.sort(key=lambda x: x['date'], reverse=True)
        return jsonify(dates)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/articles_by_date')
def get_articles_by_date():
    """날짜별 캐시된 기사 목록"""
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Date required'}), 400
    
    try:
        # URL -> data 파일 매핑
        url_to_data = {}
        if os.path.exists(DATA_DIR):
            for date_folder in os.listdir(DATA_DIR):
                data_path = os.path.join(DATA_DIR, date_folder)
                if not os.path.isdir(data_path):
                    continue
                for data_file in os.listdir(data_path):
                    if not data_file.endswith('.json') or data_file == 'index.json':
                        continue
                    filepath = os.path.join(data_path, data_file)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if data.get('url'):
                                url_to_data[data['url']] = {
                                    'filename': data_file,
                                    'date': date_folder,
                                    'path': filepath
                                }
                    except:
                        pass
        
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
                    
                url = data.get('url', '')
                status = db.get_history_status(url) if url else 'NEW'
                linked_data = url_to_data.get(url)
                
                articles.append({
                    'url': url,
                    'title_ko': data.get('title_ko', data.get('title', '')),
                    'original_title': data.get('original_title', ''),
                    'source_id': data.get('source_id', 'unknown'),
                    'zero_echo_score': data.get('zero_echo_score'),
                    'impact_score': data.get('impact_score'),
                    'summary': data.get('summary', ''),
                    'filename': filename,
                    'filepath': filepath,
                    'status': status if status else 'NEW',
                    'cached': True,
                    'data_file': linked_data,
                    'content': data
                })
            except json.JSONDecodeError:
                try:
                    os.remove(filepath)
                except:
                    pass
            except Exception as e:
                print(f"⚠️ Error reading {filename}: {e}")
        
        articles.sort(key=lambda x: (x.get('impact_score') or 0, x.get('filename', '')), reverse=True)
        
        return jsonify({
            'date': date_str,
            'articles': articles,
            'total': len(articles)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/search_cache')
def search_cache():
    """캐시 검색"""
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify({'error': 'Query required'}), 400
    
    try:
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
                            
                        title = (data.get('title', '') or data.get('title_ko', '') or '').lower()
                        article_id = (data.get('article_id', '') or '').lower()
                        
                        if query in filename.lower() or query in title or query in article_id:
                            results.append({
                                'filename': filename,
                                'date': date_folder,
                                'path': filepath,
                                'url': data.get('url', ''),
                                'title': data.get('title', data.get('title_ko', '')),
                                'article_id': data.get('article_id', '')
                            })
                    except:
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


def _get_duplicate_groups():
    """중복 캐시 파일 그룹"""
    url_to_files = {}
    
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
                    
    return {k: v for k, v in url_to_files.items() if len(v) > 1}


@cleanup_bp.route('/api/find_duplicate_caches')
def find_duplicate_caches():
    """중복 캐시 파일 찾기"""
    try:
        duplicates = _get_duplicate_groups()
        
        for _, files in duplicates.items():
            files.sort(key=lambda x: x.get('cached_at', ''), reverse=True)
        
        return jsonify({
            'duplicates': duplicates,
            'total_duplicate_urls': len(duplicates),
            'total_duplicate_files': sum(len(f) - 1 for f in duplicates.values())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/cleanup_duplicate_caches', methods=['POST'])
def cleanup_duplicate_caches():
    """중복 캐시 정리 (최신 유지)"""
    try:
        deleted_count = 0
        duplicates = _get_duplicate_groups()
        
        for _, files in duplicates.items():
            if len(files) > 1:
                files.sort(key=lambda x: x.get('cached_at', ''), reverse=True)
                for file_info in files[1:]:
                    try:
                        os.remove(file_info['path'])
                        deleted_count += 1
                    except:
                        pass
        
        return jsonify({
            'status': 'success',
            'deleted_count': deleted_count,
            'message': f'Deleted {deleted_count} duplicate files'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/find_orphan_data_files')
def find_orphan_data_files():
    """고아 데이터 파일 찾기"""
    try:
        cached_urls = set()
        cached_ids = set()
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    try:
                        with open(os.path.join(date_path, filename), 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if data.get('url'): cached_urls.add(data['url'])
                            if data.get('article_id'): cached_ids.add(data['article_id'])
                    except:
                        pass
        
        orphans = []
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
                            aid = data.get('article_id')
                            connected = (url and url in cached_urls) or (aid and aid in cached_ids)
                            if not connected:
                                orphans.append({
                                    'filename': filename,
                                    'date': date_folder,
                                    'path': filepath,
                                    'url': url,
                                    'article_id': aid,
                                    'title': data.get('title_ko', data.get('title', ''))
                                })
                    except:
                        pass
        
        return jsonify({
            'orphan_files': orphans,
            'total': len(orphans)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/cleanup_orphan_data_files', methods=['POST'])
def cleanup_orphan_data_files():
    """고아 데이터 파일 삭제"""
    try:
        cached_urls = set()
        cached_ids = set()
        if os.path.exists(CACHE_DIR):
            for date_folder in os.listdir(CACHE_DIR):
                date_path = os.path.join(CACHE_DIR, date_folder)
                if not os.path.isdir(date_path):
                    continue
                for filename in os.listdir(date_path):
                    if not filename.endswith('.json'):
                        continue
                    try:
                        with open(os.path.join(date_path, filename), 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if data.get('url'): cached_urls.add(data['url'])
                            if data.get('article_id'): cached_ids.add(data['article_id'])
                    except:
                        pass
        
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
                            aid = data.get('article_id')
                            connected = (url and url in cached_urls) or (aid and aid in cached_ids)
                            if not connected:
                                os.remove(filepath)
                                deleted_count += 1
                                dates_affected.add(date_folder)
                    except:
                        pass
        
        for date_str in dates_affected:
            try:
                db._update_daily_summary(date_str)
            except:
                pass
        
        return jsonify({
            'status': 'success',
            'deleted_count': deleted_count,
            'message': f'Deleted {deleted_count} orphan files'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/delete_cache_file', methods=['POST'])
def delete_cache_file():
    """캐시 파일 삭제"""
    data = request.json
    filepath = data.get('filepath')
    
    if not filepath:
        return jsonify({'error': 'Filepath required'}), 400
    
    abs_filepath = os.path.abspath(filepath)
    abs_cache_dir = os.path.abspath(CACHE_DIR)
    
    if not abs_filepath.startswith(abs_cache_dir):
        return jsonify({'error': 'Can only delete cache files'}), 403
    
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({'status': 'success', 'message': f'Deleted: {filepath}'})
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/cleanup_cache_file', methods=['POST'])
def cleanup_cache_file():
    """캐시 파일 정리 (필수 필드만 유지)"""
    data = request.json
    filepath = data.get('filepath')
    
    if not filepath:
        return jsonify({'error': 'Filepath required'}), 400
    
    abs_filepath = os.path.abspath(filepath)
    abs_cache_dir = os.path.abspath(CACHE_DIR)
    
    if not abs_filepath.startswith(abs_cache_dir):
        return jsonify({'error': 'Can only clean cache files'}), 403
    
    try:
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        with open(filepath, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
        
        cleaned_data = {
            'url': current_data.get('url', ''),
            'article_id': current_data.get('article_id', ''),
            'cached_at': current_data.get('cached_at', ''),
            'source_id': current_data.get('source_id', ''),
            'cleaned_at': datetime.now().isoformat(),
            'status': 'CLEANED'
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'status': 'success', 'message': f'Cleaned: {filepath}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cleanup_bp.route('/api/find_by_article_ids', methods=['POST'])
def find_by_article_ids():
    """article_id로 캐시 검색"""
    data = request.json
    article_ids = data.get('article_ids', [])
    
    if not article_ids:
        return jsonify({'error': 'article_ids required'}), 400
    
    try:
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
