# -*- coding: utf-8 -*-
"""
Article Manager - 기사 중앙 관리 시스템
모든 기사 CRUD 및 상태 전이의 단일 진입점
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from .article_state import ArticleState, can_transition
from .firestore_client import FirestoreClient


class ArticleManager:
    """
    기사 중앙 관리 시스템
    
    모든 기사 데이터는 5개 섹션으로 구성:
    - _header: 메타 정보 (상태, 버전, 히스토리)
    - _original: 원본 정보 (크롤러가 작성, 불변)
    - _analysis: 분석 정보 (AI Analyzer가 작성)
    - _classification: 분류 정보 (Desk UI에서 작성)
    - _publication: 발행 정보 (Publisher가 작성)
    """
    
    SCHEMA_VERSION = "2.0"
    
    def __init__(self):
        self.db = FirestoreClient()
    
    # =========================================================================
    # Article ID Generation
    # =========================================================================
    
    @staticmethod
    def generate_article_id(url: str) -> str:
        """URL에서 article_id 생성 (12자리 MD5 해시)"""
        return hashlib.md5(url.encode()).hexdigest()[:12]
    
    # =========================================================================
    # CRUD Operations
    # =========================================================================
    
    def get(self, article_id: str) -> Optional[Dict[str, Any]]:
        """기사 조회"""
        """기사 조회"""
        article = self.db.get_article(article_id)
        if article:
            return self._flatten_article(article)
        return None
    
    def get_by_url(self, url: str) -> Optional[Dict[str, Any]]:
        """URL로 기사 조회"""
        article_id = self.generate_article_id(url)
        return self.get(article_id)
    
    def create(self, url: str, original_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        새 기사 생성 (Collector용)
        
        Args:
            url: 기사 URL
            original_data: 원본 데이터 (title, text, image, source_id 등)
        
        Returns:
            생성된 기사 데이터
        """
        article_id = self.generate_article_id(url)
        now = datetime.now(timezone.utc).isoformat()
        
        article = {
            '_header': {
                'version': self.SCHEMA_VERSION,
                'article_id': article_id,
                'state': ArticleState.COLLECTED.value,
                'created_at': now,
                'updated_at': now,
                'state_history': [
                    {
                        'state': ArticleState.COLLECTED.value,
                        'at': now,
                        'by': 'collector'
                    }
                ]
            },
            '_original': {
                'url': url,
                'title': original_data.get('title', ''),
                'text': original_data.get('text', ''),
                'image': original_data.get('image'),
                'source_id': original_data.get('source_id', 'unknown'),
                'crawled_at': now
            },
            '_analysis': None,
            '_classification': None,
            '_publication': None
        }
        
        # Firestore에 저장
        self.db.save_article(article_id, article)
        
        # 히스토리에 URL 등록
        self.db.update_history(url, article_id, ArticleState.COLLECTED.value)
        
        return article
    
    def update_state(
        self, 
        article_id: str, 
        new_state: ArticleState, 
        by: str = 'system',
        section_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        기사 상태 변경
        
        Args:
            article_id: 기사 ID
            new_state: 새 상태
            by: 변경 주체 (collector, analyzer, desk, publisher)
            section_data: 해당 섹션에 저장할 데이터
        
        Returns:
            성공 여부
        """
        article = self.get(article_id)
        if not article:
            return False
        
        current_state = ArticleState(article['_header']['state'])
        
        # 상태 전이 유효성 검사
        if not can_transition(current_state, new_state):
            print(f"⚠️ Invalid state transition: {current_state} → {new_state}")
            return False
        
        now = datetime.now(timezone.utc).isoformat()
        
        # 헤더 업데이트
        updates = {
            '_header.state': new_state.value,
            '_header.updated_at': now,
        }
        
        # 상태 히스토리 추가
        new_history_entry = {
            'state': new_state.value,
            'at': now,
            'by': by
        }
        
        # 섹션 데이터 업데이트
        if section_data:
            section_map = {
                ArticleState.ANALYZED: '_analysis',
                ArticleState.CLASSIFIED: '_classification',
                ArticleState.REJECTED: '_rejection',  # 폐기 정보는 별도 섹션
                ArticleState.PUBLISHED: '_publication',
                ArticleState.RELEASED: '_publication',
            }
            if new_state in section_map:
                section_name = section_map[new_state]
                for key, value in section_data.items():
                    updates[f'{section_name}.{key}'] = value
        
        # Firestore 업데이트 (state_history는 배열이라 별도 처리 필요)
        # [Log] Start
        try:
             with open('debug_manager.log', 'a', encoding='utf-8') as f:
                 f.write(f"{datetime.now(timezone.utc)}: [UpdateState] {article_id} -> {new_state.value}\n")
        except: pass

        # Firestore 업데이트 (state_history는 배열이라 별도 처리 필요)
        # [Fix] Update -> Upsert (문서 없으면 생성)
        # 기존: self.db.update_article(article_id, updates)
        success, msg = self.db.upsert_article_state(article_id, updates)
        
        # [Log] Result
        try:
             with open('debug_manager.log', 'a', encoding='utf-8') as f:
                 f.write(f"  Firestore Upsert: {success} ({msg})\n")
        except: pass
        
        # 히스토리 업데이트
        url = article['_original']['url']
        self.db.update_history(url, article_id, new_state.value)
        
        # Registry 인메모리 인덱스 업데이트 (SSOT 동기화)
        try:
            from .article_registry import get_registry
            registry = get_registry()
            
            info = registry.get(article_id)
            if not info:
                # [Lazy Load] Registry에 없으면 디스크에서 로드
                info = registry.find_and_register(article_id)
            
            if info:
                registry._update_article_state(info, new_state.value)
                
                # 로컬 캐시 파일도 상태 동기화
                current_ts = datetime.now(timezone.utc).isoformat()
                registry._update_local_cache(article_id, new_state.value, by, current_ts)
                
                print(f"✅ [Registry] State synced: {article_id} → {new_state.value}")
            else:
                print(f"⚠️ [Registry] Article not found even after lazy load: {article_id}")
                
        except Exception as e:
            print(f"⚠️ [Registry] Sync failed: {e}")
            import traceback
            traceback.print_exc()

        # [Note] Direct DB update removed to maintain centralized management via Registry.

        
        return True
    
    def _flatten_article(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """
        계층형 데이터를 UI/레거시 호환을 위해 평탄화 (Flatten)
        Priorities: _publication > _classification > _analysis > _original > _header
        """
        if not article:
            return article
            
        # Start with a shallow copy to preserve original structure (backward compatibility)
        flat = article.copy()
        
        # Merge sections into the top level for frontend convenience
        # 1. Header (Meta)
        if '_header' in article and article['_header']:
            flat.update(article['_header'])
            
        # 2. Original
        if '_original' in article and article['_original']:
            flat.update(article['_original'])
            
        # 3. Analysis
        if '_analysis' in article and article['_analysis']:
            flat.update(article['_analysis'])
            
        # 4. Classification
        if '_classification' in article and article['_classification']:
            flat.update(article['_classification'])
            
        # 5. Publication
        if '_publication' in article and article['_publication']:
            flat.update(article['_publication'])
            
        # _raw is now strictly redundancy since we started with copy, 
        # but kept if explicitly needed by name.
        flat['_raw'] = article
        
        return flat
    
    def update_analysis(self, article_id: str, analysis_data: Dict[str, Any]) -> bool:
        """
        AI 분석 결과 저장 (Analyzer용)
        
        Args:
            article_id: 기사 ID
            analysis_data: 분석 결과 (title_ko, summary, tags, scores, mll_raw)
        """
        now = datetime.now(timezone.utc).isoformat()
        
        section_data = {
            'title_ko': analysis_data.get('title_ko', ''),
            'summary': analysis_data.get('summary', ''),
            'tags': analysis_data.get('tags', []),
            'impact_score': analysis_data.get('impact_score', 0),
            'zero_echo_score': analysis_data.get('zero_echo_score', 0),
            'analyzed_at': now,
            'mll_raw': analysis_data.get('mll_raw')
        }
        
        return self.update_state(
            article_id, 
            ArticleState.ANALYZED, 
            by='analyzer',
            section_data=section_data
        )
    
    def update_classification(self, article_id: str, category: str, is_selected: bool = True) -> bool:
        """
        분류 정보 저장 (Desk UI용)
        
        Args:
            article_id: 기사 ID
            category: 카테고리
            is_selected: 선택 여부 (중복 제거용)
        """
        now = datetime.now(timezone.utc).isoformat()
        
        section_data = {
            'category': category,
            'is_selected': is_selected,
            'classified_at': now,
            'classified_by': 'desk_user'
        }
        
        return self.update_state(
            article_id,
            ArticleState.CLASSIFIED,
            by='desk',
            section_data=section_data
        )
    
    def publish(self, article_id: str, edition_code: str, edition_name: str) -> bool:
        """
        발행 처리 (Publisher용)
        
        Args:
            article_id: 기사 ID
            edition_code: 회차 코드 (예: 251226_5)
            edition_name: 회차 이름 (예: 5호)
        """
        now = datetime.now(timezone.utc).isoformat()
        
        section_data = {
            'edition_code': edition_code,
            'edition_name': edition_name,
            'published_at': now,
            'released_at': None,
            'status': 'preview',  # P1 Fix: publication status
            'firestore_synced': True
        }
        
        success = self.update_state(
            article_id,
            ArticleState.PUBLISHED,
            by='publisher',
            section_data=section_data
        )

        if success:
            # 1. Fetch full article data for snapshot
            full_article = self.get(article_id)
            if full_article:
                formatted_article = _format_article_for_snapshot(full_article)
            else:
                # Fallback if somehow missing
                 formatted_article = {'id': article_id, 'title': 'Unknown'}

            # 2. Update Publications Collection (Document)
            # Load existing to append
            pub_doc = self.db.get_publication(edition_code)
            
            if not pub_doc:
                # Initialize new publication document
                pub_doc = {
                    'edition_code': edition_code,
                    'edition_name': edition_name,
                    'published_at': now,
                    'updated_at': now,
                    'status': 'preview',
                    'schema_version': '2.0.0',
                    'article_count': 0,
                    'article_ids': [],
                    'articles': [],
                    'date': now[:10]
                }
            
            # Append new article if not exists
            if article_id not in pub_doc.get('article_ids', []):
                pub_doc['article_ids'] = pub_doc.get('article_ids', []) + [article_id]
                pub_doc['articles'] = pub_doc.get('articles', []) + [formatted_article]
                pub_doc['article_count'] = len(pub_doc['article_ids'])
                pub_doc['updated_at'] = now
            
            # Save SSOT
            print(f"📝 [Publish] Saving publication document: {edition_code}")
            try:
                self.db.save_publication(edition_code, pub_doc)
                print(f"✅ [Publish] Publication document saved successfully")
            except Exception as e:
                print(f"❌ [Publish] Failed to save publication: {e}")
                import traceback
                traceback.print_exc()
                # Rollback article state on failure
                self.update_state(article_id, ArticleState.CLASSIFIED, by='publish_rollback')
                return False
            
            # 3. Update _meta (Summary)
            print(f"📝 [Publish] Updating publications meta...")
            try:
                meta = self.db.get_publications_meta() or {'issues': []}
                issues = meta.get('issues', [])
                
                # Check existing
                existing_idx = next((i for i, x in enumerate(issues) if x.get('edition_code') == edition_code), -1)
                
                issue_summary = {
                    'edition_code': edition_code,
                    'edition_name': edition_name,
                    'published_at': pub_doc['published_at'],
                    'updated_at': now,
                    'article_count': pub_doc['article_count'],
                    'status': pub_doc.get('status', 'preview'),
                    'schema_version': '2.0.0',
                    # Legacy fields for compatibility if needed, but user emphasized NEW schema structure
                    'code': edition_code,
                    'name': edition_name,
                    'count': pub_doc['article_count']
                }
                
                if existing_idx >= 0:
                    issues[existing_idx] = issue_summary
                else:
                    issues.insert(0, issue_summary)
                
                meta['issues'] = issues
                meta['latest_updated_at'] = now
                self.db.update_publications_meta(meta)
                print(f"✅ [Publish] Publications meta updated successfully")
            except Exception as e:
                print(f"❌ [Publish] Failed to update publications meta: {e}")
                import traceback
                traceback.print_exc()
                # Rollback article state on failure
                self.update_state(article_id, ArticleState.CLASSIFIED, by='publish_rollback')
                return False

            # Cache Warmup
            self._warmup_cache()
        
        return success

    def find_duplicates(self, article_id: str, threshold: float = 0.6) -> List[Dict[str, Any]]:
        """
        중복 의심 기사 검색 (Title similarity based)
        """
        from difflib import SequenceMatcher
        
        target = self.get_article(article_id)
        if not target:
            return []
            
        target_title = target.get('_analysis', {}).get('title_ko') or target.get('_original', {}).get('title', '')
        if not target_title:
            return []
            
        # Recent articles (e.g., last 1000)
        candidates = self.db.list_recent_articles(limit=1000)
        
        results = []
        for cand in candidates:
            if cand['id'] == article_id:
                continue
                
            cand_title = cand.get('_analysis', {}).get('title_ko') or cand.get('_original', {}).get('title', '')
            if not cand_title:
                continue
                
            ratio = SequenceMatcher(None, target_title, cand_title).ratio()
            if ratio >= threshold:
                results.append({
                    'id': cand['id'],
                    'title': cand_title,
                    'similarity': round(ratio * 100, 1),
                    'state': cand.get('_header', {}).get('state', 'unknown'),
                    'published_at': cand.get('_original', {}).get('published_at')
                })
        
        # Sort by similarity desc
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results
    
    def reject(self, article_id: str, reason: str = 'cutline', by: str = 'system') -> bool:
        """
        기사 폐기
        
        Args:
            article_id: 기사 ID
            reason: 폐기 사유 (cutline: 커트라인, duplicate: 중복, manual: 수동)
            by: 폐기 주체
        """
        now = datetime.now(timezone.utc).isoformat()
        
        return self.update_state(
            article_id,
            ArticleState.REJECTED,
            by=by,
            section_data={
                'reason': reason,
                'rejected_at': now,
                'rejected_by': by
            }
        )
    

    
    # =========================================================================
    # Query Operations
    # =========================================================================
    
    def find_by_state(self, state: ArticleState, limit: int = 100) -> List[Dict[str, Any]]:
        """상태별 기사 목록 조회"""
        return self.db.list_articles_by_state(state.value, limit)
    
    def find_collected(self, limit: int = 100) -> List[Dict[str, Any]]:
        """수집된 기사 목록 (AI 분석 대기)"""
        return self.find_by_state(ArticleState.COLLECTED, limit)
    
    def find_analyzed(self, limit: int = 100) -> List[Dict[str, Any]]:
        """분석 완료 기사 목록 (분류 대기)"""
        return self.find_by_state(ArticleState.ANALYZED, limit)
    
    def find_classified(self, limit: int = 100) -> List[Dict[str, Any]]:
        """분류 완료 기사 목록 (발행 대기)"""
        return self.find_by_state(ArticleState.CLASSIFIED, limit)
    
    def find_recent(self, limit: int = 100) -> List[Dict[str, Any]]:
        """최근 기사 목록"""
        return self.db.list_recent_articles(limit)
    
    # =========================================================================
    # URL Check
    # =========================================================================
    
    def is_url_processed(self, url: str) -> bool:
        """URL이 이미 처리되었는지 확인"""
        result = self.db.check_url_exists(url)
        return result is not None
    
    def get_url_status(self, url: str) -> Optional[str]:
        """URL의 처리 상태 조회"""
        result = self.db.check_url_exists(url)
        if result:
            return result.get('status')
        return None

    # =========================================================================
    # Publication / Edition Operations (In-Memory Cache)
    # =========================================================================
    
    _local_cache = {
        'meta': None,
        'articles': {}  # edition_code -> list[dict]
    }
    
    def _warmup_cache(self):
        """최근 2회차 데이터 메모리 로드"""
        try:
            # 1. Meta 로드
            meta = self.db.get_publications_meta()
            if not meta:
                print("[ArticleManager] No publications meta found.")
                return
            
            self._local_cache['meta'] = meta
            
            # 2. 최근 2회차 기사 로드
            issues = meta.get('issues', [])
            # published_at 역순 정렬 보장
            issues.sort(key=lambda x: x.get('published_at', ''), reverse=True)
            
            recent_codes = [issue.get('edition_code') or issue.get('code') for issue in issues[:2]]
            recent_codes = [c for c in recent_codes if c]  # None 제거
            
            for code in recent_codes:
                articles = self.db.list_articles_by_edition(code)
                self._local_cache['articles'][code] = articles
                
            print(f"[ArticleManager] Cached {len(recent_codes)} recent editions: {recent_codes}")
            
        except Exception as e:
            print(f"[ArticleManager] Cache warmup failed: {e}")

    def get_editions(self, limit: int = 20) -> List[Dict[str, Any]]:
        """발행된 회차 목록 조회 (_meta 기반 + Cache, 호환성 보장)"""
        # 1. Cache Hit Check - use get_issues_from_meta for proper formatting
        if self._local_cache.get('meta'):
            # Already have meta, use the optimized method
            issues = self.db.get_issues_from_meta()
            return issues[:limit]

        # 2. Fallback to DB (get_issues_from_meta handles everything)
        issues = self.db.get_issues_from_meta()
        if issues:
            # Cache the meta for future use
            self._local_cache['meta'] = self.db.get_publications_meta()
        return issues[:limit]


    def get_edition_articles(self, edition_code: str) -> List[Dict[str, Any]]:
        """특정 회차의 기사 목록 조회 (Cache 우선)"""
        # 1. Cache Hit Check
        if edition_code in self._local_cache.get('articles', {}):
            return self._local_cache['articles'][edition_code]

        # 2. DB Query
        articles = self.db.list_articles_by_edition(edition_code)
        return articles

    def release_edition(self, edition_code: str) -> Dict[str, Any]:
        """
        회차 정식 발행 (Preview -> Released)
        1. 메타 데이터 상태 변경
        2. 소속 기사 상태 일괄 변경 (PUBLISHED -> RELEASED)
        """
        now = datetime.now(timezone.utc).isoformat()
        
        # 1. 메타 데이터 확인 및 업데이트
        meta = self.db.get_publications_meta()
        if not meta:
            return {'success': False, 'error': 'Meta not found'}
            
        issues = meta.get('issues', [])
        target_issue = None
        target_idx = -1
        
        for idx, iss in enumerate(issues):
            if iss.get('edition_code') == edition_code or iss.get('code') == edition_code:
                target_issue = iss
                target_idx = idx
                break
                
        if not target_issue:
            return {'success': False, 'error': 'Edition not found'}
            
        if target_issue.get('status') == 'released':
            return {'success': True, 'message': 'Already released', 'released_count': 0}
            
        # Update Meta Status
        target_issue['status'] = 'released'
        target_issue['released_at'] = now
        issues[target_idx] = target_issue
        
        self.db.update_publications_meta(meta)
        
        # Update Individual Publication Doc
        pub_doc = self.db.get_publication(edition_code) or {}
        pub_doc['status'] = 'released'
        pub_doc['released_at'] = now
        self.db.save_publication(edition_code, pub_doc)
        
        # 2. Update Articles
        articles = self.get_edition_articles(edition_code)
        updated_count = 0
        
        for art in articles:
            # article_id, header.state check
            art_id = art.get('article_id') or art.get('id')
            current_state = art.get('_header', {}).get('state')  # P2 Fix: Use only _header.state
            
            if art_id and current_state != 'RELEASED':
                # Update State to RELEASED
                # Note: 'publisher' is the actor
                self.update_state(art_id, ArticleState.RELEASED, by='publisher')
                
                # Update _publication section explicitly if needed?
                # update_state mainly handles header. 
                # Ideally, we should add 'released_at' to _publication section too.
                # But for now, let's trust state change is enough.
                updated_count += 1
                
        # 3. Warmup Cache
        self._warmup_cache()
        
        return {
            'success': True,
            'edition_code': edition_code,
            'released_count': updated_count,
            'released_at': now
        }

    def delete_edition(self, edition_code: str) -> Dict[str, Any]:
        """
        회차 파기 (Unpublish/Rollback)
        1. 메타 데이터에서 해당 회차 제거
        2. publications 컬렉션에서 문서 삭제
        3. 소속 기사들의 상태를 CLASSIFIED로 원복 (Draft 목록으로 복귀)
        """
        # 1. 메타 데이터 확인
        meta = self.db.get_publications_meta()
        if not meta:
            return {'success': False, 'error': 'Meta not found'}
            
        issues = meta.get('issues', [])
        
        # 해당 회차 필터링 (제거)
        initial_len = len(issues)
        issues = [i for i in issues if not (i.get('edition_code') == edition_code or i.get('code') == edition_code)]
        
        if len(issues) == initial_len:
             return {'success': False, 'error': 'Edition not found in meta'}

        # Meta 업데이트
        meta['issues'] = issues
        meta['latest_updated_at'] = datetime.now(timezone.utc).isoformat()
        self.db.update_publications_meta(meta)
        
        # 2. 기사 목록 확보 (문서 삭제 전)
        # 삭제 대상 기사들을 찾기 위해 publication 문서 조회
        # 만약 이미 문서가 없으면 index 검색 시도
        pub_doc = self.db.get_publication(edition_code)
        target_article_ids = []
        
        if pub_doc:
            target_article_ids = pub_doc.get('article_ids', [])
        
        # 혹시 pub_doc에 없더라도 index로 찾아본다 (Safety)
        if not target_article_ids:
             query = self.db._get_collection('articles').where('_publication.edition_code', '==', edition_code)
             docs = query.stream()
             target_article_ids = [doc.id for doc in docs]

        # 3. 개별 회차 문서 삭제
        doc_ref = self.db._get_collection('publications').document(edition_code)
        doc_ref.delete()
        
        # 4. 기사 상태 원복 (Revert Articles)
        reverted_count = 0
        empty_pub_data = {
            'edition_code': None,
            'edition_name': None,
            'published_at': None,
            'released_at': None
        }
            
        for art_id in target_article_ids:
            # 강제로 CLASSIFIED (분류됨/발행대기)로 변경
            # _publication 정보 초기화
            self.update_state(
                art_id, 
                ArticleState.CLASSIFIED, 
                by='publisher',
                section_data=empty_pub_data
            )
            reverted_count += 1
            
        # Cache Warmup
        self._warmup_cache()
        
        return {
            'success': True,
            'edition_code': edition_code,
            'reverted_count': reverted_count
        }


# =============================================================================
# Helper Functions (Module Level)
# =============================================================================

def _format_article_for_snapshot(article: dict) -> dict:
    """기사 데이터를 발행 스냅샷용으로 변환 (User Schema 준수)"""
    header = article.get('_header', {})
    original = article.get('_original', {})
    analysis = article.get('_analysis', {})
    classification = article.get('_classification', {})
    
    return {
        'id': header.get('article_id'),
        'source_id': original.get('source_id'),
        'title': original.get('title'),
        'title_ko': analysis.get('title_ko'),
        'title_en': analysis.get('title_en', ''),
        'url': original.get('url'),
        'published_at': original.get('published_at') or header.get('created_at'),
        'category': classification.get('category'),
        'impact_score': analysis.get('impact_score'),
        'zero_echo_score': analysis.get('zero_echo_score'),
        'summary': analysis.get('summary'),
        'tags': analysis.get('tags', []),
        'layout_type': classification.get('layout_type', 'Standard'),
        'date': (original.get('published_at') or '')[:10],
        'filename': f"{original.get('source_id')}_{header.get('article_id')}.json"
    }
