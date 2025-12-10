/**
 * ZS Feedback API Route
 * 
 * POST: 피드백 제출
 * GET: 피드백 집계 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDefaultFeedbackStore, SubmitFeedbackRequest, FeedbackVote } from '@/lib/feedback';

// 허용된 투표 값
const VALID_VOTES: FeedbackVote[] = ['lower', 'agree', 'higher'];

/**
 * POST /api/feedback
 * 피드백 제출
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 필수 필드 검증
        const { articleId, date, vote, clientId } = body;

        if (!articleId || typeof articleId !== 'string') {
            return NextResponse.json(
                { success: false, message: 'articleId is required' },
                { status: 400 }
            );
        }

        if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, message: 'date is required (YYYY-MM-DD format)' },
                { status: 400 }
            );
        }

        if (!vote || !VALID_VOTES.includes(vote)) {
            return NextResponse.json(
                { success: false, message: `vote must be one of: ${VALID_VOTES.join(', ')}` },
                { status: 400 }
            );
        }

        if (!clientId || typeof clientId !== 'string') {
            return NextResponse.json(
                { success: false, message: 'clientId is required' },
                { status: 400 }
            );
        }

        // 피드백 저장
        const store = getDefaultFeedbackStore();
        const feedbackRequest: SubmitFeedbackRequest = {
            articleId,
            date,
            vote,
            clientId,
        };

        const result = await store.submitFeedback(feedbackRequest);

        return NextResponse.json(result, {
            status: result.success ? 200 : 409, // 409 Conflict for duplicate vote
        });

    } catch (error) {
        console.error('[Feedback API] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/feedback?date=YYYY-MM-DD&articleId=xxx
 * 피드백 집계 조회
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const articleId = searchParams.get('articleId');

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { success: false, message: 'date is required (YYYY-MM-DD format)' },
                { status: 400 }
            );
        }

        const store = getDefaultFeedbackStore();

        if (articleId) {
            // 특정 기사 집계 조회
            const aggregate = await store.getAggregate(articleId, date);
            return NextResponse.json({
                success: true,
                aggregate: aggregate || {
                    articleId,
                    date,
                    votes: { lower: 0, agree: 0, higher: 0 },
                    totalVotes: 0,
                    lastUpdated: null,
                },
            });
        } else {
            // 날짜별 전체 집계 조회
            const aggregates = await store.getAggregatesByDate(date);
            return NextResponse.json({
                success: true,
                aggregates: Object.fromEntries(aggregates),
            });
        }

    } catch (error) {
        console.error('[Feedback API] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
