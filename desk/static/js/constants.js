/**
 * ZND Desk - Shared Constants
 * 명명 규칙 통일을 위한 상수 정의
 */

const ArticleState = {
    // 수집 단계
    COLLECTED: "COLLECTED",      // 수집됨

    // 분석 단계
    ANALYZING: "ANALYZING",      // 분석중
    ANALYZED: "ANALYZED",        // 분석완료
    REJECTED: "REJECTED",        // 폐기됨

    // 분류 단계
    CLASSIFIED: "CLASSIFIED",    // 분류됨

    // 발행 단계
    PUBLISHED: "PUBLISHED",      // 발행됨
    RELEASED: "RELEASED"         // 공개됨
};

// UI 표시용 라벨 (Optional helper)
const ArticleStateLabel = {
    [ArticleState.COLLECTED]: "수집됨",
    [ArticleState.ANALYZING]: "분석중",
    [ArticleState.ANALYZED]: "분석완료",
    [ArticleState.REJECTED]: "폐기됨",
    [ArticleState.CLASSIFIED]: "분류됨",
    [ArticleState.PUBLISHED]: "발행됨",
    [ArticleState.RELEASED]: "공개됨"
};
