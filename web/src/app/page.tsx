import HomePageClient from '@/components/HomePageClient';
import { optimizeArticleOrder } from '@/utils/layoutOptimizer';

// CACHE CONFIGURATION
// Revalidate every 5 minutes for released publications
export const revalidate = 300;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5500';

interface Issue {
  id: string;
  edition_code: string;
  edition_name: string;
  article_count: number;
  published_at: string;
  released_at?: string;
  status: 'preview' | 'released';
  date: string;
}

interface Article {
  article_id?: string;
  id?: string;
  title_ko?: string;
  summary?: string;
  url?: string;
  impact_score?: number;
  zero_echo_score?: number;
  published_at?: string;
  [key: string]: any;
}

/**
 * 회차 목록 조회 (released만)
 */
async function getIssues(): Promise<Issue[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/publications/list?status=released`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('Failed to fetch issues:', res.status);
      return [];
    }

    const data = await res.json();
    return data.success ? data.issues : [];
  } catch (error) {
    console.error('Error fetching issues:', error);
    return [];
  }
}

/**
 * 특정 회차의 기사 조회
 */
async function getArticlesByIssue(publishId: string): Promise<Article[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/publications/view?publish_id=${publishId}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('Failed to fetch articles:', res.status);
      return [];
    }

    const data = await res.json();
    if (!data.success) return [];

    // 레이아웃 최적화 적용
    const articles = data.articles || [];
    return optimizeArticleOrder(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

/**
 * 모든 released 회차의 기사를 가져와서 합침
 */
async function getAllArticles(): Promise<{ issues: Issue[]; articles: Article[] }> {
  const issues = await getIssues();

  if (issues.length === 0) {
    return { issues: [], articles: [] };
  }

  // 모든 회차의 기사를 병렬로 가져옴
  const articlePromises = issues.map(issue => getArticlesByIssue(issue.id));
  const articlesArrays = await Promise.all(articlePromises);

  // 기사에 회차 정보 추가하고 합침
  const allArticles: Article[] = [];
  issues.forEach((issue, idx) => {
    const issueArticles = articlesArrays[idx] || [];
    issueArticles.forEach(article => {
      allArticles.push({
        ...article,
        publish_id: issue.id,
        edition_name: issue.edition_name,
        edition_code: issue.edition_code,
      });
    });
  });

  return { issues, articles: allArticles };
}

export default async function Home() {
  const { issues, articles } = await getAllArticles();
  return <HomePageClient articles={articles} issues={issues} />;
}
