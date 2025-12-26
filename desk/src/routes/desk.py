# -*- coding: utf-8 -*-
"""
조판(Desk) API - 기사 관리, 거부/복구, 카테고리 업데이트 등
"""
import os
import json
import shutil
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, render_template
from dotenv import load_dotenv

# 공통 인증 모듈
from src.routes.auth import requires_auth

# Load environment variables (명시적 경로 지정)
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
load_dotenv(env_path)

desk_bp = Blueprint('desk', __name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')


@desk_bp.route('/desk')
@desk_bp.route('/')
@requires_auth
def desk_view():
    """Staging 미리보기 페이지 (관리자 전용)"""
    return render_template('desk.html', active='desk')


from src.trash_manager import TrashManager

# Initialize TrashManager
trash_manager = None  # Will be initialized with CACHE_DIR

@desk_bp.route('/api/desk/list')
@requires_auth
def desk_list():
    """Cache 폴더의 기사 목록 반환 (조판 UI용) - 미분석 기사도 포함"""
    global trash_manager
    if trash_manager is None:
        trash_manager = TrashManager(CACHE_DIR)

    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        include_published = request.args.get('include_published', 'false').lower() == 'true'
        include_trash = request.args.get('include_trash', 'false').lower() == 'true'
        include_unanalyzed = request.args.get('include_unanalyzed', 'false').lower() == 'true'
        
        # [NEW] 시간 범위 파라미터 (Inspector와 동기화)
        hours_param = request.args.get('hours', '0')
        try:
            filter_hours = int(hours_param)
        except:
            filter_hours = 0
        
        cutoff_time = None
        if filter_hours > 0:
            from datetime import timedelta
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=filter_hours)
        
        # [MODIFIED] Support 'all' date for Global Staging View
        is_all_dates = (date_str == 'all')
        
        files_to_process = []
        if is_all_dates:
            import glob
            # Inspector와 동일하게 모든 하위 폴더 검색
            # 구조: desk/cache/YYYY-MM-DD/*.json OR desk/cache/*.json
            search_pattern = os.path.join(CACHE_DIR, '**', '*.json')
            files_to_process = glob.glob(search_pattern, recursive=True)
        else:
            cache_date_dir = os.path.join(CACHE_DIR, date_str)
            if os.path.exists(cache_date_dir):
                files_to_process = [os.path.join(cache_date_dir, f) for f in os.listdir(cache_date_dir) if f.endswith('.json')]
        
        articles = []
        unanalyzed_count = 0  # [NEW] 미분석 기사 카운터
        
        # [NEW] Firebase에서 발행된 article_ids 조회 (동기화)
        published_article_ids = set()
        skip_firebase_sync = os.getenv('DESK_SKIP_FIREBASE_SYNC', 'false').lower() == 'true'
        if not include_published and not skip_firebase_sync:
            try:
                from src.published_articles import get_published_article_ids
                published_article_ids = get_published_article_ids()
                print(f"🔗 [Desk] Firebase sync: {len(published_article_ids)} published IDs loaded")
            except Exception as e:
                pass
        
        for filepath in files_to_process:
            try:
                filename = os.path.basename(filepath)
                # Skip batch files if any
                if 'batch_' in filename: continue

                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # [CRITICAL FILTER] 먼저 상태 체크
                is_published = data.get('published', False)
                is_rejected = data.get('rejected', False)
                is_saved = data.get('saved', False)  # [NEW] Staged 상태 (Inspector 기준 ACCEPTED)
                dedup_status = data.get('dedup_status')
                
                # Firebase Sync
                article_id = data.get('article_id', '')
                if article_id and article_id in published_article_ids:
                    is_published = True
                
                # 완료된 기사(발행/거부/중복/저장됨)는 미분석 카운트에서 제외해야 함
                is_completed = is_published or is_rejected or is_saved or (dedup_status == 'duplicate')
                
                # 분석 상태 체크
                is_analyzed = (
                    data.get('mll_status') == 'analyzed' or
                    data.get('raw_analysis') is not None or
                    data.get('zero_echo_score') is not None
                )
                
                # [FIX Logic] 완료되지 않은 기사 중 분석이 안 된 것만 카운트
                if not is_completed and not is_analyzed:
                    unanalyzed_count += 1
                    if not include_unanalyzed:
                        continue # 카운트만 하고 목록엔 안 넣음
                
                # 1. Trash Filter (거부된 기사)
                if not include_trash and is_rejected:
                    continue
                    
                # 2. Published Filter
                if not include_published and is_published:
                    continue

                # [NEW] 3. 시간 범위 필터링 (Inspector와 동기화)
                if cutoff_time:
                    crawled_at_str = data.get('crawled_at') or data.get('cached_at') or data.get('saved_at')
                    if crawled_at_str:
                        try:
                            crawled_at = datetime.fromisoformat(crawled_at_str.replace('Z', '+00:00'))
                            if crawled_at.tzinfo is None:
                                crawled_at = crawled_at.replace(tzinfo=timezone.utc)
                            if crawled_at < cutoff_time:
                                continue  # 시간 범위 밖
                        except:
                            pass  # 파싱 실패 시 포함

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
                    'rejected': is_rejected,
                    'reject_reason': data.get('reject_reason', ''),
                    'published': is_published,
                    'publish_id': data.get('publish_id', ''),
                    'edition_name': data.get('edition_name', ''),
                    'staged_at': data.get('staged_at', ''),
                    'dedup_status': data.get('dedup_status'),
                    'category': data.get('category'),
                    'status': data.get('status', ''),
                    'mll_status': data.get('mll_status', ''),
                    'date_folder': os.path.basename(os.path.dirname(filepath)),
                    'crawled_at': data.get('crawled_at') or data.get('cached_at') or data.get('saved_at') or data.get('staged_at') or datetime.now().isoformat()
                })
            except Exception as e:
                pass
        
        # 정렬: 대기중 → 발행됨 → 거부됨, 날짜 내림차순
        articles.sort(key=lambda x: (
            2 if not x['published'] and not x['rejected'] else (1 if x['published'] else 0),
            x.get('crawled_at', '')
        ), reverse=True)
        
        return jsonify({
            'date': date_str,
            'articles': articles,
            'total': len(articles),
            'unanalyzed_count': unanalyzed_count
        })
    except Exception as e:
        print(f"❌ [Staging List] Error: {e}")
        return jsonify({'error': str(e)}), 500


