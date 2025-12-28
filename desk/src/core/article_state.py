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


# 유효한 상태 전이 규칙
VALID_TRANSITIONS = {
    ArticleState.COLLECTED: [ArticleState.ANALYZING, ArticleState.ANALYZED, ArticleState.REJECTED],
    ArticleState.ANALYZING: [ArticleState.ANALYZED, ArticleState.REJECTED],
    ArticleState.ANALYZED: [ArticleState.CLASSIFIED, ArticleState.REJECTED, ArticleState.ANALYZING, ArticleState.COLLECTED],
    ArticleState.REJECTED: [ArticleState.ANALYZING, ArticleState.COLLECTED],  # 복구 후 재분석 가능
    ArticleState.CLASSIFIED: [ArticleState.PUBLISHED, ArticleState.ANALYZED, ArticleState.COLLECTED, ArticleState.REJECTED],  # 발행 또는 분류 취소, 폐기
    ArticleState.PUBLISHED: [ArticleState.RELEASED, ArticleState.CLASSIFIED, ArticleState.ANALYZED, ArticleState.COLLECTED],  # 공개 또는 발행 취소
    ArticleState.RELEASED: [ArticleState.PUBLISHED],  # 공개 취소
}


def can_transition(from_state: ArticleState, to_state: ArticleState) -> bool:
    """상태 전이가 유효한지 확인"""
    if from_state not in VALID_TRANSITIONS:
        return False
    return to_state in VALID_TRANSITIONS[from_state]
