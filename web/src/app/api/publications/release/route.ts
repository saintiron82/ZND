import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

/**
 * POST /api/publications/release
 * Flask 백엔드의 /api/publications/release를 프록시
 * Body: { publish_id: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const response = await fetch(`${BACKEND_URL}/api/publications/release`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        return NextResponse.json(data, {
            status: response.status,
        });
    } catch (error) {
        console.error('Publications release proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to release publication' },
            { status: 500 }
        );
    }
}