@desk_bp.route('/api/desk/reject_selected', methods=['POST'])
@requires_auth
def desk_reject_selected():
    """🗑️ 선택된 기사 일괄 거부 (Reject)"""
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
            
            # [MODIFIED] If not found in target dir (or date='all'), search all folders
            if not os.path.exists(filepath):
                found_path = None
                if os.path.exists(CACHE_DIR):
                    for d in os.listdir(CACHE_DIR):
                        possible_path = os.path.join(CACHE_DIR, d, filename)
                        if os.path.exists(possible_path):
                            found_path = possible_path
                            break
                
                if found_path:
                    filepath = found_path
                else:
                    print(f"⚠️ Reject skip: {filename} not found")
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


@desk_bp.route('/api/desk/restore_selected', methods=['POST'])
@requires_auth
def desk_restore_selected():
    """♻️ 선택된 기사 복구 (Restore rejected articles)"""
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


@desk_bp.route('/api/desk/file')
@requires_auth
def desk_file():
    """특정 Staging 파일 상세 내용 반환"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        filename = request.args.get('filename')
        
        if not filename:
            return jsonify({'error': 'filename is required'}), 400
        
        # 1. Try specified date first
        filepath = os.path.join(CACHE_DIR, date_str, filename)
        
        # 2. If 'all' or not found, search in all date folders
        if date_str == 'all' or not os.path.exists(filepath):
            found_path = None
            if os.path.exists(CACHE_DIR):
                for d in os.listdir(CACHE_DIR):
                    possible_path = os.path.join(CACHE_DIR, d, filename)
                    if os.path.exists(possible_path):
                        found_path = possible_path
                        break
            
            if found_path:
                filepath = found_path
            else:
                return jsonify({'error': 'File not found'}), 404
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # [Add] Inject current folder date if needed for UI context
            # data['_folder_date'] = os.path.basename(os.path.dirname(filepath))
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@desk_bp.route('/api/desk/update_categories', methods=['POST'])
@requires_auth
def desk_update_categories():
    """카테고리 정보를 모든 날짜 폴더의 캐시에 저장"""
    try:
        data = request.json or {}
        category_results = data.get('results', [])
        sent_ids = set(data.get('sent_ids', []))
        
        # article_id -> category 맵 구축
        category_map = {}
        for group in category_results:
            category = group.get('category', '미분류')
            for article_id in group.get('article_ids', []):
                category_map[article_id] = category
        
        updated_count = 0
        uncategorized_count = 0
        
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
                    stored_article_id = article_data.get('article_id') or article_id
                    
                    is_in_result = stored_article_id in category_map or article_id in category_map
                    is_in_scope = not sent_ids or (stored_article_id in sent_ids or article_id in sent_ids)
                    
                    if not is_in_result and not is_in_scope:
                        continue
                    
                    if is_in_result:
                        cat = category_map.get(stored_article_id) or category_map.get(article_id, '미분류')
                        article_data['category'] = cat
                        article_data['dedup_status'] = 'selected'
                    else:
                        article_data['dedup_status'] = 'duplicate'
                        uncategorized_count += 1
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(article_data, f, ensure_ascii=False, indent=2)
                    
                    updated_count += 1
                    
                except Exception as e:
                    print(f"⚠️ [Update Category] Error on {filename}: {e}")
        
        return jsonify({
            'success': True,
            'updated': updated_count,
            'uncategorized': uncategorized_count,
            'message': f'{updated_count}개 기사 카테고리 업데이트 완료'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@desk_bp.route('/api/desk/reset_dedup', methods=['POST'])
@requires_auth
def desk_reset_dedup():
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
                
                if 'dedup_status' in article_data:
                    del article_data['dedup_status']
                if 'category' in article_data:
                    del article_data['category']
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(article_data, f, ensure_ascii=False, indent=2)
                
                reset_count += 1
                
            except Exception as e:
                print(f"⚠️ [Reset Dedup] Error on {filename}: {e}")
        
        return jsonify({
            'success': True,
            'reset': reset_count,
            'message': f'{reset_count}개 기사 중복 상태 초기화 완료'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@desk_bp.route('/api/desk/delete_permanent', methods=['POST'])
@requires_auth
def desk_delete_permanent():
    """🗑️ 선택된 기사 영구 삭제 (DB Reject + File Delete)"""
    global trash_manager
    if trash_manager is None:
        trash_manager = TrashManager(CACHE_DIR)
        
    try:
        data = request.json or {}
        filename = data.get('filename')
        date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
        
        if not filename:
            return jsonify({'success': False, 'error': 'filename required'})
            
        # 1. Get URL from file to reject it in DB
        filepath = os.path.join(CACHE_DIR, date_str, filename)
        url = None
        
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    file_data = json.load(f)
                    url = file_data.get('url')
            except Exception as e:
                print(f"⚠️ Failed to read file for URL extraction: {e}")
        
        if not url:
             return jsonify({'success': False, 'error': 'Cannot find file or URL to reject'})

        # 2. Use TrashManager to dispose
        result = trash_manager.dispose_items([url])
        
        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@desk_bp.route('/api/desk/delete_file', methods=['POST'])
@requires_auth
def desk_delete_file():
    """staging 파일 완전 삭제"""
    try:
        data = request.json or {}
        filename = data.get('filename')
        date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
        
        if not filename:
            return jsonify({'success': False, 'error': 'filename required'})
        
        deleted = False
        
        staging_file = os.path.join(CACHE_DIR, date_str, filename)
        if os.path.exists(staging_file):
            os.remove(staging_file)
            deleted = True
        
        if not deleted:
            for date_folder in os.listdir(CACHE_DIR):
                check_path = os.path.join(CACHE_DIR, date_folder, filename)
                if os.path.exists(check_path):
                    os.remove(check_path)
                    deleted = True
                    break
        
        if deleted:
            return jsonify({'success': True, 'message': f'{filename} 삭제 완료'})
        else:
            return jsonify({'success': False, 'error': f'{filename} 파일을 찾을 수 없습니다'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@desk_bp.route('/api/desk/clear_cache', methods=['POST'])
@requires_auth
def desk_clear_cache():
    """날짜별 캐시 삭제"""
    try:
        data = request.json or {}
        date_str = data.get('date')
        
        if not date_str:
            return jsonify({'success': False, 'error': 'date required'})
        
        deleted_count = 0
        
        cache_date_path = os.path.join(CACHE_DIR, date_str)
        if os.path.exists(cache_date_path) and os.path.isdir(cache_date_path):
            file_count = len([f for f in os.listdir(cache_date_path) if f.endswith('.json')])
            shutil.rmtree(cache_date_path)
            deleted_count = file_count
        
        if deleted_count > 0:
            return jsonify({'success': True, 'message': f'{date_str} 캐시 {deleted_count}개 파일 삭제 완료'})
        else:
            return jsonify({'success': True, 'message': f'{date_str} 캐시가 없거나 이미 삭제됨'})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@desk_bp.route('/api/desk/settings', methods=['GET'])
@requires_auth
def desk_settings():
    """📋 Desk 환경 설정 조회 (커트라인 기본값 등)"""
    return jsonify({
        'success': True,
        'cutline_is_default': float(os.getenv('CUTLINE_IS_DEFAULT', 6.5)),
        'cutline_zs_default': float(os.getenv('CUTLINE_ZS_DEFAULT', 3.0))
    })
