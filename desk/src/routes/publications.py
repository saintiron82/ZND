# -*- coding: utf-8 -*-
"""
Publications API - 발행 회차 관리, 릴리즈, 발행 취소
"""
import os
import json
import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from src.core_logic import (
    update_manifest as _core_update_manifest,
    normalize_field_names as _core_normalize_field_names,
    get_article_id
)
from src.db_client import DBClient

publications_bp = Blueprint('publications', __name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
db = DBClient()


def update_manifest(date_str):
    return _core_update_manifest(date_str)


@publications_bp.route('/api/publications/check')
def publications_check():
    """
    🚀 캐싱 체크 API - 변경 여부만 빠르게 확인
    Query params: since (ISO format timestamp)
    """
    try:
        from src.pipeline import get_db
        db = get_db()
        
        since = request.args.get('since')
        status_filter = request.args.get('status', 'released')
        
        # 가장 최신 발행본 1개만 조회
        issues = db.get_issues_by_date()
        if status_filter:
            issues = [i for i in issues if i.get('status') == status_filter]
        
        if not issues:
            return jsonify({
                'success': True,
                'changed': False,
                'latest_updated_at': None
            })
        
        latest = issues[0]
        latest_updated = latest.get('updated_at') or latest.get('released_at') or latest.get('published_at')
        
        # since 파라미터가 있으면 비교
        if since and latest_updated:
            if latest_updated <= since:
                return jsonify({
                    'success': True,
                    'changed': False,
                    'latest_updated_at': latest_updated
                })
        
        return jsonify({
            'success': True,
            'changed': True,
            'latest_updated_at': latest_updated,
            'latest_issue_id': latest.get('id'),
            'latest_edition_name': latest.get('edition_name')
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/publications/list')
def publications_list():
    """뎌행 회차 목록 반환 (_meta 문서에서 1 READ로 최적화)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        status_filter = request.args.get('status')
        
        # [OPTIMIZED] _meta 문서에서 회차 목록 조회 (1 READ)
        issues = db.get_issues_from_meta(status_filter=status_filter)
        
        # 최신 updated_at 반환 (캐싱 비교용)
        latest_updated = None
        if issues:
            latest_updated = issues[0].get('updated_at')
        
        return jsonify({
            'success': True,
            'issues': issues,
            'latest_updated_at': latest_updated
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/publications/release', methods=['POST'])
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


@publications_bp.route('/api/publications/view')
def publications_view():
    """특정 발행 회차의 기사 목록 반환 (내장 articles 사용으로 1 READ 최적화)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        publish_id = request.args.get('publish_id')
        if not publish_id:
            return jsonify({'success': False, 'error': 'publish_id required'}), 400
            
        record = db.get_publication(publish_id)
        if not record:
            return jsonify({'success': False, 'error': 'Publication not found'}), 404
        
        # [OPTIMIZED] 내장 articles 배열 사용 (1 READ, 추가 쿼리 없음)
        full_articles = record.get('articles', [])
        
        # Fallback: articles 배열이 비어있으면 article_ids로 개별 조회 (하위 호환)
        if not full_articles:
            article_ids = record.get('article_ids', [])
            if article_ids:
                print(f"⚠️ [View] Fallback: Loading {len(article_ids)} articles individually")
                for aid in article_ids:
                    article = db.get_article(aid)
                    if article:
                        full_articles.append(article)

        return jsonify({
            'success': True,
            'publication': record,
            'articles': full_articles
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/publications/remove_articles', methods=['POST'])
def publications_remove_articles():
    """
    발행된 회차에서 선택된 기사를 제거하여 미발행 상태로 변경
    요청: { publish_id: str, article_ids: list, filenames: list (optional) }
    """
    try:
        from src.pipeline import get_db
        db = get_db()
        
        data = request.json or {}
        publish_id = data.get('publish_id')
        article_ids = data.get('article_ids', [])
        filenames = data.get('filenames', [])
        
        if not publish_id:
            return jsonify({'success': False, 'error': 'publish_id required'}), 400
        
        if not article_ids and not filenames:
            return jsonify({'success': False, 'error': 'article_ids or filenames required'}), 400
        
        # 1. 발행 회차 조회
        pub_record = db.get_publication(publish_id)
        if not pub_record:
            return jsonify({'success': False, 'error': 'Publication not found'}), 404
        
        removed_count = 0
        failed_count = 0
        
        # 2. 각 기사에서 publish_id 제거 (Firestore)
        for article_id in article_ids:
            try:
                # Firestore에서 기사 조회
                article_doc = db.get_article(article_id)
                if article_doc and article_doc.get('publish_id') == publish_id:
                    # publish_id 필드 제거 (빈 문자열로 설정)
                    db.update_article(article_id, {
                        'publish_id': '',
                        'edition_code': '',
                        'edition_name': ''
                    })
                    removed_count += 1
                    print(f"🔙 [Remove] Article {article_id} removed from issue {publish_id}")
            except Exception as e:
                print(f"⚠️ [Remove] Failed to update article {article_id}: {e}")
                failed_count += 1
        
        # 3. 캐시 파일 상태 업데이트 (로컬)
        for filename in filenames:
            try:
                cache_filepath = None
                
                # 모든 날짜 폴더에서 파일 찾기
                for date_folder in os.listdir(CACHE_DIR):
                    check_path = os.path.join(CACHE_DIR, date_folder, filename)
                    if os.path.exists(check_path):
                        cache_filepath = check_path
                        break
                
                if cache_filepath:
                    with open(cache_filepath, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    # 발행 상태 제거
                    if cache_data.get('publish_id') == publish_id:
                        cache_data.pop('published', None)
                        cache_data.pop('publish_id', None)
                        cache_data.pop('published_at', None)
                        cache_data.pop('edition_code', None)
                        cache_data.pop('edition_name', None)
                        
                        with open(cache_filepath, 'w', encoding='utf-8') as f:
                            json.dump(cache_data, f, ensure_ascii=False, indent=2)
                        
                        print(f"🔙 [Remove] Cache updated: {filename}")
                        if filename not in [a for a in article_ids]:
                            removed_count += 1
            except Exception as e:
                print(f"⚠️ [Remove] Cache update failed for {filename}: {e}")
                failed_count += 1
        
        # 4. 발행 회차의 article_ids 배열 업데이트
        current_ids = pub_record.get('article_ids', [])
        updated_ids = [aid for aid in current_ids if aid not in article_ids]
        
        db.update_publication_record(publish_id, {
            'article_ids': updated_ids,
            'article_count': len(updated_ids),
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
        return jsonify({
            'success': True,
            'removed': removed_count,
            'failed': failed_count,
            'remaining_count': len(updated_ids),
            'message': f'{removed_count}개 기사가 회차에서 제거되어 미발행 상태로 변경됨'
        })
        
    except Exception as e:
        print(f"❌ [Remove Articles] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500



@publications_bp.route('/api/desk/delete_from_db', methods=['POST'])
def publications_delete_from_db():
    """🔥 Firestore DB에서 선택된 기사 삭제 (로컬 파일은 유지)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        data = request.json or {}
        articles = data.get('articles', [])
        
        if not articles:
            return jsonify({'success': False, 'error': '삭제할 기사가 없습니다.'}), 400
        
        deleted_count = 0
        failed_count = 0
        
        for article in articles:
            url = article.get('url', '')
            
            try:
                if url:
                    doc_id = get_article_id(url)
                    doc_ref = db.db.collection('articles').document(doc_id)
                    doc = doc_ref.get()
                    
                    if doc.exists:
                        doc_ref.delete()
                        deleted_count += 1
                    else:
                        failed_count += 1
                else:
                    failed_count += 1
                    
            except Exception as e:
                print(f"⚠️ [DB Delete] Error: {e}")
                failed_count += 1
        
        return jsonify({
            'success': True,
            'deleted': deleted_count,
            'failed': failed_count,
            'message': f'{deleted_count}개 기사 DB에서 삭제 완료'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/desk/unpublish_selected', methods=['POST'])
def publications_unpublish_selected():
    """
    🔄 발행 취소: 데이터 파일 삭제 + 캐시 상태 리셋
    """
    try:
        data = request.json or {}
        filenames = data.get('filenames', [])
        delete_firestore = data.get('delete_firestore', False)
        
        if not filenames:
            return jsonify({'success': False, 'error': '선택된 파일이 없습니다.'}), 400
        
        unpublished_count = 0
        failed_count = 0
        
        for filename in filenames:
            try:
                cache_filepath = None
                
                for date_folder in os.listdir(CACHE_DIR):
                    check_path = os.path.join(CACHE_DIR, date_folder, filename)
                    if os.path.exists(check_path):
                        cache_filepath = check_path
                        break
                
                if not cache_filepath:
                    failed_count += 1
                    continue
                
                with open(cache_filepath, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                if not cache_data.get('published'):
                    continue
                
                # 1. 데이터 파일 삭제
                data_file = cache_data.get('data_file')
                if data_file:
                    for date_folder in os.listdir(DATA_DIR):
                        data_path = os.path.join(DATA_DIR, date_folder, data_file)
                        if os.path.exists(data_path):
                            os.remove(data_path)
                            update_manifest(date_folder)
                            break
                
                # 2. Firestore 삭제 (선택적)
                if delete_firestore and cache_data.get('url'):
                    try:
                        doc = db.get_article_by_url(cache_data['url'])
                        if doc and doc.get('id'):
                            db.delete_article(doc['id'])
                    except Exception as fs_err:
                        print(f"⚠️ [Unpublish] Firestore delete failed: {fs_err}")
                
                # 3. 캐시 파일 상태 리셋
                cache_data.pop('published', None)
                cache_data.pop('data_file', None)
                cache_data.pop('published_at', None)
                
                with open(cache_filepath, 'w', encoding='utf-8') as f:
                    json.dump(cache_data, f, ensure_ascii=False, indent=2)
                
                # 4. History 리셋
                if cache_data.get('url'):
                    db.remove_from_history(cache_data['url'])
                
                unpublished_count += 1
                
            except Exception as e:
                print(f"⚠️ [Unpublish] Error on {filename}: {e}")
                failed_count += 1
        
        return jsonify({
            'success': True,
            'unpublished': unpublished_count,
            'failed': failed_count,
            'message': f'{unpublished_count}개 기사 발행 취소 완료'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/publications/migrate_edition_names', methods=['POST'])
def publications_migrate_edition_names():
    """
    발행 시간 순서대로 호수 재정렬
    """
    try:
        # 모든 publications 가져오기
        docs = list(db.db.collection('publications').stream())
        
        # published_at 기준으로 정렬
        issues = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            issues.append(data)
        
        issues.sort(key=lambda x: x.get('published_at', ''))
        
        # 순서대로 호수 할당
        updated = 0
        for idx, issue in enumerate(issues, 1):
            new_name = f"{idx}호"
            if issue.get('edition_name') != new_name:
                db.db.collection('publications').document(issue['id']).update({'edition_name': new_name})
                print(f"✅ Updated: {issue.get('edition_name')} -> {new_name}")
                updated += 1
        
        return jsonify({
            'success': True,
            'updated': updated,
            'total': len(issues),
            'message': f'호수 재정렬 완료: {updated}개 업데이트 (총 {len(issues)}개)'
        })
    except Exception as e:
        print(f"❌ [Migration] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/publications/delete', methods=['POST'])
def publications_delete():
    """
    🗑️ 회차 전체 삭제
    - 회차 문서 삭제
    - 해당 회차의 기사들 발행 정보 초기화
    """
    try:
        data = request.json or {}
        publish_id = data.get('publish_id')
        
        if not publish_id:
            return jsonify({'success': False, 'error': 'publish_id 필수'}), 400
        
        # 1. 회차 정보 조회
        pub_record = db.get_publication(publish_id)
        if not pub_record:
            return jsonify({'success': False, 'error': '회차를 찾을 수 없습니다'}), 404
        
        edition_name = pub_record.get('edition_name', publish_id)
        article_ids = pub_record.get('article_ids', [])
        
        # 2. 해당 회차의 기사들 발행 정보 초기화
        reset_count = 0
        for article_id in article_ids:
            try:
                # [FIX] Update DB + Local Cache
                article_doc = db.get_article(article_id)
                if article_doc:
                    # 1. DB Update
                    db.update_article(article_id, {
                        'publish_id': '',
                        'edition_code': '',
                        'edition_name': '',
                        'published': False
                    })
                    
                    
                    # 2. Local Cache Update (In-Place) - article_id와 url_hash 두 가지로 검색
                    import glob
                    
                    found = False
                    cache_paths_to_check = []
                    
                    # 방법 1: article_id로 파일명 검색 (더 확실함)
                    article_id_pattern = os.path.join(CACHE_DIR, '*', f'*{article_id}*.json')
                    cache_paths_to_check.extend(glob.glob(article_id_pattern))
                    
                    # 방법 2: URL 해시로 검색 (폴백)
                    url = article_doc.get('url')
                    if url:
                        from src.core_logic import get_url_hash
                        url_hash = get_url_hash(url)
                        url_hash_pattern = os.path.join(CACHE_DIR, '*', f'*{url_hash}*.json')
                        cache_paths_to_check.extend(glob.glob(url_hash_pattern))
                    
                    # 중복 제거
                    cache_paths_to_check = list(set(cache_paths_to_check))
                    
                    for cache_path in cache_paths_to_check:
                        try:
                            with open(cache_path, 'r', encoding='utf-8') as f:
                                cached_data = json.load(f)
                            
                            # 해당 회차에 속한 기사인지 확인
                            if cached_data.get('publish_id') != publish_id:
                                continue
                            
                            # Remove published flags
                            keys_to_reset = ['published', 'publish_id', 'edition_code', 'edition_name', 'published_at', 'data_file', 'status']
                            changed = False
                            for k in keys_to_reset:
                                if k in cached_data:
                                    cached_data.pop(k)
                                    changed = True
                            
                            # Ensure saved is True so it stays in Staged
                            if not cached_data.get('saved'):
                                cached_data['saved'] = True
                                changed = True
                            
                            if changed:
                                with open(cache_path, 'w', encoding='utf-8') as f:
                                    json.dump(cached_data, f, ensure_ascii=False, indent=2)
                                print(f"🔄 [Cache] Reset published status: {os.path.basename(cache_path)}")
                            found = True
                        except Exception as e:
                            print(f"⚠️ Failed to update cache file {cache_path}: {e}")
                    
                    if not found:
                        print(f"⚠️ Cache file not found for article_id: {article_id}")

                reset_count += 1
            except Exception as e:
                print(f"⚠️ Article reset failed: {article_id} - {e}")
        
        # 3. 회차 문서 삭제
        db.db.collection('publications').document(publish_id).delete()
        print(f"🗑️ [Delete] Deleted publication: {publish_id} ({edition_name})")
        
        # 3-1. [NEW] _meta 문서에서도 회차 제거
        db.remove_issue_from_meta(edition_code)
        
        # 4. 연쇄 재정렬 (Cascade Renumbering)
        renumbered_count = 0
        renumber_msg = ""
        
        try:
            deleted_num_match = re.search(r'(\d+)', edition_name)
            if deleted_num_match:
                deleted_num = int(deleted_num_match.group(1))
                print(f"🔄 Starting renumbering check from {deleted_num}...")
                
                # 모든 회차 조회 (Firestore 쿼리 사용 가능하나, 메모리에서 정렬이 안전)
                all_pubs = db.db.collection('publications').stream()
                targets = []
                
                for pub in all_pubs:
                    pub_data = pub.to_dict()
                    pub_name = pub_data.get('edition_name', '')
                    match = re.search(r'(\d+)', pub_name)
                    if match:
                        num = int(match.group(1))
                        if num > deleted_num:
                            targets.append({'id': pub.id, 'num': num, 'data': pub_data})
                
                # 번호 오름차순 정렬 (작은 번호부터 즉, deleted_num+1 부터 처리)
                targets.sort(key=lambda x: x['num'])
                
                for t in targets:
                    old_num = t['num']
                    new_num = old_num - 1
                    new_name = f"{new_num}호" # 표준 포맷 적용
                    
                    # 회차 문서 업데이트
                    db.db.collection('publications').document(t['id']).update({
                        'edition_name': new_name,
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    })
                    
                    # 해당 회차 기사들 업데이트
                    t_article_ids = t['data'].get('article_ids', [])
                    for aid in t_article_ids:
                        try:
                            db.update_article(aid, {'edition_name': new_name})
                        except Exception as ae:
                            print(f"⚠️ Failed to update article {aid} during renumber: {ae}")
                    
                    print(f"🔄 [Renumber] {old_num}호 -> {new_num}호 (ID: {t['id']})")
                    renumbered_count += 1
                
                # Config 업데이트 (next_issue_number 감소)
                config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'publication_config.json')
                if os.path.exists(config_path):
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                    current_next = config.get('next_issue_number', 1)
                    
                    # 만약 삭제된 번호가 next보다 작으면, 하나 줄여야 함
                    if current_next > deleted_num:
                        config['next_issue_number'] = max(1, current_next - 1)
                        config['last_updated'] = datetime.now(timezone.utc).isoformat()
                        with open(config_path, 'w', encoding='utf-8') as f:
                            json.dump(config, f, ensure_ascii=False, indent=2)
                        print(f"⚙️ Config updated: next_issue_number -> {config['next_issue_number']}")
                        renumber_msg = f"\n이후 회차 {renumbered_count}개가 순서대로 재정렬되었습니다."
        except Exception as e:
            print(f"⚠️ Renumbering failed: {e}")
            renumber_msg = f"\n(재정렬 중 오류 발생: {e})"
        
        return jsonify({
            'success': True,
            'deleted_issue': edition_name,
            'reset_articles': reset_count,
            'renumbered_issues': renumbered_count,
            'message': f'"{edition_name}" 회차가 삭제되었습니다. ({reset_count}개 기사 초기화){renumber_msg}'
        })
    except Exception as e:
        print(f"❌ [Delete] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/publications/update_edition', methods=['POST'])
def publications_update_edition():
    """
    ✏️ 회차 이름(번호) 수정
    - 회차 문서의 edition_name 수정
    - 해당 회차에 속한 모든 기사의 edition_name 수정
    """
    try:
        data = request.json or {}
        publish_id = data.get('publish_id')
        new_edition_name = data.get('new_edition_name')
        
        if not publish_id or not new_edition_name:
            return jsonify({'success': False, 'error': 'publish_id와 new_edition_name 필수'}), 400
        
        # 1. 회차 정보 조회
        pub_record = db.get_publication(publish_id)
        if not pub_record:
            return jsonify({'success': False, 'error': '회차를 찾을 수 없습니다'}), 404
        
        old_edition_name = pub_record.get('edition_name', '')
        article_ids = pub_record.get('article_ids', [])
        
        # 1-1. 새 이름 분석 및 충돌 확인 (Cascade Shift)
        shifted_count = 0
        shift_msg = ""
        
        try:
            match = re.search(r'(\d+)', new_edition_name)
            if match:
                new_issue_num = int(match.group(1))
                
                # 모든 회차 조회
                all_pubs = db.db.collection('publications').stream()
                conflicting_pubs = []
                
                for pub in all_pubs:
                    if pub.id == publish_id: continue # 나는 제외
                    
                    pub_data = pub.to_dict()
                    pub_name = pub_data.get('edition_name', '')
                    p_match = re.search(r'(\d+)', pub_name)
                    if p_match:
                        p_num = int(p_match.group(1))
                        # 새 번호보다 크거나 같은 회차가 이미 있다면 밀어야 함
                        if p_num >= new_issue_num:
                            conflicting_pubs.append({'id': pub.id, 'num': p_num, 'data': pub_data})
                
                # 만약 충돌이 하나라도 있다면 Shift 시작
                if conflicting_pubs:
                    print(f"🔄 Detected conflict for issue {new_issue_num}. Shifting {len(conflicting_pubs)} issues...")
                    
                    # 큰 번호부터 역순으로 처리해야 안전함 (7->8, 6->7, 5->6)
                    conflicting_pubs.sort(key=lambda x: x['num'], reverse=True)
                    
                    for t in conflicting_pubs:
                        old_num = t['num']
                        next_num = old_num + 1
                        next_name = f"{next_num}호"
                        
                        # 회차 문서 업데이트
                        db.db.collection('publications').document(t['id']).update({
                            'edition_name': next_name,
                            'updated_at': datetime.now(timezone.utc).isoformat()
                        })
                        
                        # 기사 업데이트
                        t_article_ids = t['data'].get('article_ids', [])
                        for aid in t_article_ids:
                            try:
                                db.update_article(aid, {'edition_name': next_name})
                            except: pass
                            
                        print(f"🔄 [Shift] {old_num}호 -> {next_num}호 (ID: {t['id']})")
                        shifted_count += 1
                        
                    shift_msg = f"\n기존 회차들과 충돌하여 {shifted_count}개를 뒤로 밀었습니다."

        except Exception as e:
            print(f"⚠️ Shift logic failed: {e}")

        # 2. 회차 문서 업데이트
        db.db.collection('publications').document(publish_id).update({
            'edition_name': new_edition_name,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        
        # 3. 해당 회차의 기사들 업데이트
        updated_count = 0
        for article_id in article_ids:
            try:
                db.update_article(article_id, {
                    'edition_name': new_edition_name
                })
                updated_count += 1
            except Exception as e:
                print(f"⚠️ Article update failed: {article_id} - {e}")
        
        # 4. Config 파일 업데이트 (만약 숫자가 커졌으면 next_issue_number 조정)
        config_updated = False
        try:
            match = re.search(r'(\d+)', new_edition_name)
            if match:
                new_issue_num = int(match.group(1))
                config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'publication_config.json')
                
                # Config 읽기
                current_config = {}
                if os.path.exists(config_path):
                    with open(config_path, 'r', encoding='utf-8') as f:
                        current_config = json.load(f)
                
                next_issue = current_config.get('next_issue_number', 1)
                
                # 새 번호가 현재 next보다 크거나 같으면, next를 새 번호 + 1로 설정
                if new_issue_num >= next_issue:
                    current_config['next_issue_number'] = new_issue_num + 1
                    current_config['last_updated'] = datetime.now(timezone.utc).isoformat()
                    
                    with open(config_path, 'w', encoding='utf-8') as f:
                        json.dump(current_config, f, ensure_ascii=False, indent=2)
                    config_updated = True
                    print(f"⚙️ Config updated: next_issue_number -> {new_issue_num + 1}")
        except Exception as e:
            print(f"⚠️ Config update failed during rename: {e}")
        
        print(f"✏️ [Update] Edition renamed: {publish_id} ({old_edition_name} -> {new_edition_name})")
        
        message = f'회차명이 "{new_edition_name}"(으)로 변경되었습니다. ({updated_count}개 기사 업데이트)'
        if shift_msg:
            message += shift_msg
        if config_updated:
            message += f'\n다음 발행 호수도 {new_issue_num + 1}호로 자동 조정되었습니다.'
        
        return jsonify({
            'success': True,
            'updated_articles': updated_count,
            'message': message
        })
    except Exception as e:
        print(f"❌ [Update Edition] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
