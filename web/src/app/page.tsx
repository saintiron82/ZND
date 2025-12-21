import HomePageClient from '@/components/HomePageClient';
import { getPublicationsWithServerCache } from '@/lib/serverCache';

// 캐시 설정: 매 요청마다 최신 버전 체크 (시간 제한 없음)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  // 서버 공유 캐시 사용: 변경 있을 때만 Firestore 조회
  const { issues, articles } = await getPublicationsWithServerCache();

  return <HomePageClient articles={articles} issues={issues} />;
}

