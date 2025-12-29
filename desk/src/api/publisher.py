# -*- coding: utf-8 -*-
"""
Publisher API - 발행 뷰용 API 라우트
"""
import os
from datetime import datetime, timezone
import json
from flask import Blueprint, request, jsonify, render_template, Response, stream_with_context

from src.core import ArticleManager, ArticleState

publisher_bp = Blueprint('publisher', __name__)
manager = ArticleManager()


# =============================================================================
# Views
# =============================================================================

@publisher_bp.route('/publisher')
def publisher_view():
    """발행 뷰"""
    import time
    return render_template('publisher.html', now_ts=int(time.time()))


# =============================================================================
# API Endpoints
# =============================================================================

@publisher_bp.route('/api/publisher/list', methods=['GET'])
def list_articles():
    """
    발행 대상 기사 목록 조회 (Article Registry 사용)
    
    Query params:
        state: 상태 필터 (comma-separated, e.g., 'classified,rejected')
        limit: 최대 개수 (기본 100)
    """
    from src.core.article_registry import get_registry
    
    state_filter = request.args.get('state')
    limit = int(request.args.get('limit', 100))
    
    try:
        registry = get_registry()
        
        if not registry.is_initialized():
            # Fallback to manager if registry not ready
            return _list_articles_fallback(state_filter, limit)
        
        if state_filter:
            # Comma-separated support
            if ',' in state_filter:
                states = [s.strip().upper() for s in state_filter.split(',')]
                articles = registry.find_by_states(states, limit)
            else:
                articles = registry.find_by_state(state_filter.upper(), limit)
        else:
            # 기본: ANALYZED + CLASSIFIED 모두 조회
            articles = registry.find_by_states(['ANALYZED', 'CLASSIFIED'], limit)
        
        result = []
        for article in articles:
            # [Fix] Registry 정보는 경량화되어 있으므로 Full Data 로드 (Board와 동일한 패턴)
            full_data = manager.get(article.article_id)
            if full_data:
                from src.core.schema_adapter import SchemaAdapter
                adapter = SchemaAdapter(full_data, auto_upgrade=True)
                result.append(adapter.to_publisher_format())
            else:
                # Fallback
                result.append({
                    'article_id': article.article_id,
                    'title': article.title,
                    'state': article.state,
                    'summary': "데이터 없음",
                    'source_id': article.source_id,
                    # 최소한의 필수 필드 채움
                    'category': article.category,
                    'impact_score': article.impact_score,
                    'zero_echo_score': article.zero_echo_score,
                    'updated_at': article.updated_at
                })

        return jsonify({
            'success': True,
            'articles': result,
            'count': len(result),
            'source': 'registry'
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def _list_articles_fallback(state_filter, limit):
    """Registry 미초기화 시 기존 방식 사용"""
    if state_filter:
        if ',' in state_filter:
            states = [s.strip().upper() for s in state_filter.split(',')]
            articles = []
            for s in states:
                try:
                    state_enum = ArticleState(s)
                    articles.extend(manager.find_by_state(state_enum, limit))
                except ValueError:
                    continue
        else:
            state = ArticleState(state_filter.upper())
            articles = manager.find_by_state(state, limit)
    else:
        analyzed = manager.find_by_state(ArticleState.ANALYZED, limit)
        classified = manager.find_by_state(ArticleState.CLASSIFIED, limit)
        articles = analyzed + classified
    
    result = []
    from src.core.schema_adapter import SchemaAdapter
    for article in articles:
        adapter = SchemaAdapter(article, auto_upgrade=True)
        result.append(adapter.to_publisher_format())
    
    return jsonify({
        'success': True,
        'articles': result,
        'count': len(result),
        'source': 'fallback'
    })


@publisher_bp.route('/api/publisher/classify', methods=['POST'])
def classify_articles():
    """
    기사 분류 (카테고리 지정)
    
    Body:
        article_ids: 분류할 기사 ID 목록
        category: 카테고리 이름
    """
    data = request.get_json()
    article_ids = data.get('article_ids', [])
    category = data.get('category', 'Uncategorized')
    
    if not article_ids:
        return jsonify({
            'success': False,
            'error': 'article_ids required'
        }), 400
    
    results = []
    for article_id in article_ids:
        success = manager.update_classification(article_id, category)
        results.append({
            'article_id': article_id,
            'success': success
        })
    
    return jsonify({
        'success': True,
        'results': results
    })


@publisher_bp.route('/api/publisher/reject', methods=['POST'])
def reject_articles():
    """
    기사 일괄 폐기 (Publisher Cutline용)
    """
    data = request.get_json()
    article_ids = data.get('article_ids', [])
    reason = data.get('reason', 'publisher_cutline')
    
    if not article_ids:
        return jsonify({
            'success': False,
            'error': 'article_ids required'
        }), 400
    
    results = []
    for article_id in article_ids:
        success = manager.reject(article_id, reason, by='publisher')
        results.append({
            'article_id': article_id,
            'success': success
        })
    
    return jsonify({
        'success': True,
        'results': results
    })


@publisher_bp.route('/api/publisher/next-edition', methods=['GET'])
def get_next_edition():
    """
    다음 발행 회차 정보 제안
    """
    # 1. 최근 발행 회차 조회
    editions = manager.get_editions(limit=1)
    
    now = datetime.now(timezone.utc)
    # KST 보정 (UTC+9) - 단순화: 9시간 더함
    # 실제 프로덕션에서는 pytz 사용 권장하지만, 외부 의존성 최소화
    from datetime import timedelta
    now_kst = now + timedelta(hours=9)
    date_str = now_kst.strftime('%y%m%d')
    
    next_code = f"{date_str}_1"
    next_name = "제1호"
    
    if editions:
        last = editions[0]
        last_code = last.get('edition_code') or last.get('code')
        last_name = last.get('edition_name') or last.get('name')
        
        # Code Logic (YYMMDD_Index) - 날짜는 오늘, 인덱스는 마지막+1
        if last_code and '_' in last_code:
            parts = last_code.split('_')
            try:
                last_idx = int(parts[1])
                # 날짜와 상관없이 마지막 인덱스 + 1
                next_code = f"{date_str}_{last_idx + 1}"
                
                # Name Logic: 마지막 호수 + 1
                if last_name:
                    import re
                    match = re.search(r'(\d+)', last_name)
                    if match:
                        last_num = int(match.group(1))
                        next_name = f"제{last_num + 1}호"

            except ValueError:
                # 파싱 실패시 기본값
                next_code = f"{date_str}_1"
                next_name = "제1호"
    
    edition_name_format = os.getenv('EDITION_NAME_FORMAT', '제{N}호')

    return jsonify({
        'success': True,
        'next_edition_code': next_code,
        'next_edition_name': next_name,
        'edition_name_format': edition_name_format
    })


@publisher_bp.route('/api/publisher/publish', methods=['POST'])
def publish_articles():
    """
    기사 발행 (Streaming Response)
    """
    data = request.get_json()
    article_ids = data.get('article_ids', [])
    edition_code = data.get('edition_code')
    edition_name = data.get('edition_name')
    
    print(f"🚀 [Publish API] Request received: {len(article_ids)} articles, Edition: {edition_code} ({edition_name})")
    
    if not article_ids:
        return jsonify({'success': False, 'error': 'article_ids required'}), 400
    
    if not edition_code:
        now = datetime.now(timezone.utc)
        date_str = now.strftime('%y%m%d')
        edition_code = f"{date_str}_1"
        edition_name = "1호"

    def generate():
        total = len(article_ids)
        current = 0
        success_count = 0
        
        # Initial status
        yield json.dumps({'status': 'processing', 'current': 0, 'total': total, 'message': '발행 준비 중...'}) + '\n'
        
        for article_id in article_ids:
            current += 1
            yield json.dumps({
                'status': 'processing', 
                'current': current, 
                'total': total, 
                'message': f'기사 처리 중 ({current}/{total}): {article_id}'
            }) + '\n'
            
            try:
                success = manager.publish(article_id, edition_code, edition_name)
                if success:
                    success_count += 1
                
                yield json.dumps({
                    'status': 'processing', 
                    'current': current, 
                    'total': total, 
                    'message': f'✅ 저장 완료: {article_id}' if success else f'❌ 실패: {article_id}'
                }) + '\n'
            except Exception as e:
                print(f"ERROR publishing {article_id}: {e}")
                yield json.dumps({
                    'status': 'processing', 
                    'current': current, 
                    'total': total, 
                    'message': f'❌ 에러: {str(e)}'
                }) + '\n'

        # Batch Record
        yield json.dumps({'status': 'processing', 'current': total, 'total': total, 'message': '회차 정보 저장 중...'}) + '\n'
        try:
            manager.db.save_publication(edition_code, {
                'edition_code': edition_code,
                'edition_name': edition_name,
                'published_at': datetime.now(timezone.utc).isoformat(),
                'article_count': len(article_ids)
            })
        except Exception as e:
            print(f"ERROR saving publication record: {e}")

        # Final Yield
        yield json.dumps({
            'status': 'completed', 
            'success_count': success_count,
            'edition_code': edition_code,
            'edition_name': edition_name
        }) + '\n'

    return Response(stream_with_context(generate()), mimetype='application/json')


@publisher_bp.route('/api/publisher/release', methods=['POST'])
def release_edition():
    """
    회차 정식 발행 (Release)
    Preview 상태의 회차를 Released 상태로 변경하고,
    소속된 기사들도 모두 RELEASED 상태로 변경함.
    """
    data = request.get_json()
    code = data.get('code') or data.get('edition_code')
    
    if not code:
        return jsonify({'success': False, 'error': 'Missing edition code'}), 400
        
    result = manager.release_edition(code)
    
    if result.get('success'):
        return jsonify(result)
    else:
        return jsonify(result), 400


@publisher_bp.route('/api/publisher/edition/<code_or_id>', methods=['DELETE'])
def delete_edition(code_or_id):
    """
    회차 파기 (Unpublish/Rollback)
    - 회차 정보 삭제
    - 기사 상태 CLASSIFIED로 원복
    """
    if not code_or_id:
        return jsonify({'success': False, 'error': 'Missing code'}), 400
        
    result = manager.delete_edition(code_or_id)
    
    if result.get('success'):
         return jsonify(result)
    else:
         return jsonify(result), 400


@publisher_bp.route('/api/publisher/editions', methods=['GET'])
def list_editions():
    """발행 회차 목록 조회"""
    limit = int(request.args.get('limit', 20))
    print(f"DEBUG: manager type: {type(manager)}")
    print(f"DEBUG: manager dir: {dir(manager)}")
    editions = manager.get_editions(limit)
    return jsonify({
        'success': True,
        'env': manager.db.get_env_name(),
        'edition_name_format': os.getenv('EDITION_NAME_FORMAT', '{N}호'),
        'editions': editions
    })


@publisher_bp.route('/api/publisher/edition/<edition_code>', methods=['GET'])
def get_edition_detail(edition_code):
    """
    특정 회차 기사 목록 조회
    PUBLISHED 기사는 Registry에 캐싱됨 (한 번 읽으면 메모리에서 제공)
    """
    from src.core.article_registry import get_registry
    
    registry = get_registry()
    
    # 1. Try Registry cache first (PUBLISHED articles are immutable)
    if registry.is_initialized():
        cached_articles = registry.get_by_edition(edition_code)
        if cached_articles:
            print(f"✅ [Edition] Cache hit: {edition_code} ({len(cached_articles)} articles)")
            result = []
            for article in cached_articles:
                # Fetch full data to support rich rendering (summary, tags, etc)
                full_data = manager.get(article.article_id)
                if full_data:
                    from src.core.schema_adapter import SchemaAdapter
                    adapter = SchemaAdapter(full_data, auto_upgrade=True)
                    result.append(adapter.to_publisher_format())
                else:
                    # Fallback if full data missing (should be rare)
                    result.append({
                        'article_id': article.article_id,
                        'title': article.title,
                        'source_id': article.source_id,
                        'state': article.state,
                        'category': article.category,
                        'impact_score': article.impact_score,
                        'zero_echo_score': article.zero_echo_score,
                        'summary': "데이터 없음"
                    })
            return jsonify({
                'success': True,
                'edition_code': edition_code,
                'articles': result,
                'count': len(result),
                'source': 'cache'
            })
    
    # 2. Fallback to DB
    print(f"📡 [Edition] Cache miss, fetching from DB: {edition_code}")
    articles = manager.get_edition_articles(edition_code)
    
    # 3. Cache to Registry for future requests
    if registry.is_initialized() and articles:
        for article in articles:
            registry.register(article)
        print(f"💾 [Edition] Cached {len(articles)} articles to Registry")
    
    # 포맷팅
    result = []
    for article in articles:
        # [Fix] Snapshot 데이터가 불완전할 수 있으므로 ID 추출 후 Full Data 로드
        # Snapshot에서 ID 찾기 시도 (article_id or id or _header.article_id)
        art_id = article.get('article_id') or article.get('id')
        if not art_id and '_header' in article:
            art_id = article['_header'].get('article_id')
            
        full_data = None
        if art_id:
            full_data = manager.get(art_id)
            
        if full_data:
            from src.core.schema_adapter import SchemaAdapter
            adapter = SchemaAdapter(full_data, auto_upgrade=True)
            result.append(adapter.to_publisher_format())
        else:
            # Fallback: Snapshot 그대로 사용 (데이터가 정말 없을 경우)
            from src.core.schema_adapter import SchemaAdapter
            adapter = SchemaAdapter(article, auto_upgrade=True)
            result.append(adapter.to_publisher_format())
        
    return jsonify({
        'success': True,
        'edition_code': edition_code,
        'articles': result,
        'count': len(result),
        'source': 'db'
    })


@publisher_bp.route('/api/publisher/release', methods=['POST'])
def release_articles():
    """
    발행된 기사 공개 (Web에 노출)
    
    Body:
        edition_code: 공개할 회차 코드
    """
    data = request.get_json()
    edition_code = data.get('edition_code')
    
    if not edition_code:
        return jsonify({
            'success': False,
            'error': 'edition_code required'
        }), 400
    
    # [Fix] Use Manager's release_edition to ensure Meta is updated
    result = manager.release_edition(edition_code)
    
    if result.get('success'):
        return jsonify(result)
    else:
        return jsonify(result), 400




