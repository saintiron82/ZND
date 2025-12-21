# -*- coding: utf-8 -*-
"""
조판(Desk) API - 기사 관리, 거부/복구, 카테고리 업데이트 등
"""
import os
import json
import shutil
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, render_template

desk_bp = Blueprint('desk', __name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')


@desk_bp.route('/desk')
@desk_bp.route('/')
def desk_view():
    """Staging 미리보기 페이지"""
    return render_template('desk.html')


@desk_bp.route('/api/desk/list')
def desk_list():
    """Cache 폴더의 기사 목록 반환 (조판 UI용) - 분석된 기사만 표시"""
    try:
        date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        include_published = request.args.get('include_published', 'false').lower() == 'true'
        
        cache_date_dir = os.path.join(CACHE_DIR, date_str)
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
                    
                    # 분석되지 않은 기사는 조판 목록에서 제외
                    is_analyzed = (
                        data.get('mll_status') == 'analyzed' or
                        data.get('raw_analysis') is not None or
                        data.get('zero_echo_score') is not None
                    )
                    if not is_analyzed:
                        continue
                    
                    # 기발행 필터링 (기본적으로 제외)
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


@desk_bp.route('/api/desk/reject_selected', methods=['POST'])
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


@desk_bp.route('/api/desk/restore_selected', methods=['POST'])
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
def desk_file():
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


@desk_bp.route('/api/desk/update_categories', methods=['POST'])
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


@desk_bp.route('/api/desk/delete_legacy', methods=['POST'])
def desk_delete_legacy():
    """LEGACY_CALL article_id를 가진 staging 파일 및 캐시 삭제"""
    try:
        deleted_count = 0
        
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
                            deleted_count += 1
                            print(f"🗑️ [Delete Legacy] Deleted: {filepath}")
                    except Exception as e:
                        print(f"⚠️ [Delete Legacy] Error on {filename}: {e}")
        
        return jsonify({
            'success': True,
            'deleted': deleted_count,
            'message': f'LEGACY_CALL 삭제 완료: {deleted_count}개'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@desk_bp.route('/api/desk/delete_file', methods=['POST'])
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


@desk_bp.route('/api/desk/publish_selected', methods=['POST'])
def desk_publish_selected():
    """선택된 Staging 파일만 발행 (New or Append to Issue)"""
    try:
        from src.pipeline import save_article, get_db
        db = get_db()
        
        data = request.json or {}
        filenames = data.get('filenames', [])
        mode = data.get('mode', 'new')
        target_publish_id = data.get('target_publish_id')
        
        if not filenames:
            return jsonify({'success': False, 'error': '선택된 파일이 없습니다.'}), 400
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        
        # 1. Edition Info
        edition_code = ""
        edition_name = ""
        publish_id = ""
        
        if mode == 'new':
            issues = db.get_issues_by_date(today_str)
            
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
            
            pub_data = {
                'edition_code': edition_code,
                'edition_name': edition_name,
                'article_count': 0,
                'article_ids': [],  # ID만 저장 (중복 제거)
                'published_at': datetime.now(timezone.utc).isoformat(),
                'date': today_str,
                'status': 'preview'
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
        published_article_ids = []       # DB용: ID만 저장
        published_articles_detail = []   # 로컬 인덱스용: 상세 정보
        
        for filename in filenames:
            filepath = os.path.join(cache_date_dir, filename)
            if not os.path.exists(filepath):
                for d in os.listdir(CACHE_DIR):
                    check_path = os.path.join(CACHE_DIR, d, filename)
                    if os.path.exists(check_path):
                        filepath = check_path
                        break
                else:
                    failed_count += 1
                    continue
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    staging_data = json.load(f)
                
                staging_data['publish_id'] = publish_id
                staging_data['edition_code'] = edition_code
                staging_data['edition_name'] = edition_name
                
                result = save_article(staging_data, source_id=staging_data.get('source_id'), skip_evaluation=True)
                
                if result.get('status') == 'saved':
                    staging_data['published'] = True
                    staging_data['published_at'] = datetime.now(timezone.utc).isoformat()
                    staging_data['data_file'] = result.get('filename')
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(staging_data, f, ensure_ascii=False, indent=2)
                    
                    published_count += 1
                    
                    article_id = result.get('article_id', staging_data.get('article_id'))
                    published_article_ids.append(article_id)
                    
                    # 로컬 인덱스 파일용 상세 정보
                    published_articles_detail.append({
                        'id': article_id,
                        'title': staging_data.get('title_ko') or staging_data.get('title'),
                        'url': staging_data.get('url'),
                        'filename': result.get('filename'),
                        'date': result.get('date')
                    })
                else:
                    failed_count += 1
                    
            except Exception as e:
                print(f"⚠️ [Publish] Error on {filename}: {e}")
                failed_count += 1
        
        # 3. Update Index
        # DB용: ID 리스트
        final_article_ids = published_article_ids
        # 로컬용: 상세 정보 리스트
        final_article_detail = published_articles_detail
        
        if mode == 'append':
            current_record = db.get_publication(publish_id)
            existing_ids = current_record.get('article_ids', [])
            # 기존 articles 배열에서 ID 추출 (하위 호환)
            if not existing_ids:
                existing_ids = [a.get('id') for a in current_record.get('articles', []) if a.get('id')]
            final_article_ids = existing_ids + published_article_ids
            
            # 로컬 인덱스용 상세 정보도 합치기
            existing_detail = current_record.get('articles', [])
            final_article_detail = existing_detail + published_articles_detail
        
        # 로컬 issue 인덱스 파일 (상세 정보 포함 - WEB 호환)
        index_data = {
            'id': publish_id,
            'edition_code': edition_code,
            'edition_name': edition_name,
            'published_at': datetime.now(timezone.utc).isoformat(),
            'date': today_str,
            'article_count': len(final_article_ids),
            'articles': final_article_detail  # 로컬에는 상세 정보 유지
        }
        db.save_issue_index_file(index_data)
        
        # Firestore DB (ID만 저장 - 중복 제거)
        db.update_publication_record(publish_id, {
            'article_count': len(final_article_ids),
            'article_ids': final_article_ids,  # ID만 저장!
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
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
