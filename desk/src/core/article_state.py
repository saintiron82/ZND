# -*- coding: utf-8 -*-
"""
Article State Definitions
기사 생명주기 상태 정의
"""
from enum import Enum


class ArticleState(str, Enum):
    """기사 생명주기 상태"""
    
    # 수집 단계
    # 수집 단계
    COLLECTED = "COLLECTED"      # 크롤링 완료, 원문 추출됨
    
    # 분석 단계
    ANALYZING = "ANALYZING"      # AI 분석 중
    ANALYZED = "ANALYZED"        # AI 분석 완료
    REJECTED = "REJECTED"        # 분석 결과 폐기 (Noise)
    
    # 분류 단계
    CLASSIFIED = "CLASSIFIED"    # 카테고리 분류됨, 발행 대기
    
    # 발행 단계
    PUBLISHED = "PUBLISHED"      # Firestore에 발행됨 (preview)
    RELEASED = "RELEASED"        # 사용자에게 공개됨


# 유효한 상태 전이 규칙 (정적 규칙 - 데이터 유무와 상관없이 허용되는 전이)
VALID_TRANSITIONS = {
    ArticleState.COLLECTED: [ArticleState.ANALYZING, ArticleState.ANALYZED, ArticleState.CLASSIFIED, ArticleState.REJECTED],  # CLASSIFIED 추가 (데이터 있을 때만 허용)
    ArticleState.ANALYZING: [ArticleState.ANALYZED, ArticleState.REJECTED],
    ArticleState.ANALYZED: [ArticleState.CLASSIFIED, ArticleState.REJECTED, ArticleState.ANALYZING, ArticleState.COLLECTED, ArticleState.ANALYZED],  # ANALYZED → ANALYZED 허용 (점수 재계산용)
    ArticleState.REJECTED: [ArticleState.ANALYZING, ArticleState.COLLECTED, ArticleState.ANALYZED],  # 복구 후 재분석 가능
    ArticleState.CLASSIFIED: [ArticleState.PUBLISHED, ArticleState.ANALYZED, ArticleState.COLLECTED, ArticleState.REJECTED, ArticleState.CLASSIFIED],  # CLASSIFIED → CLASSIFIED 허용 (점수 재계산용)
    ArticleState.PUBLISHED: [ArticleState.RELEASED, ArticleState.CLASSIFIED, ArticleState.ANALYZED, ArticleState.COLLECTED],  # 공개 또는 발행 취소
    ArticleState.RELEASED: [ArticleState.PUBLISHED, ArticleState.CLASSIFIED, ArticleState.ANALYZED],  # 공개 취소 또는 회차 파기 시 원복
}


def can_transition(from_state: ArticleState, to_state: ArticleState) -> bool:
    """상태 전이가 유효한지 확인 (정적 규칙만)"""
    if from_state not in VALID_TRANSITIONS:
        return False
    return to_state in VALID_TRANSITIONS[from_state]


def can_transition_with_data(from_state: ArticleState, to_state: ArticleState, article_data: dict) -> bool:
    """
    상태 전이가 유효한지 확인 (데이터 기반 동적 규칙)
    
    규칙:
    - ANALYZED로 가려면: _analysis 데이터 필요
    - CLASSIFIED로 가려면: _analysis + _classification 데이터 필요
    - PUBLISHED로 가려면: _analysis + _classification + _publication 데이터 필요
    """
    # 1. 정적 규칙 먼저 체크
    if not can_transition(from_state, to_state):
        return False
    
    # 2. 동적 규칙 체크 (데이터 유무)
    has_analysis = bool(article_data.get('_analysis'))
    has_classification = bool(article_data.get('_classification') and article_data.get('_classification', {}).get('category'))
    has_publication = bool(article_data.get('_publication') and article_data.get('_publication', {}).get('edition_code'))
    
    # ANALYZED로 이동: _analysis 필요
    if to_state == ArticleState.ANALYZED:
        return has_analysis
    
    # CLASSIFIED로 이동: _analysis + _classification 필요
    if to_state == ArticleState.CLASSIFIED:
        return has_analysis and has_classification
    
    # PUBLISHED로 이동: 모든 데이터 필요
    if to_state == ArticleState.PUBLISHED:
        return has_analysis and has_classification and has_publication
    
    # 그 외 (COLLECTED, REJECTED 등) → 정적 규칙만
    return True


def get_best_restorable_state(article_data: dict) -> ArticleState:
    """
    기사 데이터를 기반으로 복원 가능한 가장 진행된 상태 반환
    
    Returns:
        복원 가능한 최고 상태 (CLASSIFIED > ANALYZED > COLLECTED)
    
    Logic:
        - ANALYZED 자격: _analysis.mll_raw 존재 (분석 원본 데이터 필수)
        - CLASSIFIED 자격: ANALYZED 자격 + _classification.category 존재
    """
    analysis = article_data.get('_analysis') or {}
    classification = article_data.get('_classification') or {}
    
    # mll_raw가 있어야 분석이 완료된 것으로 인정
    has_valid_analysis = bool(analysis.get('mll_raw'))
    has_valid_classification = bool(classification.get('category'))
    
    if has_valid_analysis and has_valid_classification:
        return ArticleState.CLASSIFIED
    elif has_valid_analysis:
        return ArticleState.ANALYZED
    else:
        return ArticleState.COLLECTED

