import { NextRequest, NextResponse } from 'next/server';
import { checkLatestUpdate } from '@/lib/firestoreService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/publications/check
 * Firestore 직접 조회 (Backend Proxy 제거됨)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const since = searchParams.get('since');

        const latestUpdatedAt = await checkLatestUpdate();

        if (!latestUpdatedAt) {
            // 데이터가 없으면 변경 없음으로 처리
            return NextResponse.json({
                success: true,
                changed: false,
                latest_updated_at: null
            });
        }

        let changed = true;
        if (since && latestUpdatedAt) {
            const sinceDate = new Date(since);
            const latestDate = new Date(latestUpdatedAt);
            if (latestDate <= sinceDate) {
                changed = false;
            }
        }

        return NextResponse.json({
            success: true,
            changed,
            latest_updated_at: latestUpdatedAt
        });

    } catch (error) {
        console.error('Publications check error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to check updates' },
            { status: 500 }
        );
    }
}
