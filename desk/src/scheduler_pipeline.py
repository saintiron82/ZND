# -*- coding: utf-8 -*-
"""
Scheduler Pipeline - 통합 자동화 파이프라인

핵심 원칙: 코드 복사 금지!
모든 저장/발행 모듈은 desk 코어를 직접 import하여 호출

파이프라인 단계:
    COLLECT → EXTRACT → ANALYZE → SCORE → CLASSIFY → REJECT → PUBLISH → RELEASE
"""
import os
import sys
from enum import Enum
from datetime import datetime
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass, field

# Path setup for desk core imports
DESK_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if DESK_DIR not in sys.path:
    sys.path.insert(0, DESK_DIR)

# ============================================================================
# Desk Core Imports (직접 호출, 복사 금지!)
# ============================================================================
from src.core.article_manager import ArticleManager
from src.core.article_state import ArticleState
from src.core.firestore_client import FirestoreClient
from src.core_logic import (
    save_to_cache,
    load_from_cache,
    get_article_id,
    get_kst_now,
)
from src.pipeline import extract_article


# ============================================================================
# Pipeline Definitions
# ============================================================================

class PipelinePhase(Enum):
    """파이프라인 단계 정의"""
    COLLECT = "collect"      # 링크 수집
    EXTRACT = "extract"      # 본문 추출  
    ANALYZE = "analyze"      # AI 분석 (구현 예정)
    SCORE = "score"          # 점수 재계산 (구현 예정)
    CLASSIFY = "classify"    # 자동 분류
    REJECT = "reject"        # 배제 처리
    PUBLISH = "publish"      # 발행
    RELEASE = "release"      # 릴리즈


@dataclass
class PipelineResult:
    """파이프라인 실행 결과"""
    success: bool = True
    phase: PipelinePhase = None
    collected: int = 0
    extracted: int = 0
    analyzed: int = 0
    classified: int = 0
    rejected: int = 0
    published: int = 0
    released: bool = False
    errors: List[str] = field(default_factory=list)
    message: str = ""
    
    def to_dict(self) -> dict:
        return {
            'success': self.success,
            'phase': self.phase.value if self.phase else None,
            'collected': self.collected,
            'extracted': self.extracted,
            'analyzed': self.analyzed,
            'classified': self.classified,
            'rejected': self.rejected,
            'published': self.published,
            'released': self.released,
            'errors': self.errors,
            'message': self.message
        }


# ============================================================================
# Pipeline Executor
# ============================================================================

