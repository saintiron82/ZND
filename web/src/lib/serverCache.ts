/**
 * 서버 사이드 공유 캐시
 * - 모든 사용자가 같은 캐시 공유
 * - 접속 시 최신 버전 확인 후 조건부 갱신
 */

import { optimizeArticleOrder } from '@/utils/layoutOptimizer';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5500';

interface Issue {
    id: string;
    edition_code: string;
    edition_name: string;
    article_count: number;
    published_at: string;
    released_at?: string;
    updated_at?: string;
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
    publish_id?: string;
    [key: string]: any;
}

interface ServerCache {
    issues: Issue[];
    articles: Article[];
    lastUpdatedAt: string | null;
}

// 서버 메모리 공유 캐시 (모든 요청이 공유)
let serverCache: ServerCache | null = null;

/**
 * 백엔드에서 최신 버전 확인
 */
async function checkForUpdates(): Promise<{ changed: boolean; latestUpdatedAt: string | null }> {
    try {
        const since = serverCache?.lastUpdatedAt || '';
        const res = await fetch(
            `${BACKEND_URL}/api/publications/check?since=${encodeURIComponent(since)}&status=released`,
            { cache: 'no-store' }
        );

        if (!res.ok) {
            console.error('[ServerCache] Check failed:', res.status);
            return { changed: true, latestUpdatedAt: null };
        }

        const data = await res.json();

        if (!data.success) {
            return { changed: true, latestUpdatedAt: null };
        }

        console.log(`[ServerCache] Check: ${data.changed ? 'CHANGED' : 'NO CHANGE'}`);

        return {
            changed: data.changed,
            latestUpdatedAt: data.latest_updated_at
        };
    } catch (error) {
        console.error('[ServerCache] Check error:', error);
        return { changed: true, latestUpdatedAt: null };
    }
}

/**
 * 전체 데이터 가져오기
 */
async function fetchAllData(): Promise<{ issues: Issue[]; articles: Article[]; latestUpdatedAt: string | null }> {
    console.log('[ServerCache] Fetching fresh data from Firestore...');

    try {
        // 1. 회차 목록 조회
        const listRes = await fetch(
            `${BACKEND_URL}/api/publications/list?status=released`,
            { cache: 'no-store' }
        );

        if (!listRes.ok) {
            throw new Error(`List fetch failed: ${listRes.status}`);
        }

        const listData = await listRes.json();

        if (!listData.success) {
            throw new Error(listData.error || 'List fetch failed');
        }

        const issues: Issue[] = listData.issues || [];
        const latestUpdatedAt = listData.latest_updated_at || null;

        // 2. 각 회차의 기사 조회 (병렬)
        const articlePromises = issues.map(async (issue) => {
            try {
                const res = await fetch(
                    `${BACKEND_URL}/api/publications/view?publish_id=${issue.id}`,
                    { cache: 'no-store' }
                );

                if (!res.ok) return [];

                const data = await res.json();
                if (!data.success) return [];

                const articles = data.articles || [];
                return optimizeArticleOrder(articles).map((article: Article) => ({
                    ...article,
                    publish_id: issue.id,
                    edition_name: issue.edition_name,
                    edition_code: issue.edition_code,
                }));
            } catch {
                return [];
            }
        });

        const articlesArrays = await Promise.all(articlePromises);
        const allArticles = articlesArrays.flat();

        console.log(`[ServerCache] Fetched ${issues.length} issues, ${allArticles.length} articles`);

        return { issues, articles: allArticles, latestUpdatedAt };
    } catch (error) {
        console.error('[ServerCache] Fetch error:', error);
        return { issues: [], articles: [], latestUpdatedAt: null };
    }
}

/**
 * 캐시된 데이터 가져오기 (메인 함수)
 * - 캐시 없으면: 전체 fetch
 * - 캐시 있으면: 변경 체크 후 조건부 갱신
 */
export async function getPublicationsWithServerCache(): Promise<{ issues: Issue[]; articles: Article[] }> {
    // 캐시가 없으면 전체 fetch
    if (!serverCache) {
        const data = await fetchAllData();
        serverCache = {
            issues: data.issues,
            articles: data.articles,
            lastUpdatedAt: data.latestUpdatedAt
        };
        return { issues: data.issues, articles: data.articles };
    }

    // 캐시가 있으면 변경 체크
    const { changed, latestUpdatedAt } = await checkForUpdates();

    if (!changed) {
        console.log('[ServerCache] Using cached data ✅');
        return { issues: serverCache.issues, articles: serverCache.articles };
    }

    // 변경 있으면 전체 갱신
    console.log('[ServerCache] Data changed, refreshing...');
    const data = await fetchAllData();
    serverCache = {
        issues: data.issues,
        articles: data.articles,
        lastUpdatedAt: data.latestUpdatedAt || latestUpdatedAt
    };

    return { issues: data.issues, articles: data.articles };
}

/**
 * 캐시 무효화 (수동)
 */
export function invalidateServerCache(): void {
    serverCache = null;
    console.log('[ServerCache] Invalidated');
}
