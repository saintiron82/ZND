import { NextRequest, NextResponse } from 'next/server';
import { fetchPublishedIssues } from '@/lib/firestoreService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/publications/list
 * Firestore 직접 조회 (Backend Proxy 제거됨)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        // status 파라미터가 있지만, 현재 fetchPublishedIssues는 'released'만 가져옴
        // 필요하다면 service 확장이 필요하지만, 일단 기존 로직(released only) 준수

        const { issues, latestUpdatedAt } = await fetchPublishedIssues();

        return NextResponse.json({
            success: true,
            issues,
            latest_updated_at: latestUpdatedAt
        });

    } catch (error) {
        console.error('Publications list error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch publications' },
            { status: 500 }
        );
    }
}