class SchedulerPipeline:
    """
    통합 스케줄러 파이프라인
    
    desk 코어를 직접 호출하여 수집→발행까지 자동화
    """
    
    def __init__(self):
        self.manager = ArticleManager()
        self.db = FirestoreClient()
        self.result = PipelineResult()
        
    def run(
        self,
        phases: List[PipelinePhase] = None,
        schedule_name: str = "Scheduled",
        progress_callback: Callable[[Dict], None] = None,
        dry_run: bool = False
    ) -> PipelineResult:
        """
        파이프라인 실행
        
        Args:
            phases: 실행할 단계들 (None = 전체 실행)
            schedule_name: 스케줄 이름 (로깅/알림용)
            progress_callback: 진행 상황 콜백
            dry_run: True면 실제 저장 없이 시뮬레이션
            
        Returns:
            PipelineResult
        """
        if phases is None:
            phases = list(PipelinePhase)
        
        self.result = PipelineResult()
        self._log(f"🚀 Pipeline starting: {schedule_name}")
        self._log(f"   Phases: {[p.value for p in phases]}")
        
        try:
            for phase in phases:
                self.result.phase = phase
                
                if progress_callback:
                    progress_callback({
                        'status': 'running',
                        'phase': phase.value,
                        'message': f'Processing {phase.value}...'
                    })
                
                # 단계별 실행
                if phase == PipelinePhase.COLLECT:
                    self._phase_collect()
                elif phase == PipelinePhase.EXTRACT:
                    self._phase_extract()
                elif phase == PipelinePhase.ANALYZE:
                    self._phase_analyze()
                elif phase == PipelinePhase.SCORE:
                    self._phase_score()
                elif phase == PipelinePhase.CLASSIFY:
                    self._phase_classify()
                elif phase == PipelinePhase.REJECT:
                    self._phase_reject()
                elif phase == PipelinePhase.PUBLISH:
                    self._phase_publish(dry_run)
                elif phase == PipelinePhase.RELEASE:
                    self._phase_release(dry_run)
                    
        except Exception as e:
            self.result.success = False
            self.result.errors.append(str(e))
            self._log(f"❌ Pipeline error: {e}")
            import traceback
            traceback.print_exc()
            
        # 최종 메시지 생성
        self.result.message = self._generate_summary()
        self._log(f"✅ Pipeline completed: {self.result.message}")
        
        return self.result
    
    # ========================================================================
    # Phase Implementations
    # ========================================================================
    
    def _phase_collect(self):
        """Phase 1: 링크 수집"""
        self._log("📡 [COLLECT] Starting link collection...")
        
        # crawler/core/collector.py 호출
        try:
            # TODO: crawler 모듈에서 collect_links 가져오기
            # 현재는 placeholder
            ZND_ROOT = os.path.dirname(DESK_DIR)
            sys.path.insert(0, os.path.join(ZND_ROOT, 'crawler'))
            from core.collector import collect_links
            
            result = collect_links()
            if result.get('success'):
                self._collected_links = result.get('links', [])
                self.result.collected = len(self._collected_links)
                self._log(f"   Collected {self.result.collected} links")
            else:
                self._collected_links = []
                self._log(f"   No links collected")
        except Exception as e:
            self._log(f"⚠️ [COLLECT] Error: {e}")
            self._collected_links = []
    
    def _phase_extract(self):
        """Phase 2: 본문 추출"""
        self._log("📄 [EXTRACT] Starting content extraction...")
        
        import asyncio
        
        links = getattr(self, '_collected_links', [])
        if not links:
            self._log("   No links to extract")
            return
        
        extracted_articles = []
        
        async def extract_all():
            nonlocal extracted_articles
            for item in links:
                url = item['url'] if isinstance(item, dict) else item
                source_id = item.get('source_id', 'unknown') if isinstance(item, dict) else 'unknown'
                
                # desk 코어의 extract_article 직접 호출!
                try:
                    content = await extract_article(url)
                    if content and len(content.get('text', '')) >= 200:
                        content['source_id'] = source_id
                        content['url'] = url
                        
                        # desk 코어의 save_to_cache 직접 호출!
                        save_to_cache(url, content)
                        
                        # ArticleManager.create 호출하여 Firestore 저장
                        article = self.manager.create(url, content)
                        if article:
                            extracted_articles.append(article)
                            
                except Exception as e:
                    self._log(f"⚠️ Extract failed: {url[:50]}... - {e}")
        
        asyncio.run(extract_all())
        self._extracted_articles = extracted_articles
        self.result.extracted = len(extracted_articles)
        self._log(f"   Extracted {self.result.extracted} articles")
    
    def _phase_analyze(self):
        """Phase 3: AI 분석 (구현 예정)"""
        self._log("🤖 [ANALYZE] AI analysis...")
        
        # TODO: 새로운 분석 엔진 연동 예정
        # 현재는 COLLECTED 상태의 기사를 가져와서 분석 대기
        articles = getattr(self, '_extracted_articles', [])
        if not articles:
            # Firestore에서 COLLECTED 상태 기사 조회
            articles = self.manager.find_collected(limit=50)
        
        self._log(f"   {len(articles)} articles pending analysis")
        self._articles_to_analyze = articles
        # 분석은 추후 구현
        self.result.analyzed = 0
    
    def _phase_score(self):
        """Phase 4: 점수 재계산 (구현 예정)"""
        self._log("📊 [SCORE] Score recalculation...")
        # TODO: 점수 재계산 로직
        pass
    
    def _phase_classify(self):
        """Phase 5: 자동 분류"""
        self._log("🏷️ [CLASSIFY] Auto classification...")
        
        # ANALYZED 상태 기사 가져오기
        articles = self.manager.find_analyzed(limit=100)
        
        classified_count = 0
        for article in articles:
            article_id = article.get('_header', {}).get('article_id') or article.get('article_id')
            if not article_id:
                continue
            
            # 기본 카테고리 자동 분류 (태그 기반)
            tags = article.get('_analysis', {}).get('tags', [])
            if not tags:
                tags = article.get('tags', [])
            
            category = self._determine_category(tags)
            
            # desk 코어의 update_classification 직접 호출!
            if self.manager.update_classification(article_id, category):
                classified_count += 1
        
        self.result.classified = classified_count
        self._log(f"   Classified {classified_count} articles")
    
    def _phase_reject(self):
        """Phase 6: 배제 처리 (커트라인 미달)"""
        self._log("🗑️ [REJECT] Rejecting high-noise articles...")
        
        # ANALYZED 상태에서 점수 미달 기사 배제
        articles = self.manager.find_analyzed(limit=100)
        
        rejected_count = 0
        # [v1.2.0] ZES 낮을수록 좋음! 6.0 초과면 노이즈 과다
        max_acceptable_zes = 6.0
        
        for article in articles:
            article_id = article.get('_header', {}).get('article_id') or article.get('article_id')
            if not article_id:
                continue
            
            # 점수 확인
            analysis = article.get('_analysis', {})
            score = analysis.get('zero_echo_score', 10)  # Default to worst
            if not score:
                score = article.get('zero_echo_score', 10)
            
            if float(score) > max_acceptable_zes:
                # desk 코어의 reject 직접 호출!
                if self.manager.reject(article_id, reason='cutline'):
                    rejected_count += 1
        
        self.result.rejected = rejected_count
        self._log(f"   Rejected {rejected_count} articles")
    
    def _phase_publish(self, dry_run: bool = False):
        """Phase 7: 발행"""
        self._log("📤 [PUBLISH] Publishing articles...")
        
        if dry_run:
            self._log("   (Dry run - skipping actual publish)")
            return
        
        # CLASSIFIED 상태 기사 가져오기
        articles = self.manager.find_classified(limit=20)
        
        if not articles:
            self._log("   No articles to publish")
            return
        
        # 발행 회차 생성
        now = get_kst_now()
        date_str = now.strftime('%y%m%d')
        
        # 기존 회차 확인하여 다음 번호 결정
        meta = self.db.get_publications_meta() or {'issues': []}
        today_issues = [i for i in meta.get('issues', []) if i.get('edition_code', '').startswith(date_str)]
        next_index = len(today_issues) + 1
        
        edition_code = f"{date_str}_{next_index}"
        edition_name = f"{next_index}호"
        
        published_count = 0
        for article in articles:
            article_id = article.get('_header', {}).get('article_id') or article.get('article_id')
            if not article_id:
                continue
            
            # desk 코어의 publish 직접 호출!
            if self.manager.publish(article_id, edition_code, edition_name):
                published_count += 1
        
        self.result.published = published_count
        self._log(f"   Published {published_count} articles to {edition_code}")
    
    def _phase_release(self, dry_run: bool = False):
        """Phase 8: 릴리즈 (Git push)"""
        self._log("🚀 [RELEASE] Releasing to production...")
        
        if dry_run:
            self._log("   (Dry run - skipping actual release)")
            return
        
        # TODO: Git 릴리즈 브랜치 푸시
        # /release-branch 워크플로우 호출 예정
        self.result.released = False
        self._log("   Release pending (manual trigger required)")
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    def _determine_category(self, tags: List[str]) -> str:
        """태그 기반 카테고리 결정"""
        # 간단한 규칙 기반 분류
        tag_str = ' '.join(tags).lower()
        
        if any(k in tag_str for k in ['ai', 'machine learning', 'gpt', 'llm']):
            return 'ai'
        elif any(k in tag_str for k in ['crypto', 'bitcoin', 'blockchain']):
            return 'crypto'
        elif any(k in tag_str for k in ['startup', 'funding', 'vc']):
            return 'startup'
        else:
            return 'tech'
    
    def _generate_summary(self) -> str:
        """실행 결과 요약 생성"""
        parts = []
        if self.result.collected:
            parts.append(f"수집:{self.result.collected}")
        if self.result.extracted:
            parts.append(f"추출:{self.result.extracted}")
        if self.result.analyzed:
            parts.append(f"분석:{self.result.analyzed}")
        if self.result.classified:
            parts.append(f"분류:{self.result.classified}")
        if self.result.rejected:
            parts.append(f"배제:{self.result.rejected}")
        if self.result.published:
            parts.append(f"발행:{self.result.published}")
        
        return ', '.join(parts) if parts else 'No actions taken'
    
    def _log(self, message: str):
        """로그 출력"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {message}")


# ============================================================================
# Convenience Functions
# ============================================================================

def run_pipeline(
    phases: List[PipelinePhase] = None,
    schedule_name: str = "Scheduled",
    progress_callback: Callable[[Dict], None] = None,
    dry_run: bool = False
) -> PipelineResult:
    """
    파이프라인 실행 (편의 함수)
    
    Examples:
        # 수집만
        run_pipeline([PipelinePhase.COLLECT, PipelinePhase.EXTRACT])
        
        # 분석까지
        run_pipeline([
            PipelinePhase.COLLECT, 
            PipelinePhase.EXTRACT, 
            PipelinePhase.ANALYZE
        ])
        
        # 전체 자동화
        run_pipeline()
    """
    pipeline = SchedulerPipeline()
    return pipeline.run(phases, schedule_name, progress_callback, dry_run)


# 편의 상수
PHASES_COLLECT_ONLY = [PipelinePhase.COLLECT, PipelinePhase.EXTRACT]
PHASES_UNTIL_ANALYZE = [
    PipelinePhase.COLLECT, 
    PipelinePhase.EXTRACT, 
    PipelinePhase.ANALYZE,
    PipelinePhase.SCORE
]
PHASES_UNTIL_PUBLISH = [
    PipelinePhase.COLLECT,
    PipelinePhase.EXTRACT,
    PipelinePhase.ANALYZE,
    PipelinePhase.SCORE,
    PipelinePhase.CLASSIFY,
    PipelinePhase.REJECT,
    PipelinePhase.PUBLISH
]
PHASES_FULL = list(PipelinePhase)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='ZND 스케줄러 파이프라인 즉시 실행')
    parser.add_argument(
        '--phases', '-p',
        nargs='+',
        choices=['collect', 'extract', 'analyze', 'score', 'classify', 'reject', 'publish', 'release'],
        default=['collect', 'extract'],
        help='실행할 단계들 (기본: collect extract)'
    )
    parser.add_argument(
        '--dry-run', '-d',
        action='store_true',
        help='실제 저장 없이 시뮬레이션'
    )
    parser.add_argument(
        '--name', '-n',
        default='Manual Run',
        help='실행 이름 (로깅용)'
    )
    
    args = parser.parse_args()
    
    # phases 문자열을 Enum으로 변환
    phases = [PipelinePhase(p) for p in args.phases]
    
    print(f"""
╔══════════════════════════════════════════════════╗
║       🚀 ZND Pipeline - 즉시 실행                  ║
╚══════════════════════════════════════════════════╝

실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
실행 이름: {args.name}
실행 단계: {args.phases}
Dry Run: {args.dry_run}
""")
    
    result = run_pipeline(
        phases=phases,
        schedule_name=args.name,
        dry_run=args.dry_run
    )
    
    print(f"\n{'='*50}")
    print(f"실행 결과: {result.to_dict()}")
    print(f"{'='*50}")

