# -*- coding: utf-8 -*-
"""
Publications API - 발행 회차 관리, 릴리즈, 발행 취소
"""
import os
import json
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
    """발행 회차 목록 반환 (status 필터 지원)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        date_str = request.args.get('date')
        status_filter = request.args.get('status')
        
        issues = db.get_issues_by_date(date_str)
        
        if status_filter:
            issues = [i for i in issues if i.get('status') == status_filter]
        
        # 최신 updated_at 반환 (캐싱 비교용)
        latest_updated = None
        if issues:
            latest_updated = issues[0].get('updated_at') or issues[0].get('published_at')
        
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
    """특정 발행 회차의 기사 목록 반환 (DB 기반)"""
    try:
        from src.pipeline import get_db
        db = get_db()
        
        publish_id = request.args.get('publish_id')
        if not publish_id:
            return jsonify({'success': False, 'error': 'publish_id required'}), 400
            
        record = db.get_publication(publish_id)
        if not record:
            return jsonify({'success': False, 'error': 'Publication not found'}), 404
        
        # 1. publish_id로 articles 컬렉션에서 직접 조회
        full_articles = db.get_articles_by_publish_id(publish_id)
        
        # 2. 결과 없으면 article_ids로 개별 조회
        if not full_articles:
            article_ids = record.get('article_ids', [])
            if article_ids:
                for aid in article_ids:
                    article = db.get_article(aid)
                    if article:
                        full_articles.append(article)
        
        # 3. 여전히 없으면 기존 articles 배열 사용 (하위 호환)
        if not full_articles:
            full_articles = record.get('articles', [])

        return jsonify({
            'success': True,
            'publication': record,
            'articles': full_articles
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publications_bp.route('/api/publications/move_articles', methods=['POST'])
def publications_move_articles():
    """선택된 기사들을 특정 회차로 이동"""
    return jsonify({'success': False, 'error': 'Not implemented yet'}), 501


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
