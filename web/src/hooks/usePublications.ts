'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPublicationsWithCache, invalidateCache, isCacheValid } from '@/lib/publicationsCache';

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
    publish_id?: string;
    [key: string]: any;
}

interface UsePublicationsResult {
    issues: Issue[];
    articles: Article[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    isFromCache: boolean;
}

/**
 * Publications 데이터를 캐싱과 함께 가져오는 훅
 * - 첫 로드 시: 전체 데이터 fetch
 * - 이후: 변경 체크 후 캐시 사용 또는 갱신
 */
export function usePublications(initialIssues?: Issue[], initialArticles?: Article[]): UsePublicationsResult {
    const [issues, setIssues] = useState<Issue[]>(initialIssues || []);
    const [articles, setArticles] = useState<Article[]>(initialArticles || []);
    const [loading, setLoading] = useState(!initialIssues);
    const [error, setError] = useState<string | null>(null);
    const [isFromCache, setIsFromCache] = useState(false);

    const fetchData = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setError(null);

        try {
            if (forceRefresh) {
                invalidateCache();
            }

            const result = await getPublicationsWithCache();

            setIssues(result.issues);
            setArticles(result.articles);
            setIsFromCache(isCacheValid());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch publications');
        } finally {
            setLoading(false);
        }
    }, []);

    // 초기 데이터가 없으면 fetch
    useEffect(() => {
        if (!initialIssues || initialIssues.length === 0) {
            fetchData();
        }
    }, [initialIssues, fetchData]);

    // 강제 새로고침
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);

    return {
        issues,
        articles,
        loading,
        error,
        refresh,
        isFromCache
    };
}
