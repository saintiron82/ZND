# -*- coding: utf-8 -*-
"""
자동화 파이프라인 API (Automation Pipeline)
- 수집(Collect), 추출(Extract), 분석(Analyze), 조판(Stage), 발행(Publish)
"""
import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify

# 공유 모듈 import
from crawler import load_targets, fetch_links
from src.db_client import DBClient
from src.crawler.core import AsyncCrawler
from src.core_logic import (
    load_from_cache as _core_load_from_cache,
    save_to_cache as _core_save_to_cache,
    normalize_field_names as _core_normalize_field_names,
)

automation_bp = Blueprint('automation', __name__)

# 공유 인스턴스
db = DBClient()
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cache')


def load_from_cache(url):
    """캐시에서 URL 데이터 로드"""
    return _core_load_from_cache(url)


def save_to_cache(url, content):
    """캐시에 URL 데이터 저장"""
    return _core_save_to_cache(url, content)


def normalize_field_names(data):
    """필드명 정규화"""
    return _core_normalize_field_names(data)


@automation_bp.route('/api/automation/collect', methods=['POST'])
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


@automation_bp.route('/api/automation/extract', methods=['POST'])
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


@automation_bp.route('/api/automation/analyze', methods=['POST'])
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


@automation_bp.route('/api/automation/stage', methods=['POST'])
def automation_stage():
    """
    4️⃣ 조판 (Staging): 분석 완료된 캐시 점수 재검증 및 고노이즈 필터링
    - 이제 cache가 조판 역할을 동시에 수행 (별도 staging 폴더 없음)
    - 점수 재검증 + 고노이즈 자동 거부 처리
    """
    try:
        from src.score_engine import process_raw_analysis
        
        staged_count = 0
        skipped_count = 0
        
        # 최근 3일치 캐시 스캔
        for i in range(3):
            scan_date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            cache_date_dir = os.path.join(CACHE_DIR, scan_date)
            
            if not os.path.exists(cache_date_dir):
                continue

            print(f"🕵️ [Stage] Scanning cache folder: {scan_date}")

            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    # 분석 안 된 것은 스킵
                    is_analyzed = (
                        cache_data.get('mll_status') == 'analyzed' or
                        cache_data.get('raw_analysis') is not None or
                        cache_data.get('zero_echo_score') is not None
                    )
                    if not is_analyzed:
                        skipped_count += 1
                        continue
                    
                    # 이미 processed (staged) 처리된 것은 스킵
                    if cache_data.get('staged'):
                        skipped_count += 1
                        continue
                    
                    # 이미 발행된 것은 스킵
                    if cache_data.get('published'):
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
                    
                    # staged 표시 및 저장
                    cache_data['staged'] = True
                    cache_data['staged_at'] = datetime.now(timezone.utc).isoformat()
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(cache_data, f, ensure_ascii=False, indent=2)
                    
                    staged_count += 1
                    
                except Exception as e:
                    print(f"⚠️ [Stage] Error on {filename}: {e}")
        
        print(f"📋 [Stage] 조판: {staged_count}, 스킵: {skipped_count}")
        return jsonify({
            'success': True,
            'staged': staged_count,
            'skipped': skipped_count,
            'message': f'조판 {staged_count}개 완료 (스킵 {skipped_count}개)'
        })
    except Exception as e:
        print(f"❌ [Stage] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@automation_bp.route('/api/automation/publish', methods=['POST'])
def automation_publish():
    """
    5️⃣ 발행: cache → data 폴더 파일 생성
    - rejected 아닌 것만 발행
    - 이 시점에 data/ 폴더에 최종 파일이 생성됨
    """
    try:
        from src.pipeline import save_article
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        cache_date_dir = os.path.join(CACHE_DIR, today_str)
        
        published_count = 0
        skipped_count = 0
        failed_count = 0
        
        if os.path.exists(cache_date_dir):
            for filename in os.listdir(cache_date_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(cache_date_dir, filename)
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
                    required = ['url', 'summary', 'zero_echo_score', 'impact_score']
                    missing = [f for f in required if f not in staging_data]
                    
                    # title 필드 검증
                    has_title = staging_data.get('title_ko') or staging_data.get('title')
                    if not has_title:
                        missing.append('title_ko or title')
                    
                    if missing:
                        print(f"⚠️ [Publish] Missing fields {missing}: {filename}")
                        skipped_count += 1
                        continue
                    
                    # 발행 (노이즈 필터링 건너뜀)
                    result = save_article(staging_data, source_id=staging_data.get('source_id'), skip_evaluation=True)
                    
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


@automation_bp.route('/api/automation/all', methods=['POST'])
def automation_all():
    """
    ⚡ ALL: 1~4단계 연속 실행 (발행 제외)
    """
    try:
        from flask import current_app
        
        results = {}
        
        # 1. 수집
        with current_app.test_client() as client:
            resp = client.post('/api/automation/collect')
            results['collect'] = resp.get_json()
        
        # 2. 추출
        with current_app.test_client() as client:
            resp = client.post('/api/automation/extract', 
                              json={'links': results['collect'].get('links', [])})
            results['extract'] = resp.get_json()
        
        # 3. 분석
        with current_app.test_client() as client:
            resp = client.post('/api/automation/analyze')
            results['analyze'] = resp.get_json()
        
        # 4. 조판
        with current_app.test_client() as client:
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


@automation_bp.route('/api/desk/recalculate', methods=['POST'])
def automation_stage_recalc():
    """
    ⚡ Cache 폴더의 기사 점수 재계산 (전체 또는 선택)
    """
    try:
        from src.score_engine import process_raw_analysis
        
        data = request.json or {}
        date_str = data.get('date') or request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        target_filenames = data.get('filenames', [])
        schema_version_override = data.get('schema_version')

        cache_date_dir = os.path.join(CACHE_DIR, date_str)
        
        if not os.path.exists(cache_date_dir):
            return jsonify({'success': False, 'error': 'Cache folder not found'}), 404
            
        count = 0
        errors = 0
        
        # 파일 목록 결정
        if target_filenames:
            files_to_process = target_filenames
        else:
            files_to_process = [f for f in os.listdir(cache_date_dir) if f.endswith('.json')]
            
        for filename in files_to_process:
            filepath = os.path.join(cache_date_dir, filename)
            
            if not os.path.exists(filepath):
                 continue

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    article_data = json.load(f)
                
                # raw_analysis가 있어야만 재계산 가능
                if 'raw_analysis' in article_data and article_data['raw_analysis']:
                    scores = process_raw_analysis(article_data['raw_analysis'], force_schema_version=schema_version_override)
                    article_data['zero_echo_score'] = scores.get('zero_echo_score', 5.0)
                    article_data['impact_score'] = scores.get('impact_score', 0.0)
                    
                    # 계산에 사용된 스키마 버전 기록
                    if 'impact_evidence' not in article_data: 
                        article_data['impact_evidence'] = {}
                    if scores.get('schema_version'):
                        article_data['impact_evidence']['schema_version'] = scores['schema_version']
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(article_data, f, ensure_ascii=False, indent=2)
                    count += 1
            except Exception as e:
                print(f"⚠️ Recalc error {filename}: {e}")
                errors += 1
                
        return jsonify({
            'success': True, 
            'message': f"{count}개 기사 점수 재계산 완료 (실패 {errors}건)"
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
