import { NextRequest, NextResponse } from 'next/server';
import { incrementEditionView } from '@/lib/analyticsService';

/**
 * POST /api/stats/view
 * 호별 뷰 카운터 API
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { edition_code } = body;

        if (!edition_code) {
            return NextResponse.json(
                { success: false, error: 'edition_code is required' },
                { status: 400 }
            );
        }

        await incrementEditionView(edition_code);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Stats/View] 오류:', error);
        return NextResponse.json(
            { success: false, error: '서버 오류' },
            { status: 500 }
        );
    }
}
