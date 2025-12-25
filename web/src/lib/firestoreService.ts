﻿import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Environment: dev or release
const ZND_ENV = process.env.NEXT_PUBLIC_ZND_ENV || 'release';

/**
 * Get collection reference with environment prefix
 * Structure: {env}/data/{collectionName}
 */
function getCollectionRef(collectionName: string) {
    return collection(db, ZND_ENV, 'data', collectionName);
}

/**
 * Get document reference with environment prefix
 */
function getDocRef(collectionName: string, docId: string) {
    return doc(db, ZND_ENV, 'data', collectionName, docId);
}

// Interface definitions (same as serverCache)
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

// _meta document structure
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
 * Get released issues list
 * [NEW] Query directly from _meta document (1 READ, lightweight)
 */
export async function fetchPublishedIssues(): Promise<{ issues: Issue[], latestUpdatedAt: string | null }> {
    try {
        console.log('📖 [Firestore] Fetching _meta document...');

        // Query from _meta document (1 READ)
        const metaDoc = await getDoc(getDocRef(COLLECTION_PUBLICATIONS, '_meta'));

        if (!metaDoc.exists()) {
            console.log('⚠️ [Firestore] _meta document not found, falling back to full scan...');
            return await fetchPublishedIssuesFallback();
        }

        const metaData = metaDoc.data() as MetaDoc;
        const latestUpdate = metaData.latest_updated_at || null;

        // Filter only released status
        const releasedMeta = (metaData.issues || []).filter(i => i.status === 'released');

        // Convert to Issue format (detailed info from issue document if needed)
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

        // Sort by edition_code descending (higher issue number is latest)
        // edition_code format: YYMMDD_N (e.g. 241224_1, 241224_2)
        issues.sort((a, b) => {
            return b.edition_code.localeCompare(a.edition_code);
        });

        console.log(`✅ [Firestore] Found ${issues.length} released issues from _meta`);
        return { issues, latestUpdatedAt: latestUpdate };

    } catch (error) {
        console.error('❌ [Firestore] Failed to fetch _meta:', error);
        return await fetchPublishedIssuesFallback();
    }
}

/**
 * Fallback: Full publications scan (legacy method, when _meta is missing)
 */
async function fetchPublishedIssuesFallback(): Promise<{ issues: Issue[], latestUpdatedAt: string | null }> {
    try {
        console.log('📖 [Firestore] Fallback: scanning all publications...');
        const snapshot = await getDocs(getCollectionRef(COLLECTION_PUBLICATIONS));

        let allIssues: Issue[] = [];
        let latestUpdate: string | null = null;

        snapshot.forEach((docSnap) => {
            const docId = docSnap.id;
            // Exclude _meta, _article_ids
            if (docId.startsWith('_')) return;

            const data = docSnap.data();
            allIssues.push({
                id: docSnap.id,
                ...data
            } as Issue);
        });

        const releasedIssues = allIssues.filter(issue => issue.status === 'released');

        // Sort by edition_code descending (higher issue number is latest)
        releasedIssues.sort((a, b) => {
            return b.edition_code.localeCompare(a.edition_code);
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
 * Fetch articles for a specific issue (issueId)
 * [NEW] Use embedded articles array in publications document (1 READ)
 */
export async function fetchArticlesByIssueId(issueId: string): Promise<Article[]> {
    try {
        // console.log(`📖 [Firestore] Fetching articles for issue: ${issueId}`);

        // Read articles array directly from issue document (1 READ)
        const pubDoc = await getDoc(getDocRef(COLLECTION_PUBLICATIONS, issueId));

        if (!pubDoc.exists()) {
            console.log(`⚠️ [Firestore] Publication not found: ${issueId}`);
            return [];
        }

        const pubData = pubDoc.data();
        const articles: Article[] = pubData.articles || [];

        // Ensure article_id field exists
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
 * Check latest update timestamp
 * [NEW] Check latest_updated_at from _meta document (1 READ, lightweight)
 */
export async function checkLatestUpdate(): Promise<string | null> {
    try {
        // Check latest_updated_at from _meta document (1 READ)
        const metaDoc = await getDoc(getDocRef(COLLECTION_PUBLICATIONS, '_meta'));

        if (metaDoc.exists()) {
            const metaData = metaDoc.data() as MetaDoc;
            return metaData.latest_updated_at || null;
        }

        // Fallback if _meta not found
        console.log('⚠️ [Firestore] _meta not found, falling back...');
        const { latestUpdatedAt } = await fetchPublishedIssuesFallback();
        return latestUpdatedAt;

    } catch (error) {
        console.error('❌ [Firestore] checkLatestUpdate failed:', error);
        return null;
    }
}
