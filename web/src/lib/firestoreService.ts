import { db } from './firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';

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

const COLLECTION_ISSUES = 'issues';
const COLLECTION_ARTICLES = 'articles';

/**
 * 공개된(released) 회차 목록 가져오기
 */
export async function fetchPublishedIssues(): Promise<{ issues: Issue[], latestUpdatedAt: string | null }> {
    try {
        console.log('🔥 [Firestore] Fetching published issues...');
        const q = query(
            collection(db, COLLECTION_ISSUES),
            where('status', '==', 'released'),
            orderBy('published_at', 'desc')
        );

        const snapshot = await getDocs(q);
        const issues: Issue[] = [];
        let latestUpdate: string | null = null;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            issues.push({
                id: docSnap.id,
                ...data
            } as Issue);

            // 최신 업데이트 시간 추적
            if (data.updated_at) {
                if (!latestUpdate || new Date(data.updated_at) > new Date(latestUpdate)) {
                    latestUpdate = data.updated_at;
                }
            }
        });

        return { issues, latestUpdatedAt: latestUpdate };
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
 * 최신 변경 사항 확인 (단순 구현: 가장 최근 issue의 update 시간 확인)
 * 비용 최적화를 위해 limit(1) 사용
 */
export async function checkLatestUpdate(): Promise<string | null> {
    try {
        const q = query(
            collection(db, COLLECTION_ISSUES),
            where('status', '==', 'released'),
            orderBy('updated_at', 'desc'),
            limit(1)
        );

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data().updated_at || null;
        }
        return null;
    } catch (error) {
        return null;
    }
}
