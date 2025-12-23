# -*- coding: utf-8 -*-
"""
발행(Publish) API - 기사 발행, 캐시 동기화, 발행 설정 관리
"""
import os
import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

publish_bp = Blueprint('publish', __name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')


@publish_bp.route('/api/desk/publish_selected', methods=['POST'])
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
            # publication_config.json에서 다음 호수 읽기
            config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'publication_config.json')
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                next_idx = config.get('next_issue_number', 1)
            except:
                next_idx = 1
                
            yy = today_str[2:4]
            mm = today_str[5:7]
            dd = today_str[8:10]
            edition_code = f"{yy}{mm}{dd}_{next_idx}"
            edition_name = f"{next_idx}호"
            
            # 설정 파일 업데이트 (다음 호수 증가)
            try:
                config['next_issue_number'] = next_idx + 1
                config['last_updated'] = datetime.now(timezone.utc).isoformat()
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"⚠️ Config update failed: {e}")
            
            pub_data = {
                'edition_code': edition_code,
                'edition_name': edition_name,
                'article_count': 0,
                'article_ids': [],  # ID만 저장 (중복 제거)
                'articles': [],     # [NEW] 기사 상세 내장
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
        skipped_count = 0  # [NEW] 이미 발행된 기사 스킵 카운터
        skipped_articles = []  # [NEW] 스킵된 기사 ID 목록
        published_article_ids = []       # DB용: ID만 저장
        published_articles_detail = []   # 로컬 인덱스용: 상세 정보
        
        # [NEW] Firebase에서 이미 발행된 article_ids 조회
        already_published_ids = set()
        try:
            from src.published_articles import get_published_article_ids, invalidate_cache
            already_published_ids = get_published_article_ids(force_refresh=True)
        except Exception as e:
            print(f"⚠️ [Publish] Failed to load published IDs: {e}")
        
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
                
                # [NEW] 이미 발행된 기사인지 확인
                article_id = staging_data.get('article_id', '')
                if article_id and article_id in already_published_ids:
                    skipped_count += 1
                    skipped_articles.append(article_id)
                    print(f"⏭️ [Publish] Skipped (already published): {article_id}")
                    continue
                
                staging_data['publish_id'] = publish_id
                staging_data['edition_code'] = edition_code
                staging_data['edition_name'] = edition_name
                
                result = save_article(staging_data, source_id=staging_data.get('source_id'), skip_evaluation=True)
                
                if result.get('status') == 'saved':
                    staging_data['published'] = True
                    staging_data['status'] = 'PUBLISHED'
                    staging_data['published_at'] = datetime.now(timezone.utc).isoformat()
                    staging_data['data_file'] = result.get('filename')
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(staging_data, f, ensure_ascii=False, indent=2)
                    
                    published_count += 1
                    
                    article_id = result.get('article_id', staging_data.get('article_id'))
                    published_article_ids.append(article_id)
                    
                    # 로컬 인덱스 파일용 상세 정보 (Firebase 내장 구조)
                    published_articles_detail.append({
                        'id': article_id,
                        'title': staging_data.get('title_ko') or staging_data.get('title'),
                        'title_ko': staging_data.get('title_ko', ''),
                        'title_en': staging_data.get('title', ''),
                        'summary': staging_data.get('summary', ''),
                        'url': staging_data.get('url'),
                        'source_id': staging_data.get('source_id', ''),
                        'zero_echo_score': staging_data.get('zero_echo_score'),
                        'impact_score': staging_data.get('impact_score'),
                        'layout_type': staging_data.get('layout_type', 'Standard'),
                        'tags': staging_data.get('tags', []),
                        'category': staging_data.get('category', '미분류'),
                        'filename': result.get('filename'),
                        'date': result.get('date'),
                        'published_at': staging_data.get('published_at', datetime.now(timezone.utc).isoformat())
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
            'articles': final_article_detail,  # 로컬에는 상세 정보 유지
            'schema_version': '2.0.0' # [NEW] 스키마 버전
        }
        db.save_issue_index_file(index_data)
        
        # Firestore DB (내장형 구조: articles 배열 포함)
        db.update_publication_record(publish_id, {
            'article_count': len(final_article_ids),
            'article_ids': final_article_ids,
            'articles': final_article_detail,  # [NEW] 기사 상세 내장
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'schema_version': '2.0.0' # [NEW] 스키마 버전
        })
        
        # [NEW] 발행 후 캐시 무효화
        try:
            invalidate_cache()
        except Exception as e:
            print(f"⚠️ [Publish] Cache invalidation failed: {e}")
        
        # 응답 메시지 구성
        message = f'{published_count}개 기사 발행 완료 ({edition_name})'
        if skipped_count > 0:
            message += f' / {skipped_count}개 중복 스킵'
        
        return jsonify({
            'success': True,
            'published': published_count,
            'failed': failed_count,
            'skipped': skipped_count,
            'skipped_articles': skipped_articles,
            'publish_id': publish_id,
            'edition_name': edition_name,
            'message': message
        })
    except Exception as e:
        print(f"❌ [Publish] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@publish_bp.route('/api/cache/sync', methods=['POST'])
def cache_sync():
    """
    ☁️ 로컬 캐시 + 크롤링 히스토리를 Firebase에 동기화
    
    - synced_at 필드로 동기화 여부 판단 (Firestore 조회 불필요 = 비용 0)
    - 동기화 후 로컬 파일에 synced_at 마킹
    - 크롤링 히스토리도 함께 동기화
    """
    try:
        from src.db_client import DBClient
        
        db = DBClient()
        if not db.db:
            return jsonify({'success': False, 'error': 'Firestore 연결 실패. serviceAccountKey.json을 확인하세요.'}), 500
        
        data = request.json or {}
        date_str = data.get('date')  # None이면 전체 날짜
        sync_all = date_str is None
        
        synced_count = 0
        skipped_count = 0
        failed_count = 0
        
        # 동기화 대상 폴더 결정
        if date_str:
            date_folders = [date_str] if os.path.exists(os.path.join(CACHE_DIR, date_str)) else []
        else:
            date_folders = [d for d in os.listdir(CACHE_DIR) 
                          if os.path.isdir(os.path.join(CACHE_DIR, d)) and len(d) == 10]
        
        # 날짜별 캐시 동기화
        for date_folder in date_folders:
            cache_date_dir = os.path.join(CACHE_DIR, date_folder)
            cache_list = []
            
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    # synced_at 필드가 있으면 이미 동기화됨 → 스킵 (Firestore 조회 없음!)
                    if cache_data.get('synced_at'):
                        skipped_count += 1
                        continue
                    
                    # article_id 확인
                    article_id = cache_data.get('article_id')
                    if not article_id:
                        article_id = filename.replace('.json', '')
                        cache_data['article_id'] = article_id
                    
                    cache_list.append(cache_data)
                    
                except Exception as e:
                    print(f"⚠️ [Sync] Read error {filename}: {e}")
                    failed_count += 1
            
            # 배치 업로드
            if cache_list:
                result = db.upload_cache_batch(date_folder, cache_list)
                synced_count += result.get('success', 0)
                failed_count += result.get('failed', 0)
                
                # 업로드 성공한 파일에 synced_at 마킹
                synced_at = datetime.now(timezone.utc).isoformat()
                for cache_data in cache_list:
                    article_id = cache_data.get('article_id')
                    if not article_id:
                        continue
                    
                    filepath = os.path.join(cache_date_dir, f"{article_id}.json")
                    if not os.path.exists(filepath):
                        # 해시 기반 파일명 찾기
                        for fn in os.listdir(cache_date_dir):
                            if fn.endswith('.json'):
                                try:
                                    with open(os.path.join(cache_date_dir, fn), 'r', encoding='utf-8') as f:
                                        d = json.load(f)
                                        if d.get('article_id') == article_id:
                                            filepath = os.path.join(cache_date_dir, fn)
                                            break
                                except:
                                    pass
                    
                    if os.path.exists(filepath):
                        try:
                            with open(filepath, 'r', encoding='utf-8') as f:
                                file_data = json.load(f)
                            file_data['synced_at'] = synced_at
                            with open(filepath, 'w', encoding='utf-8') as f:
                                json.dump(file_data, f, ensure_ascii=False, indent=2)
                        except:
                            pass
        
        # 크롤링 히스토리 동기화
        history_count = 0
        try:
            data_dir = os.path.join(os.path.dirname(CACHE_DIR), 'data')
            history_file = os.path.join(data_dir, 'crawling_history.json')
            
            if os.path.exists(history_file):
                with open(history_file, 'r', encoding='utf-8') as f:
                    local_history = json.load(f)
                
                if local_history:
                    result = db.upload_crawling_history(local_history)
                    history_count = result.get('count', 0)
        except Exception as e:
            print(f"⚠️ [Sync] History sync error: {e}")
        
        return jsonify({
            'success': True,
            'synced': synced_count,
            'skipped': skipped_count,
            'failed': failed_count,
            'history_count': history_count,
            'message': f'☁️ 동기화 완료: 캐시 {synced_count}개, 히스토리 {history_count}개 URL'
        })
        
    except Exception as e:
        print(f"❌ [Cache Sync] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@publish_bp.route('/api/publication/config', methods=['GET', 'POST'])
def publication_config():
    """
    📋 발행 설정 조회 및 수정
    GET: 현재 설정 조회
    POST: 다음 호수 수동 설정 { "next_issue_number": N }
    """
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'publication_config.json')
    
    if request.method == 'GET':
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            return jsonify({'success': True, 'config': config})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.json or {}
            
            # 기존 설정 읽기
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            except:
                config = {}
            
            # 업데이트
            if 'next_issue_number' in data:
                config['next_issue_number'] = int(data['next_issue_number'])
            
            config['last_updated'] = datetime.now(timezone.utc).isoformat()
            
            # 저장
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            
            return jsonify({
                'success': True,
                'config': config,
                'message': f"다음 발행 호수가 {config.get('next_issue_number')}호로 설정되었습니다."
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500


@publish_bp.route('/api/firebase/stats')
def firebase_stats():
    """
    🔥 Firebase 사용량 통계 조회
    - 이번 세션의 읽기/쓰기/삭제 횟수
    """
    try:
        from src.db_client import DBClient
        stats = DBClient.get_usage_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publish_bp.route('/api/firebase/stats/reset', methods=['POST'])
def firebase_stats_reset():
    """
    🔄 Firebase 사용량 통계 리셋
    """
    try:
        from src.db_client import DBClient
        DBClient.reset_usage_stats()
        stats = DBClient.get_usage_stats()
        return jsonify({
            'success': True,
            'stats': stats,
            'message': '통계가 리셋되었습니다.'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@publish_bp.route('/api/publication/<publish_id>/update', methods=['POST'])
def update_publication_format(publish_id):
    """
    🔄 회차 데이터 최신 포맷으로 업데이트
    - 로컬 캐시에서 기사 상세 정보를 읽어와 보강
    - 로컬 인덱스 + Firebase 동시 업데이트
    """
    try:
        from src.db_client import DBClient
        
        db = DBClient()
        
        # 1. 현재 회차 정보 조회
        pub_data = db.get_publication(publish_id)
        if not pub_data:
            return jsonify({'success': False, 'error': f'회차 {publish_id}를 찾을 수 없습니다.'}), 404
        
        articles = pub_data.get('articles', [])
        article_ids = pub_data.get('article_ids', [])
        
        # articles 배열이 없으면 article_ids에서 복원
        if not articles and article_ids:
            articles = [{'id': aid} for aid in article_ids]
        
        if not articles:
            return jsonify({'success': False, 'error': '업데이트할 기사가 없습니다.'}), 400
        
        # 2. 로컬 캐시에서 기사 상세 정보 보강
        enriched_articles = []
        enriched_count = 0
        not_found_count = 0
        
        for article in articles:
            article_id = article.get('id', '')
            
            # 이미 summary가 있으면 보강됨
            if article.get('summary') and article.get('zero_echo_score') is not None:
                enriched_articles.append(article)
                continue
            
            # 캐시에서 찾기
            cache_data = find_article_in_cache(article_id)
            
            if cache_data:
                enriched = build_enriched_article(article, cache_data)
                enriched_articles.append(enriched)
                enriched_count += 1
            else:
                # 캐시에 없으면 기존 데이터 유지
                enriched_articles.append(article)
                not_found_count += 1
        
        # 3. 업데이트
        update_data = {
            'articles': enriched_articles,
            'article_count': len(enriched_articles),
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'schema_version': '2.0.0'  # 스키마 버전 기록
        }
        
        # Firebase 업데이트
        db.update_publication_record(publish_id, update_data)
        
        # 로컬 인덱스 업데이트
        index_data = {
            'id': publish_id,
            'edition_code': pub_data.get('edition_code', publish_id),
            'edition_name': pub_data.get('edition_name', ''),
            'published_at': pub_data.get('published_at', ''),
            'date': pub_data.get('date', ''),
            'article_count': len(enriched_articles),
            'articles': enriched_articles
        }
        db.save_issue_index_file(index_data)
        
        return jsonify({
            'success': True,
            'enriched': enriched_count,
            'not_found': not_found_count,
            'total': len(enriched_articles),
            'message': f'{enriched_count}개 기사 보강 완료 ({not_found_count}개 캐시 없음)'
        })
        
    except Exception as e:
        print(f"❌ [Update Format] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def find_article_in_cache(article_id: str) -> dict | None:
    """캐시에서 article_id로 기사 찾기"""
    import glob
    
    if not os.path.exists(CACHE_DIR):
        return None
    
    # 파일명 패턴으로 검색: *_article_id.json 또는 article_id.json
    patterns = [
        os.path.join(CACHE_DIR, '*', f'*{article_id}.json'),
        os.path.join(CACHE_DIR, '*', f'{article_id}.json')
    ]
    
    for pattern in patterns:
        found = glob.glob(pattern)
        if found:
            try:
                with open(found[0], 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # article_id 일치 확인
                    if data.get('article_id') == article_id or article_id in found[0]:
                        return data
            except Exception:
                pass
    
    return None


def build_enriched_article(article: dict, cache_data: dict) -> dict:
    """캐시 데이터로 articles 배열 항목 보강"""
    return {
        'id': article.get('id', ''),
        'title': cache_data.get('title_ko') or cache_data.get('title') or article.get('title', ''),
        'title_ko': cache_data.get('title_ko', ''),
        'title_en': cache_data.get('title', ''),
        'summary': cache_data.get('summary', ''),
        'url': cache_data.get('url') or article.get('url', ''),
        'image_url': cache_data.get('image_url', ''),  # [NEW] 대표 이미지
        'author': cache_data.get('author', ''),        # [NEW] 작성자
        'source_id': cache_data.get('source_id', ''),
        'zero_echo_score': cache_data.get('zero_echo_score'),
        'impact_score': cache_data.get('impact_score'),
        'layout_type': cache_data.get('layout_type', 'Standard'), # 기본값 Standard
        'tags': cache_data.get('tags', []),
        'category': cache_data.get('category', '미분류'),
        'reading_time': cache_data.get('reading_time', 0), # [NEW] 예상 읽기 시간
        'filename': article.get('filename', ''),
        'date': article.get('date', cache_data.get('crawled_at', '')[:10] if cache_data.get('crawled_at') else ''),
        'published_at': cache_data.get('published_at', article.get('published_at', '')),
        # [NEW] 기사 원본 입력 시간 (Real Input Time)
        'origin_published_at': cache_data.get('published_at', ''), 
        # [NEW] 원본 데이터 일부 보존 (필요 시)
        'meta_description': cache_data.get('description', '')
    }


@publish_bp.route('/api/debug/latest_issue')
def debug_latest_issue():
    """🐛 디버그: Firestore의 최신 회차 데이터 원본 조회"""
    try:
        from src.db_client import DBClient
        db = DBClient()
        issues = db.get_issues_from_meta()
        if not issues:
            return jsonify({'error': 'No issues found'})
            
        latest_id = issues[0].get('id') or issues[0].get('edition_code')
        data = db.get_publication(latest_id)
        
        return jsonify({
            'issue_id': latest_id,
            'data': data
        })
    except Exception as e:
        return jsonify({'error': str(e)})


@publish_bp.route('/api/debug/meta')
def debug_meta_doc():
    """🐛 디버그: Firestore _meta 문서 원본 조회"""
    try:
        from src.db_client import DBClient
        db = DBClient()
        meta_ref = db.db.collection('publications').document('_meta')
        meta_doc = meta_ref.get()
        if meta_doc.exists:
            return jsonify(meta_doc.to_dict())
        return jsonify({'error': '_meta not found'})
    except Exception as e:
        return jsonify({'error': str(e)})

