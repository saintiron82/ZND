import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5500';

/**
 * GET /api/publications/check
 * 캐싱 체크 - 변경 여부만 빠르게 확인
 * Query params: since (ISO timestamp), status (optional)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const since = searchParams.get('since');
        const status = searchParams.get('status') || 'released';

        const params = new URLSearchParams();
        if (since) params.append('since', since);
        if (status) params.append('status', status);

        const url = `${BACKEND_URL}/api/publications/check?${params.toString()}`;

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
        console.error('Publications check proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to check publications' },
            { status: 500 }
        );
    }
}
