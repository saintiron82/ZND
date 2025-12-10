/**
 * ZS Score Feedback System - Type Definitions
 * 
 * 인터페이스 기반 설계로 저장소 교체 가능
 * - 1차: 파일 기반 (FileFeedbackStore)
 * - 추후: Firebase, Supabase 등으로 교체 가능
 */

// 피드백 투표 타입
export type FeedbackVote = 'lower' | 'agree' | 'higher';

// 단일 피드백 레코드
export interface FeedbackRecord {
    articleId: string;
    date: string;           // YYYY-MM-DD
    vote: FeedbackVote;
    clientId: string;       // 익명 클라이언트 식별자 (중복 방지)
    createdAt: string;      // ISO timestamp
}

// 기사별 집계 데이터
export interface FeedbackAggregate {
    articleId: string;
    date: string;
    votes: {
        lower: number;
        agree: number;
        higher: number;
    };
    totalVotes: number;
    lastUpdated: string;
}

// 피드백 제출 요청
export interface SubmitFeedbackRequest {
    articleId: string;
    date: string;
    vote: FeedbackVote;
    clientId: string;
}

// 피드백 제출 응답
export interface SubmitFeedbackResponse {
    success: boolean;
    message: string;
    aggregate?: FeedbackAggregate;
    alreadyVoted?: boolean;
}

// 피드백 조회 요청
export interface GetFeedbackRequest {
    articleId: string;
    date: string;
}

/**
 * IFeedbackStore Interface
 * 
 * 모든 피드백 저장소가 구현해야 하는 인터페이스
 * 이 인터페이스만 따르면 어떤 저장소든 교체 가능
 */
export interface IFeedbackStore {
    /**
     * 피드백 제출
     * @param request 피드백 제출 요청
     * @returns 제출 결과 및 집계 데이터
     */
    submitFeedback(request: SubmitFeedbackRequest): Promise<SubmitFeedbackResponse>;

    /**
     * 특정 기사의 피드백 집계 조회
     * @param articleId 기사 ID
     * @param date 날짜 (YYYY-MM-DD)
     * @returns 집계 데이터 또는 null
     */
    getAggregate(articleId: string, date: string): Promise<FeedbackAggregate | null>;

    /**
     * 특정 날짜의 모든 기사 피드백 집계 조회
     * @param date 날짜 (YYYY-MM-DD)
     * @returns 기사별 집계 데이터 맵
     */
    getAggregatesByDate(date: string): Promise<Map<string, FeedbackAggregate>>;

    /**
     * 사용자가 이미 투표했는지 확인
     * @param articleId 기사 ID
     * @param date 날짜
     * @param clientId 클라이언트 ID
     * @returns 투표 여부
     */
    hasVoted(articleId: string, date: string, clientId: string): Promise<boolean>;
}

/**
 * 저장소 타입 (확장 가능)
 */
export type StoreType = 'file' | 'firebase' | 'supabase';
