import { fetchTrendReports } from '@/lib/firestoreService';
import ReportsPageClient from '@/components/ReportsPageClient';

// 캐시 설정: 매 요청마다 최신 버전 체크 (시간 제한 없음)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
    title: '트렌드 리포트 & 분석',
    description: 'ZND AI가 분석한 심층 트렌드 리포트와 키워드 인사이트를 확인하세요.',
    openGraph: {
        title: '트렌드 리포트 - ZeroEcho.Daily',
        description: '글로벌 테크 트렌드 심층 분석 보고서',
    }
};

export default async function ReportsPage() {
    // 서버 사이드에서 직접 데이터 페칭 (API 라우트 우회)
    const reports = await fetchTrendReports(20);

    return <ReportsPageClient initialReports={reports} />;
}
