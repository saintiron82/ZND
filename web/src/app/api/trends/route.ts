import { NextResponse } from 'next/server';
import { fetchTrendReports } from '@/lib/firestoreService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trends
 * 트렌드 리포트 목록 조회 (Using Centralized Service)
 */
export async function GET() {
    try {
        const reports = await fetchTrendReports(20);

        return NextResponse.json({
            success: true,
            reports
        });
    } catch (error: any) {
        console.error('[API /trends] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
