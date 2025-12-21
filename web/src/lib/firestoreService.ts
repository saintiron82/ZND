import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

// 타입 정의 (serverCache와 동일하게 유지)
export interface Issue {
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

export interface Article {
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

const COLLECTION_PUBLICATIONS = 'publications';
const COLLECTION_ARTICLES = 'articles';

/**
 * 공개된(released) 회차 목록 가져오기
 * 복합 인덱스 불필요: 전체 가져온 후 클라이언트에서 필터링/정렬
 */
export async function fetchPublishedIssues(): Promise<{ issues: Issue[], latestUpdatedAt: string | null }> {
    try {
        console.log('🔥 [Firestore] Fetching all publications...');

        // 단순 쿼리: 컬렉션 전체 조회 (인덱스 불필요)
        const snapshot = await getDocs(collection(db, COLLECTION_PUBLICATIONS));

        let allIssues: Issue[] = [];
        let latestUpdate: string | null = null;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allIssues.push({
                id: docSnap.id,
                ...data
            } as Issue);
        });

        // 클라이언트에서 status 필터링
        const releasedIssues = allIssues.filter(issue => issue.status === 'released');

        // 클라이언트에서 published_at 내림차순 정렬
        releasedIssues.sort((a, b) => {
            const dateA = new Date(a.published_at || 0).getTime();
            const dateB = new Date(b.published_at || 0).getTime();
            return dateB - dateA;
        });

        // 최신 업데이트 시간 추적
        for (const issue of releasedIssues) {
            if (issue.updated_at) {
                if (!latestUpdate || new Date(issue.updated_at) > new Date(latestUpdate)) {
                    latestUpdate = issue.updated_at;
                }
            }
        }

        console.log(`✅ [Firestore] Found ${releasedIssues.length} released issues`);
        return { issues: releasedIssues, latestUpdatedAt: latestUpdate };
    } catch (error) {
        console.error('❌ [Firestore] Failed to fetch issues:', error);
        return { issues: [], latestUpdatedAt: null };
    }
}

/**
 * 특정 회차(publish_id)의 기사 목록 가져오기
 */
export async function fetchArticlesByIssueId(issueId: string): Promise<Article[]> {
    try {
        // console.log(`🔥 [Firestore] Fetching articles for issue: ${issueId}`);
        const q = query(
            collection(db, COLLECTION_ARTICLES),
            where('publish_id', '==', issueId)
        );

        const snapshot = await getDocs(q);
        const articles: Article[] = [];

        snapshot.forEach((docSnap) => {
            articles.push({
                id: docSnap.id,
                article_id: docSnap.id, // 호환성 유지
                ...docSnap.data()
            } as Article);
        });

        return articles;
    } catch (error) {
        console.error(`❌ [Firestore] Failed to fetch articles for ${issueId}:`, error);
        return [];
    }
}

/**
 * 최신 변경 사항 확인 
 * 복합 인덱스 불필요: 전체 가져온 후 클라이언트에서 필터링
 */
export async function checkLatestUpdate(): Promise<string | null> {
    try {
        // 단순 쿼리: 전체 조회
        const snapshot = await getDocs(collection(db, COLLECTION_PUBLICATIONS));

        let latestUpdate: string | null = null;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // released 상태만 체크
            if (data.status === 'released' && data.updated_at) {
                if (!latestUpdate || new Date(data.updated_at) > new Date(latestUpdate)) {
                    latestUpdate = data.updated_at;
                }
            }
        });

        return latestUpdate;
    } catch (error) {
        return null;
    }
}
