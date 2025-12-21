/**
 * Publications 캐시 유틸리티
 * - 메모리 캐시로 불필요한 API 호출 방지
 * - 최신 버전 체크 후 조건부 데이터 갱신
 */

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

interface CacheData {
    issues: Issue[];
    articles: Article[];
    lastUpdatedAt: string | null;
    fetchedAt: number;  // timestamp
}

// 메모리 캐시 (브라우저 세션 동안 유지)
let publicationsCache: CacheData | null = null;

// 캐시 유효 시간 (5분)
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 캐시가 유효한지 확인
 */
export function isCacheValid(): boolean {
    if (!publicationsCache) return false;

    const now = Date.now();
    return (now - publicationsCache.fetchedAt) < CACHE_TTL_MS;
}

/**
 * 캐시에서 데이터 반환 (유효한 경우에만)
 */
export function getCachedData(): CacheData | null {
    if (isCacheValid()) {
        return publicationsCache;
    }
    return null;
}

/**
 * 캐시 업데이트
 */
export function updateCache(issues: Issue[], articles: Article[], latestUpdatedAt: string | null): void {
    publicationsCache = {
        issues,
        articles,
        lastUpdatedAt: latestUpdatedAt,
        fetchedAt: Date.now()
    };

    console.log('📦 [Cache] Updated:', {
        issueCount: issues.length,
        articleCount: articles.length,
        lastUpdatedAt: latestUpdatedAt
    });
}

/**
 * 캐시 무효화
 */
export function invalidateCache(): void {
    publicationsCache = null;
    console.log('🗑️ [Cache] Invalidated');
}

/**
 * 서버에서 변경 여부 체크
 */
export async function checkForUpdates(): Promise<{ changed: boolean; latestUpdatedAt: string | null }> {
    try {
        const since = publicationsCache?.lastUpdatedAt || '';
        const response = await fetch(`/api/publications/check?since=${encodeURIComponent(since)}&status=released`);
        const data = await response.json();

        if (!data.success) {
            console.warn('⚠️ [Cache] Check failed:', data.error);
            return { changed: true, latestUpdatedAt: null };
        }

        console.log('🔍 [Cache] Check result:', data.changed ? 'CHANGED' : 'NO CHANGE');

        return {
            changed: data.changed,
            latestUpdatedAt: data.latest_updated_at
        };
    } catch (error) {
        console.error('❌ [Cache] Check error:', error);
        return { changed: true, latestUpdatedAt: null };  // 오류 시 새로 가져오기
    }
}

/**
 * 데이터 가져오기 (캐싱 적용)
 */
export async function getPublicationsWithCache(): Promise<{ issues: Issue[]; articles: Article[] }> {
    // 1. 캐시가 유효하면 먼저 변경 체크
    if (isCacheValid() && publicationsCache) {
        const { changed } = await checkForUpdates();

        if (!changed) {
            console.log('✅ [Cache] Using cached data');
            return {
                issues: publicationsCache.issues,
                articles: publicationsCache.articles
            };
        }
    }

    // 2. 변경 있거나 캐시 없으면 새로 가져오기
    console.log('🔄 [Cache] Fetching fresh data...');

    try {
        const response = await fetch('/api/publications/list?status=released');
        const listData = await response.json();

        if (!listData.success) {
            throw new Error(listData.error || 'Failed to fetch issues');
        }

        const issues: Issue[] = listData.issues || [];
        const latestUpdatedAt: string | null = listData.latest_updated_at || null;

        // 각 회차의 기사 가져오기
        const allArticles: Article[] = [];

        for (const issue of issues) {
            try {
                const articleResponse = await fetch(`/api/publications/view?publish_id=${issue.id}`);
                const articleData = await articleResponse.json();

                if (articleData.success && articleData.articles) {
                    articleData.articles.forEach((article: Article) => {
                        allArticles.push({
                            ...article,
                            publish_id: issue.id,
                            edition_name: issue.edition_name,
                            edition_code: issue.edition_code,
                        });
                    });
                }
            } catch (err) {
                console.error(`Failed to fetch articles for issue ${issue.id}:`, err);
            }
        }

        // 캐시 업데이트
        updateCache(issues, allArticles, latestUpdatedAt);

        return { issues, articles: allArticles };
    } catch (error) {
        console.error('❌ [Cache] Fetch error:', error);

        // 오류 시 캐시 데이터라도 반환
        if (publicationsCache) {
            return {
                issues: publicationsCache.issues,
                articles: publicationsCache.articles
            };
        }

        return { issues: [], articles: [] };
    }
}
