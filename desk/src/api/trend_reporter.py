# -*- coding: utf-8 -*-
"""
Trend Reporter API - 주간 트렌드 리포트 생성용 API
"""
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from collections import Counter

from src.core.article_manager import ArticleManager
from src.core_logic import get_kst_now

trend_reporter_bp = Blueprint('trend_reporter', __name__)
manager = ArticleManager()


# =============================================================================
# API Endpoints
# =============================================================================

@trend_reporter_bp.route('/api/trend-reporter/generate-prompt', methods=['GET'])
def generate_trend_prompt():
    """
    지정 기간의 발행 기사를 모아서 LLM 분석용 프롬프트 생성
    
    Query params:
        start: 시작 날짜 (YYYY-MM-DD)
        end: 종료 날짜 (YYYY-MM-DD)
        days: start/end 없을 경우 최근 N일 (기본 7일)
    
    Returns:
        prompt_text: LLM에 전달할 프롬프트 텍스트
        article_count: 포함된 기사 수
        tag_stats: 태그별 빈도
    """
    try:
        # 날짜 범위 파싱
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        
        if start_str and end_str:
            # 직접 날짜 지정
            start_date = datetime.strptime(start_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            end_date = datetime.strptime(end_str, '%Y-%m-%d').replace(tzinfo=timezone.utc) + timedelta(days=1)  # 종료일 포함
        else:
            # 기존 days 파라미터 사용
            days = int(request.args.get('days', 7))
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
        
        # 1. 최근 발행된 회차 목록 조회
        editions = manager.get_editions(limit=50)  # 넉넉하게 조회
        
        # 2. 기간 내 회차 필터링
        filtered_editions = []
        for ed in editions:
            pub_at = ed.get('published_at', '')
            if pub_at:
                try:
                    # ISO 형식 파싱
                    if isinstance(pub_at, str):
                        pub_dt = datetime.fromisoformat(pub_at.replace('Z', '+00:00'))
                    else:
                        pub_dt = pub_at
                    
                    if start_date <= pub_dt <= end_date:
                        filtered_editions.append(ed)
                except:
                    pass
        
        # 3. 해당 회차들의 기사 수집
        all_articles = []
        for ed in filtered_editions:
            edition_code = ed.get('edition_code') or ed.get('code')
            if edition_code:
                articles = manager.get_edition_articles(edition_code)
                all_articles.extend(articles)
        
        if not all_articles:
            return jsonify({
                'success': False,
                'error': f'최근 {days}일 내 발행된 기사가 없습니다.'
            })
        
        # 4. 태그 빈도 집계
        tag_counter = Counter()
        for art in all_articles:
            tags = art.get('tags') or []
            if isinstance(tags, list):
                tag_counter.update(tags)
        
        # 5. 기사 목록 포맷팅
        article_entries = []
        for idx, art in enumerate(all_articles, 1):
            title_ko = art.get('title_ko') or art.get('_analysis', {}).get('title_ko') or art.get('title', '')
            summary = art.get('summary') or art.get('_analysis', {}).get('summary') or ''
            tags = art.get('tags') or art.get('_analysis', {}).get('tags') or []
            date = art.get('date') or art.get('published_at', '')[:10] if art.get('published_at') else ''
            
            if isinstance(tags, list):
                tags_str = ', '.join(tags)
            else:
                tags_str = str(tags)
            
            entry = f"{idx}. 제목: {title_ko}\n   요약: {summary[:200]}{'...' if len(summary) > 200 else ''}\n   태그: {tags_str}\n   날짜: {date}"
            article_entries.append(entry)
        
        # 6. 태그 통계 포맷팅
        top_tags = tag_counter.most_common(10)
        tag_stats_lines = [f"- {tag}: {count}건" for tag, count in top_tags]
        
        # 7. 프롬프트 생성
        start_str = start_date.strftime('%Y-%m-%d')
        end_str = (end_date - timedelta(days=1)).strftime('%Y-%m-%d')  # end_date에서 +1일 했으므로 원복
        
        prompt_text = f"""아래는 {start_str} ~ {end_str} 기간 동안 수집된 AI 뉴스 기사 요약 목록입니다.
이 데이터를 분석하여 주간 트렌드 리포트를 작성해주세요.

---
[기사 목록]

{chr(10).join(article_entries)}

---
[태그별 빈도]
{chr(10).join(tag_stats_lines)}

---
위 정보를 바탕으로 JSON 형식의 주간 트렌드 리포트를 작성해주세요.

출력 형식:
{{
  "report_period": {{ "start": "{start_str}", "end": "{end_str}" }},
  "top_trends": [
    {{
      "rank": 1,
      "topic": "트렌드 주제",
      "tags": ["관련태그"],
      "article_count": 0,
      "summary": "분석 요약",
      "key_players": ["주요 기업/기관"]
    }}
  ],
  "weekly_insight": "이번 주 핵심 인사이트...",
  "next_week_outlook": "다음 주 전망..."
}}"""

        return jsonify({
            'success': True,
            'prompt_text': prompt_text,
            'system_prompt': """당신은 AI 뉴스 트렌드 분석 전문가입니다.

주어진 기사 목록을 분석하여:
1. 이번 주 핵심 트렌드 TOP 5를 도출합니다
2. 각 트렌드에 대한 간결한 분석을 제공합니다
3. 다음 주 전망을 예측합니다

응답은 반드시 JSON 형식으로 제공하세요.""",
            'article_count': len(all_articles),
            'edition_count': len(filtered_editions),
            'tag_stats': dict(tag_counter),  # 전체 태그 카운트 (저장용)
            'period': {
                'start': start_str,
                'end': end_str
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# =============================================================================
# Report Save/List/Get API
# =============================================================================

@trend_reporter_bp.route('/api/trend-reporter/save', methods=['POST'])
def save_trend_report():
    """
    LLM 분석 결과를 Firestore에 저장
    
    Body: JSON (top_trends, weekly_insight, next_week_outlook, period)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # 리포트 ID 생성 (날짜 범위 기반: 2026-01-02_2026-01-09)
        period = data.get('period', {})
        start_date = period.get('start', '')
        end_date = period.get('end', '')
        
        if start_date and end_date:
            report_id = f"{start_date}_{end_date}"
        else:
            # Fallback: 현재 시점 기반
            now = datetime.now(timezone.utc)
            report_id = now.strftime('%Y-%m-%d_%H%M')
        
        # 저장할 데이터 구성
        tag_stats = data.get('tag_stats', {})
        
        # 태그 순위 리스트 생성 (변동 추적용)
        tag_rankings = []
        sorted_tags = sorted(tag_stats.items(), key=lambda x: x[1], reverse=True)
        for rank, (tag, count) in enumerate(sorted_tags, 1):
            tag_rankings.append({
                'rank': rank,
                'tag': tag,
                'count': count
            })
        
        report_doc = {
            'id': report_id,
            'top_trends': data.get('top_trends', []),
            'weekly_insight': data.get('weekly_insight', ''),
            'next_week_outlook': data.get('next_week_outlook', ''),
            'period': period,
            'tag_stats': tag_stats,
            'tag_rankings': tag_rankings,  # 순위별 태그 리스트
            'created_at': get_kst_now(),
            'updated_at': get_kst_now()
        }
        
        # Firestore에 저장
        from src.core.firestore_client import FirestoreClient
        db = FirestoreClient()
        db.save_trend_report(report_id, report_doc)
        
        return jsonify({
            'success': True,
            'report_id': report_id,
            'message': f'리포트 저장 완료: {report_id}'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@trend_reporter_bp.route('/api/trend-reporter/list', methods=['GET'])
def list_trend_reports():
    """
    저장된 리포트 목록 조회
    """
    try:
        from src.core.firestore_client import FirestoreClient
        db = FirestoreClient()
        reports = db.list_trend_reports()
        
        return jsonify({
            'success': True,
            'reports': reports
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@trend_reporter_bp.route('/api/trend-reporter/get/<report_id>', methods=['GET'])
def get_trend_report(report_id: str):
    """
    특정 리포트 상세 조회
    """
    try:
        from src.core.firestore_client import FirestoreClient
        db = FirestoreClient()
        report = db.get_trend_report(report_id)
        
        if report:
            return jsonify({
                'success': True,
                'report': report
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Report not found: {report_id}'
            }), 404
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@trend_reporter_bp.route('/api/trend-reporter/delete/<report_id>', methods=['DELETE'])
def delete_trend_report(report_id: str):
    """
    리포트 삭제
    """
    try:
        from src.core.firestore_client import FirestoreClient
        db = FirestoreClient()
        success = db.delete_trend_report(report_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Report deleted: {report_id}'
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Failed to delete: {report_id}'
            }), 500
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# =============================================================================
# View Route
# =============================================================================

@trend_reporter_bp.route('/trend-report')
def trend_report_view():
    """주간 트렌드 리포트 뷰"""
    from flask import render_template
    return render_template('trend_report.html')
