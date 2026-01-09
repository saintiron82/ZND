import { fetchTrendReports } from '@/lib/firestoreService';
import ReportsPageClient from '@/components/ReportsPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportsPage() {
    // 서버 사이드에서 직접 데이터 페칭 (API 라우트 우회)
    const reports = await fetchTrendReports(20);

    return <ReportsPageClient initialReports={reports} />;
}
