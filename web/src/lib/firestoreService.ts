import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

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
    title?: string;
    summary?: string;
    url?: string;
    impact_score?: number;
    zero_echo_score?: number;
    published_at?: string;
    publish_id?: string;
    [key: string]: any;
}

// _meta 문서 구조
interface MetaIssue {
    code: string;
    name: string;
    count: number;
    updated_at: string;
    status: 'preview' | 'released';
}

interface MetaDoc {
    issues: MetaIssue[];
    latest_updated_at: string;
}

const COLLECTION_PUBLICATIONS = 'publications';

/**
 * 공개된(released) 회차 목록 가져오기
 * [NEW] _meta 문서에서 직접 조회 (1 READ, 경량)
 */
export async function fetchPublishedIssues(): Promise<{ issues: Issue[], latestUpdatedAt: string | null }> {
    try {
        console.log('🔥 [Firestore] Fetching _meta document...');

        // _meta 문서에서 목록 조회 (1 READ)
        const metaDoc = await getDoc(doc(db, COLLECTION_PUBLICATIONS, '_meta'));

        if (!metaDoc.exists()) {
            console.log('⚠️ [Firestore] _meta document not found, falling back to full scan...');
            return await fetchPublishedIssuesFallback();
        }

        const metaData = metaDoc.data() as MetaDoc;
        const latestUpdate = metaData.latest_updated_at || null;

        // released 상태인 것만 필터링
        const releasedMeta = (metaData.issues || []).filter(i => i.status === 'released');

        // Issue 형식으로 변환 (상세 정보는 회차 문서에서 가져와야 함)
        const issues: Issue[] = releasedMeta.map(meta => ({
            id: meta.code,
            edition_code: meta.code,
            edition_name: meta.name,
            article_count: meta.count,
            published_at: meta.updated_at,
            updated_at: meta.updated_at,
            status: meta.status,
            date: meta.code.replace(/_\d+$/, '').replace(/(\d{2})(\d{2})(\d{2})/, '20$1-$2-$3')
        }));

        // published_at 내림차순 정렬
        issues.sort((a, b) => {
            const dateA = new Date(a.published_at || 0).getTime();
            const dateB = new Date(b.published_at || 0).getTime();
            return dateB - dateA;
        });

        console.log(`✅ [Firestore] Found ${issues.length} released issues from _meta`);
        return { issues, latestUpdatedAt: latestUpdate };

    } catch (error) {
        console.error('❌ [Firestore] Failed to fetch _meta:', error);
        return await fetchPublishedIssuesFallback();
    }
}

/**
 * 폴백: 전체 publications 스캔 (기존 방식, _meta 없을 때)
 */
async function fetchPublishedIssuesFallback(): Promise<{ issues: Issue[], latestUpdatedAt: string | null }> {
    try {
        console.log('🔥 [Firestore] Fallback: scanning all publications...');
        const snapshot = await getDocs(collection(db, COLLECTION_PUBLICATIONS));

        let allIssues: Issue[] = [];
        let latestUpdate: string | null = null;

        snapshot.forEach((docSnap) => {
            const docId = docSnap.id;
            // _meta, _article_ids 제외
            if (docId.startsWith('_')) return;

            const data = docSnap.data();
            allIssues.push({
                id: docSnap.id,
                ...data
            } as Issue);
        });

        const releasedIssues = allIssues.filter(issue => issue.status === 'released');

        releasedIssues.sort((a, b) => {
            const dateA = new Date(a.published_at || 0).getTime();
            const dateB = new Date(b.published_at || 0).getTime();
            return dateB - dateA;
        });

        for (const issue of releasedIssues) {
            if (issue.updated_at) {
                if (!latestUpdate || new Date(issue.updated_at) > new Date(latestUpdate)) {
                    latestUpdate = issue.updated_at;
                }
            }
        }

        console.log(`✅ [Firestore] Fallback found ${releasedIssues.length} released issues`);
        return { issues: releasedIssues, latestUpdatedAt: latestUpdate };
    } catch (error) {
        console.error('❌ [Firestore] Fallback failed:', error);
        return { issues: [], latestUpdatedAt: null };
    }
}

/**
 * 특정 회차(issueId)의 기사 목록 가져오기
 * [NEW] publications 문서의 내장된 articles 배열 사용 (1 READ)
 */
export async function fetchArticlesByIssueId(issueId: string): Promise<Article[]> {
    try {
        // console.log(`🔥 [Firestore] Fetching articles for issue: ${issueId}`);

        // 회차 문서에서 직접 articles 배열 읽기 (1 READ)
        const pubDoc = await getDoc(doc(db, COLLECTION_PUBLICATIONS, issueId));

        if (!pubDoc.exists()) {
            console.log(`❌ [Firestore] Publication not found: ${issueId}`);
            return [];
        }

        const pubData = pubDoc.data();
        const articles: Article[] = pubData.articles || [];

        // article_id 필드 정규화
        return articles.map(art => ({
            ...art,
            article_id: art.id || art.article_id,
            id: art.id || art.article_id
        }));

    } catch (error) {
        console.error(`❌ [Firestore] Failed to fetch articles for ${issueId}:`, error);
        return [];
    }
}


/**
 * 최신 변경 사항 확인 
 * [NEW] _meta 문서의 latest_updated_at 확인 (1 READ, 경량)
 */
export async function checkLatestUpdate(): Promise<string | null> {
    try {
        // _meta 문서에서 latest_updated_at 확인 (1 READ)
        const metaDoc = await getDoc(doc(db, COLLECTION_PUBLICATIONS, '_meta'));

        if (metaDoc.exists()) {
            const metaData = metaDoc.data() as MetaDoc;
            return metaData.latest_updated_at || null;
        }

        // _meta 없으면 폴백
        console.log('⚠️ [Firestore] _meta not found, falling back...');
        const { latestUpdatedAt } = await fetchPublishedIssuesFallback();
        return latestUpdatedAt;

    } catch (error) {
        console.error('❌ [Firestore] checkLatestUpdate failed:', error);
        return null;
    }
}
