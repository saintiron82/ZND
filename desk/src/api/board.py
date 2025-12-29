# -*- coding: utf-8 -*-
"""
Board API - 칸반 보드 뷰용 API 라우트
"""
from flask import Blueprint, request, jsonify, render_template

from src.core import ArticleManager, ArticleState

board_bp = Blueprint('board', __name__)
manager = ArticleManager()


# =============================================================================
# Views
# =============================================================================

@board_bp.route('/board')
def board_view():
    """칸반 보드 뷰"""
    return render_template('board.html')


# =============================================================================
# API Endpoints
# =============================================================================

@board_bp.route('/api/board/overview', methods=['GET'])
def get_overview():
    """
    전체 상태별 기사 현황 조회 (칸반 보드용)
    
    Query Params:
        limit: 상태별 최대 개수 (default: 50)
        since: ISO 형식 시작 시간 (원본 발간시간 기준 필터)
    
    Returns:
        각 상태별 기사 목록 및 개수
    """
    from datetime import datetime
    
    limit = int(request.args.get('limit', 50))
    since_str = request.args.get('since')
    since_time = None
    
    if since_str:
        try:
            # ISO 형식 파싱
            since_time = datetime.fromisoformat(since_str.replace('Z', '+00:00'))
        except ValueError:
            pass
    
    try:
        overview = {}
        
        # 각 상태별 기사 조회
        states = [
            ArticleState.COLLECTED,
            ArticleState.ANALYZED,
            ArticleState.CLASSIFIED,
            ArticleState.PUBLISHED,
            ArticleState.REJECTED
        ]
        
        for state in states:
            articles = manager.find_by_state(state, limit * 2)  # 필터링 전 여유있게 조회
            
            # 시간 필터 적용 (원본 발간시간 기준)
            if since_time:
                filtered = []
                for a in articles:
                    original = a.get('_original', {})
                    pub_at = original.get('published_at') or original.get('crawled_at')
                    if pub_at:
                        try:
                            if isinstance(pub_at, str):
                                article_time = datetime.fromisoformat(pub_at.replace('Z', '+00:00'))
                            else:
                                article_time = pub_at  # Already datetime
                            if article_time >= since_time:
                                filtered.append(a)
                        except:
                            filtered.append(a)  # 파싱 실패 시 포함
                    else:
                        filtered.append(a)  # 시간 정보 없으면 포함
                articles = filtered[:limit]
            else:
                articles = articles[:limit]
            
            overview[state.value] = {
                'count': len(articles),
                'articles': [_format_article_card(a) for a in articles]
            }
        
        return jsonify({
            'success': True,
            'overview': overview
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@board_bp.route('/api/board/move', methods=['POST'])
def move_article():
    """
    기사를 다른 상태로 이동 (드래그앤드롭)
    
    Body:
        article_id: 이동할 기사 ID
        to_state: 목표 상태
    """
    data = request.get_json()
    article_id = data.get('article_id')
    to_state = data.get('to_state')
    
    if not article_id or not to_state:
        return jsonify({
            'success': False,
            'error': 'article_id and to_state required'
        }), 400
    
    try:
        new_state = ArticleState(to_state)
        
        # REJECTED 상태로 이동 시 폐기 사유 저장
        section_data = None
        if new_state == ArticleState.REJECTED:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            section_data = {
                'reason': 'manual',
                'rejected_at': now,
                'rejected_by': 'desk_user'
            }
        
        success = manager.update_state(article_id, new_state, by='board', section_data=section_data)
        
        return jsonify({
            'success': success,
            'article_id': article_id,
            'new_state': to_state
        })
    
    except ValueError:
        return jsonify({
            'success': False,
            'error': f'Invalid state: {to_state}'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@board_bp.route('/api/article/<article_id>/reset-publication', methods=['POST'])
def reset_publication(article_id: str):
    """
    기사 발행 정보 초기화 (부분 발행 실패 복구용)
    
    - _publication 섹션 삭제
    - 상태를 CLASSIFIED로 되돌림
    """
    from datetime import datetime, timezone
    
    try:
        article = manager.get(article_id)
        if not article:
            return jsonify({
                'success': False,
                'error': 'Article not found'
            }), 404
        
        # Clear _publication data via Firestore update
        now = datetime.now(timezone.utc).isoformat()
        updates = {
            '_header.state': ArticleState.CLASSIFIED.value,
            '_header.updated_at': now,
            '_publication': None  # Clear publication section
        }
        
        success, msg = manager.db.upsert_article_state(article_id, updates)
        
        if success:
            # Also update local cache
            from src.core.article_registry import get_registry
            try:
                registry = get_registry()
                info = registry.get(article_id)
                if info:
                    registry._update_article_state(info, ArticleState.CLASSIFIED.value)
                    registry._update_local_cache(article_id, ArticleState.CLASSIFIED.value, 'reset-pub', now)
            except Exception as e:
                print(f"⚠️ Registry sync failed: {e}")
            
            return jsonify({
                'success': True,
                'article_id': article_id,
                'new_state': ArticleState.CLASSIFIED.value,
                'message': '발행 정보가 초기화되었습니다.'
            })
        else:
            return jsonify({
                'success': False,
                'error': msg
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@board_bp.route('/api/board/classify', methods=['POST'])
def classify_article():
    """
    기사 분류 (Analysis + Classification -> Classified)
    """
    data = request.get_json()
    article_id = data.get('article_id')
    category = data.get('category')
    
    # Optional Analysis Data
    title_ko = data.get('title_ko')
    summary = data.get('summary')
    tags = data.get('tags')
    impact_score = data.get('impact_score')
    
    if not article_id or not category:
        return jsonify({
            'success': False,
            'error': 'article_id and category required'
        }), 400
        
    try:
        # 1. Update Analysis if provided
        if title_ko or summary:
            analysis_data = {
                'title_ko': title_ko,
                'summary': summary,
                'tags': tags or [],
                'impact_score': impact_score or 0,
                'zero_echo_score': 0, 
                'mll_raw': None
            }
            manager.update_analysis(article_id, analysis_data)
        
        # 2. Update Classification and State
        success = manager.update_classification(article_id, category)
        
        return jsonify({
            'success': success,
            'article_id': article_id,
            'state': ArticleState.CLASSIFIED.value
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500





@board_bp.route('/api/board/stats', methods=['GET'])
def get_stats():
    """
    통계 정보 조회
    
    Returns:
        상태별 개수, 오늘 처리량 등
    """
    try:
        stats = {}
        
        states = [
            ArticleState.COLLECTED,
            ArticleState.ANALYZING,
            ArticleState.ANALYZED,
            ArticleState.REJECTED,
            ArticleState.CLASSIFIED,
            ArticleState.PUBLISHED,
            ArticleState.RELEASED
        ]
        
        total = 0
        for state in states:
            articles = manager.find_by_state(state, limit=1000)
            count = len(articles)
            stats[state.value] = count
            total += count
        
        stats['total'] = total
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@board_bp.route('/api/article/<article_id>/raw', methods=['GET'])
def get_article_raw(article_id):
    """
    기사 원본 데이터 조회 (JSON dump용)
    """
    try:
        article = manager.get(article_id)
        if not article:
            return jsonify({
                'success': False,
                'error': 'Article not found'
            }), 404
            
        return jsonify({
            'success': True,
            'article': article
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@board_bp.route('/api/board/context/recent', methods=['GET'])
def get_recent_context():
    """
    최근 발행된(2회차) 기사 목록 조회 (Context용)
    Schema 2.0 flat 구조 지원
    """
    try:
        limit = int(request.args.get('limit', 2)) # Default 2 editions
        
        # 1. Get recent editions
        editions = manager.get_editions(limit=limit)
        
        context_articles = []
        for edition in editions:
            # get_editions returns normalized format with both 'code' and 'edition_code'
            code = edition.get('code') or edition.get('edition_code')
            if code:
                articles = manager.get_edition_articles(code)
                # Format for context (Schema 2.0 flat structure)
                for art in articles:
                    # 2.0 flat structure: direct access to fields
                    context_articles.append({
                        'id': art.get('id') or art.get('article_id'),
                        'title': art.get('title_ko') or art.get('title', ''),
                        'summary': art.get('summary', ''),
                        'category': art.get('category', ''),
                        'edition_code': code,
                        'published_at': edition.get('updated_at') or edition.get('published_at')
                    })
        
        return jsonify({
            'success': True,
            'articles': context_articles
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@board_bp.route('/api/board/column-action', methods=['POST'])
def column_action():
    """
    컬럼 전체 작업 수행 (전체 분석, 전체 폐기 등)
    
    Body:
        state: 현재 상태 (collected, analyzed, classified, published, rejected)
        action: 수행할 작업 (analyze-all, classify-all, publish-all, reject-all, empty-trash, restore-all)
    """
    data = request.get_json()
    state = data.get('state')
    action = data.get('action')
    
    if not state or not action:
        return jsonify({
            'success': False,
            'error': 'state and action required'
        }), 400
    
    try:
        # 해당 상태의 모든 기사 조회 (소문자 -> 대문자 변환)
        state_enum = ArticleState(state.upper())
        articles = manager.find_by_state(state_enum, limit=500)
        
        count = 0
        message = ''
        
        # 작업 수행
        if action == 'reject-all':
            # 전체 폐기
            for art in articles:
                aid = art.get('_header', {}).get('article_id')
                if aid:
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc).isoformat()
                    manager.update_state(aid, ArticleState.REJECTED, by='column-action', 
                                        section_data={
                                            'reason': 'manual',
                                            'rejected_at': now,
                                            'rejected_by': 'desk_user'
                                        })
                    count += 1
            message = f'{count}개 기사 폐기 완료'
            
        elif action == 'restore-all':
            # 전체 복원 (rejected -> analyzed)
            for art in articles:
                aid = art.get('_header', {}).get('article_id')
                if aid:
                    manager.update_state(aid, ArticleState.ANALYZED, by='column-action')
                    count += 1
            message = f'{count}개 기사 복원 완료'
            
        elif action == 'empty-trash':
            # 휴지통 비우기 (영구 삭제)
            for art in articles:
                aid = art.get('_header', {}).get('article_id')
                if aid:
                    manager.delete(aid)
                    count += 1
            message = f'{count}개 기사 영구 삭제 완료'
            
        elif action == 'analyze-all':
            # 전체 분석 - MLL 필요하므로 일단 메시지만 반환
            message = f'전체 분석 기능은 Inspector를 사용해주세요 (현재 {len(articles)}개)'
            
        elif action == 'recalculate-scores':
            # 점수 재계산 (mll_raw 데이터가 있는 경우)
            from src.core.score_engine import process_raw_analysis
            
            scanned = 0
            updated = 0
            
            for art in articles:
                aid = art.get('_header', {}).get('article_id')
                analysis = art.get('_analysis') or {}
                mll_raw = analysis.get('mll_raw')
                old_score = analysis.get('impact_score')
                
                if aid and mll_raw:
                    scanned += 1
                    # 점수 재계산
                    recalc = process_raw_analysis(mll_raw)
                    new_score = recalc.get('impact_score')
                    
                    if new_score is not None:
                        # 분석 데이터 업데이트
                        update_data = {
                            'impact_score': new_score,
                            'zero_echo_score': recalc.get('zero_echo_score', 5.0),
                            'impact_evidence': recalc.get('impact_evidence', {}),
                            'evidence': recalc.get('evidence', {})
                        }
                        
                        # Only update if changed or force update requested (currently always update for consistency)
                        # But count as 'updated' essentially. To be strict about "changed":
                        if old_score != new_score:
                             updated += 1
                        
                        manager.update_analysis(aid, update_data)
                        count += 1 # Total Processed count for generic message
            
            message = f'재계산 완료: 총 {scanned}개 검사, {updated}개 점수 변동됨 (전체 처리: {count}개)'
            
        elif action == 'classify-all':
            # 전체 분류 - 분류 모달 필요하므로 메시지만 반환
            message = f'전체 분류 기능은 📂분류 버튼을 사용해주세요 (현재 {len(articles)}개)'
            
        elif action == 'publish-all':
            # 전체 발행 - 발행 페이지로 안내
            message = f'전체 발행은 발행 페이지에서 수행해주세요 (현재 {len(articles)}개)'
            
        elif action == 'release-all':
            # 전체 공개 - 발행 페이지로 안내
            message = f'전체 공개는 발행 페이지에서 수행해주세요 (현재 {len(articles)}개)'
            
        else:
            return jsonify({
                'success': False,
                'error': f'Unknown action: {action}'
            }), 400
        
        return jsonify({
            'success': True,
            'message': message,
            'count': count
        })
        
    except ValueError:
        return jsonify({
            'success': False,
            'error': f'Invalid state: {state}'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500



@board_bp.route('/api/board/send-back', methods=['POST'])
def send_back_articles():
    """
    기사들을 이전 단계로 되돌림
    
    Body:
        article_ids: list[str]
        current_state: str (collected, analyzed, classified, published, rejected)
    """
    data = request.get_json()
    article_ids = data.get('article_ids', [])
    current_state_str = data.get('current_state')
    target_state_str = data.get('target_state')
    
    if not article_ids or not current_state_str:
        return jsonify({
            'success': False,
            'error': 'article_ids and current_state required'
        }), 400
        
    try:
        current_state = ArticleState(current_state_str.upper())
        target_state = None
        
        if target_state_str:
            target_state = ArticleState(target_state_str.upper())
        else:
            # Default fallback (one step back)
            if current_state == ArticleState.PUBLISHED:
                target_state = ArticleState.CLASSIFIED
            elif current_state == ArticleState.CLASSIFIED:
                target_state = ArticleState.ANALYZED
            elif current_state == ArticleState.ANALYZED:
                target_state = ArticleState.COLLECTED
            elif current_state == ArticleState.REJECTED:
                target_state = ArticleState.ANALYZED 
            else:
                return jsonify({
                    'success': False,
                    'error': f'Cannot send back from state: {current_state}'
                }), 400
            
        count = 0
        errors = 0
        
        for aid in article_ids:
            if manager.update_state(aid, target_state, by='board-send-back'):
                count += 1
            else:
                errors += 1
                
        return jsonify({
            'success': True,
            'processed': count,
            'errors': errors,
            'target_state': target_state.value
        })
        
    except ValueError:
        return jsonify({
            'success': False,
            'error': f'Invalid state: {current_state_str}'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# =============================================================================
# Helper Functions
# =============================================================================

def _format_article_card(article: dict) -> dict:
    """
    칸반 카드용 간략 형식 
    - 상세화면과 동일한 데이터를 사용하도록 보장
    - 불완전한 데이터면 manager.get()으로 재조회
    """
    from src.core.schema_adapter import SchemaAdapter
    
    # 데이터 완전성 검사
    original = article.get('_original', {})
    if not original.get('url'):
        # 불완전한 데이터 - manager.get()으로 재조회
        article_id = article.get('_header', {}).get('article_id') or article.get('id')
        if article_id:
            complete_article = manager.get(article_id)
            if complete_article:
                article = complete_article
    
    adapter = SchemaAdapter(article, auto_upgrade=True)
    return adapter.to_card_format()










# =============================================================================
# Unlinked Article Recovery API (발행이력없는 기사 복구)
# =============================================================================

@board_bp.route('/api/board/orphans', methods=['GET'])
def get_orphan_articles():
    """
    발행이력없는 기사 목록 조회
    발행 회차(edition)에 없는 PUBLISHED 상태 기사들
    """
    try:
        # 1. 유효한 발행 회차 목록 조회
        valid_editions = set()
        meta = manager.db.get_publications_meta()
        if meta:
            for issue in meta.get('issues', []):
                code = issue.get('edition_code') or issue.get('code')
                if code:
                    valid_editions.add(code)
        
        # 2. PUBLISHED 기사 조회
        published = manager.find_by_state(ArticleState.PUBLISHED, limit=500)
        
        # 3. 발행이력없는 기사 필터링
        unlinked = []
        for article in published:
            pub = article.get('_publication') or {}
            edition_code = pub.get('edition_code')
            
            if not edition_code or edition_code not in valid_editions:
                unlinked.append(_format_article_card(article))
        
        return jsonify({
            'success': True,
            'orphans': unlinked,  # API 응답 키는 유지 (JS 호환성)
            'count': len(unlinked),
            'valid_editions': list(valid_editions)
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@board_bp.route('/api/board/recover-orphans', methods=['POST'])
def recover_orphan_articles():
    """
    발행이력없는 기사 복구 (PUBLISHED -> CLASSIFIED)
    """
    from datetime import datetime, timezone
    
    data = request.get_json()
    article_ids = data.get('article_ids', [])
    recover_all = data.get('recover_all', False)
    
    try:
        # recover_all이면 고아 목록 자동 조회
        if recover_all:
            valid_editions = set()
            meta = manager.db.get_publications_meta()
            if meta:
                for issue in meta.get('issues', []):
                    code = issue.get('edition_code') or issue.get('code')
                    if code:
                        valid_editions.add(code)
            
            published = manager.find_by_state(ArticleState.PUBLISHED, limit=500)
            article_ids = []
            for article in published:
                pub = article.get('_publication') or {}
                edition_code = pub.get('edition_code')
                if not edition_code or edition_code not in valid_editions:
                    article_ids.append(article.get('_header', {}).get('article_id'))
        
        if not article_ids:
            return jsonify({
                'success': False,
                'error': 'No articles to recover'
            }), 400
        
        # 복구 실행
        recovered = []
        failed = []
        
        for article_id in article_ids:
            try:
                success = manager.update_state(
                    article_id,
                    ArticleState.CLASSIFIED,
                    by='orphan_recovery',
                    section_data={
                        'edition_code': None,
                        'edition_name': None,
                        'published_at': None,
                        'released_at': None
                    }
                )
                if success:
                    recovered.append(article_id)
                else:
                    failed.append(article_id)
            except Exception as e:
                print(f"⚠️ Recovery failed for {article_id}: {e}")
                failed.append(article_id)
        
        return jsonify({
            'success': True,
            'recovered': recovered,
            'recovered_count': len(recovered),
            'failed': failed,
            'failed_count': len(failed)
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
