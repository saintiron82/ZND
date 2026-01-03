import { NextRequest, NextResponse } from 'next/server';
import { incrementArticleClick } from '@/lib/analyticsService';

/**
 * POST /api/stats/click
 * 기사 클릭 카운터 API
 * sendBeacon (text/plain) 및 fetch (application/json) 모두 지원
 */
export async function POST(request: NextRequest) {
    try {
        // sendBeacon은 text/plain으로 전송하므로 두 가지 방식 모두 지원
        let article_id: string | undefined;

        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const body = await request.json();
            article_id = body.article_id;
        } else {
            // sendBeacon: text/plain으로 전송됨
            const text = await request.text();
            try {
                const parsed = JSON.parse(text);
                article_id = parsed.article_id;
            } catch {
                // 파싱 실패
            }
        }

        if (!article_id) {
            return NextResponse.json(
                { success: false, error: 'article_id is required' },
                { status: 400 }
            );
        }

        await incrementArticleClick(article_id);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Stats/Click] 오류:', error);
        return NextResponse.json(
            { success: false, error: '서버 오류' },
            { status: 500 }
        );
    }
}

