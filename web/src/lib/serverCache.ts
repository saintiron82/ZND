/**
 * 서버 사이드 공유 캐시
 * - 모든 사용자가 같은 캐시 공유
 * - 접속 시 최신 버전 확인 후 조건부 갱신
 * - [Refactor] 2025-12: Backend API 의존성 제거 -> Firestore 직접 조회
 */

import { optimizeArticleOrder } from '@/utils/layoutOptimizer';
import {
    fetchPublishedIssues,
    fetchArticlesByIssueId,
    checkLatestUpdate,
    Issue,
    Article
} from './firestoreService';

interface ServerCache {
    issues: Issue[];
    articles: Article[];
    lastUpdatedAt: string | null;
}

// 서버 메모리 공유 캐시 (모든 요청이 공유)
let serverCache: ServerCache | null = null;

/**
 * 백엔드(DB)에서 최신 버전 확인
 */
async function checkForUpdates(): Promise<{ changed: boolean; latestUpdatedAt: string | null }> {
    try {
        const currentVersion = serverCache?.lastUpdatedAt;
        const latestVersion = await checkLatestUpdate();

        // DB에 데이터가 없거나 에러면 변경 없는 것으로 처리 (안전장치)
        if (!latestVersion) {
            return { changed: false, latestUpdatedAt: currentVersion || null };
        }

        const changed = currentVersion !== latestVersion;

        if (changed) {
            console.log(`[ServerCache] Detect Change: ${currentVersion} -> ${latestVersion}`);
        } else {
            console.log(`[ServerCache] No Change (Latest: ${latestVersion})`);
        }

        return { changed, latestUpdatedAt: latestVersion };

    } catch (error) {
        console.error('[ServerCache] Check error:', error);
        return { changed: true, latestUpdatedAt: null };
    }
}

/**
 * 전체 데이터 가져오기 (Firestore 직접 조회)
 */
async function fetchAllData(): Promise<{ issues: Issue[]; articles: Article[]; latestUpdatedAt: string | null }> {
    console.log('[ServerCache] Fetching fresh data from Firestore (Direct)...');

    try {
        // 1. 회차 목록 조회
        const { issues, latestUpdatedAt } = await fetchPublishedIssues();

        if (issues.length === 0) {
            console.warn('[ServerCache] No issues found.');
            return { issues: [], articles: [], latestUpdatedAt: null };
        }

        // 2. 각 회차의 기사 조회 (병렬)
        const articlePromises = issues.map(async (issue) => {
            try {
                const articles = await fetchArticlesByIssueId(issue.id);
                // Layout Optimizer 적용 및 메타데이터 주입
                return optimizeArticleOrder(articles).map((article: Article) => ({
                    ...article,
                    publish_id: issue.id,
                    edition_name: issue.edition_name,
                    edition_code: issue.edition_code,
                }));
            } catch (err) {
                console.error(`[ServerCache] Failed to fetch articles for issue ${issue.id}`, err);
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
        // console.log('[ServerCache] Using cached data ✅');
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
