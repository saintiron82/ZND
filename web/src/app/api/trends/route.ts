import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, limit, doc } from 'firebase/firestore';

// Environment: dev or release
const ZND_ENV = process.env.NEXT_PUBLIC_ZND_ENV || 'release';

/**
 * GET /api/trends
 * 트렌드 리포트 목록 조회
 */
export async function GET() {
    try {
        const reportsRef = collection(db, ZND_ENV, 'data', 'trend_reports');
        const q = query(reportsRef, orderBy('created_at', 'desc'), limit(20));
        const snapshot = await getDocs(q);

        const reports = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                period: data.period || {},
                top_trends: data.top_trends || [],
                tag_rankings: data.tag_rankings || [],
                weekly_insight: data.weekly_insight || '',
                next_week_outlook: data.next_week_outlook || '',
                created_at: data.created_at || ''
            };
        });

        return NextResponse.json({
            success: true,
            reports
        });
    } catch (error) {
        console.error('[API /trends] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
