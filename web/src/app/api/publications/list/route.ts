import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5500';

/**
 * GET /api/publications/list
 * Flask 백엔드의 /api/publications/list를 프록시
 * Query params: date (optional), status (optional: 'preview', 'released')
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const status = searchParams.get('status');

        // 기본값: released만 표시 (일반 사용자용)
        const statusParam = status || 'released';

        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (statusParam) params.append('status', statusParam);

        const url = `${BACKEND_URL}/api/publications/list?${params.toString()}`;

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
        console.error('Publications list proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch publications' },
            { status: 500 }
        );
    }
}
