import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5500';

/**
 * GET /api/publications/view
 * Flask 백엔드의 /api/publications/view를 프록시
 * Query params: publish_id (required)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const publishId = searchParams.get('publish_id');

        if (!publishId) {
            return NextResponse.json(
                { success: false, error: 'publish_id required' },
                { status: 400 }
            );
        }

        const url = `${BACKEND_URL}/api/publications/view?publish_id=${publishId}`;

        const response = await fetch(url, {
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        return NextResponse.json(data, {
            status: response.status,
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error) {
        console.error('Publications view proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch publication' },
            { status: 500 }
        );
    }
}
