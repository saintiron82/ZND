import { NextRequest, NextResponse } from 'next/server';
import { fetchArticlesByIssueId } from '@/lib/firestoreService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/publications/view
 * Firestore 직접 조회 (Backend Proxy 제거됨)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const publishId = searchParams.get('publish_id');

        if (!publishId) {
            return NextResponse.json(
                { success: false, error: 'publish_id is required' },
                { status: 400 }
            );
        }

        const articles = await fetchArticlesByIssueId(publishId);

        return NextResponse.json({
            success: true,
            articles
        });

    } catch (error) {
        console.error('Publications view error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch articles' },
            { status: 500 }
        );
    }
}
