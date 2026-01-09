﻿import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import {
    PublicationSchemaParser,
    NormalizedIssue,
    NormalizedArticle,
    normalizeArticles
} from './schemaParser';

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

// Note: MetaIssue/MetaDoc are raw Firestore types
// Use PublicationSchemaParser for normalized output

interface MetaDoc {
    issues: any[];  // Raw issues from Firestore
    latest_updated_at: string;
}

const COLLECTION_PUBLICATIONS = 'publications';

/**
 * Get released issues list
 * [REFACTORED] Uses PublicationSchemaParser for version-agnostic parsing
 * @param includePreview - true이면 preview 상태도 포함 (숨겨진 미리보기 모드)
 */
export async function fetchPublishedIssues(includePreview: boolean = false): Promise<{ issues: Issue[], latestUpdatedAt: string | null }> {
    try {
        console.log(`📖 [Firestore] Fetching _meta document... (includePreview: ${includePreview})`);

        // Query from _meta document (1 READ)
        const metaDoc = await getDoc(getDocRef(COLLECTION_PUBLICATIONS, '_meta'));

        if (!metaDoc.exists()) {
            console.log('⚠️ [Firestore] _meta document not found, falling back to full scan...');
            return await fetchPublishedIssuesFallback();
        }

        const metaData = metaDoc.data() as MetaDoc;
        const latestUpdate = metaData.latest_updated_at || null;

        // Filter by status (released only, or include preview)
        const filteredMeta = (metaData.issues || []).filter((i: any) =>
            i.status === 'released' || (includePreview && i.status === 'preview')
        );

        // Use SchemaParser for version-agnostic parsing
        const normalizedIssues = PublicationSchemaParser.parseMetaIssues(filteredMeta);

        // Convert NormalizedIssue to Issue (for backward compatibility)
        const issues: Issue[] = normalizedIssues.map(ni => ({
            id: ni.id,
            edition_code: ni.edition_code,
            edition_name: ni.edition_name,
            article_count: ni.article_count,
            published_at: ni.published_at,
            updated_at: ni.updated_at,
            released_at: ni.released_at,
            status: ni.status,
            date: ni.date
        }));

        // Sort by edition_code descending (higher issue number is latest)
        issues.sort((a, b) => b.edition_code.localeCompare(a.edition_code));

        console.log(`✅ [Firestore] Found ${issues.length} released issues from _meta (Schema versions detected)`);
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
 * [REFACTORED] Uses PublicationSchemaParser for version-agnostic parsing
 */
export async function fetchArticlesByIssueId(issueId: string): Promise<Article[]> {
    try {
        // Read articles array directly from issue document (1 READ)
        const pubDoc = await getDoc(getDocRef(COLLECTION_PUBLICATIONS, issueId));

        if (!pubDoc.exists()) {
            console.log(`⚠️ [Firestore] Publication not found: ${issueId}`);
            return [];
        }

        const pubData = pubDoc.data();
        const rawArticles = pubData.articles || [];

        // Use SchemaParser for version-agnostic article parsing
        const normalizedArticles = PublicationSchemaParser.parseArticles(rawArticles);

        // Convert to Article interface (for backward compatibility)
        return normalizedArticles.map(na => ({
            id: na.id,
            article_id: na.article_id,
            title: na.title,
            title_ko: na.title_ko,
            title_en: na.title_en,
            summary: na.summary,
            url: na.url,
            source_id: na.source_id,
            category: na.category,
            layout_type: na.layout_type,
            impact_score: na.impact_score,
            zero_echo_score: na.zero_echo_score,
            tags: na.tags,
            published_at: na.published_at,
            date: na.date,
            filename: na.filename
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
// ... (existing helper functions)

const COLLECTION_TREND_REPORTS = 'trend_reports';

export interface TrendReport {
    id: string;
    period: {
        start: string;
        end: string;
    };
    created_at: string;
    top_trends: any[];
    tag_rankings: any[];
    weekly_insight: string;
    next_week_outlook: string;
}

/**
 * Fetch list of trend reports
 * Uses correct ZND_ENV path via getCollectionRef
 */
export async function fetchTrendReports(limitCount: number = 20): Promise<TrendReport[]> {
    try {
        console.log(`📖 [Firestore] Fetching trend reports... (limit: ${limitCount})`);

        // Import query functions dynamically or assume they are available from firebase/firestore imports
        const { query, orderBy, limit: firestoreLimit } = await import('firebase/firestore');

        const reportsRef = getCollectionRef(COLLECTION_TREND_REPORTS);
        const q = query(reportsRef, orderBy('created_at', 'desc'), firestoreLimit(limitCount));

        const snapshot = await getDocs(q);
        const reports: TrendReport[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            reports.push({
                id: doc.id,
                period: data.period || {},
                created_at: data.created_at || '',
                top_trends: data.top_trends || [],
                tag_rankings: data.tag_rankings || [],
                weekly_insight: data.weekly_insight || '',
                next_week_outlook: data.next_week_outlook || ''
            });
        });

        console.log(`✅ [Firestore] Found ${reports.length} trend reports`);
        return reports;

    } catch (error) {
        console.error('❌ [Firestore] Failed to fetch trend reports:', error);
        return [];
    }
}

/**
 * Fetch single trend report by ID
 */
export async function fetchTrendReportById(reportId: string): Promise<TrendReport | null> {
    try {
        const docRef = getDocRef(COLLECTION_TREND_REPORTS, reportId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return null;
        }

        const data = docSnap.data();
        return {
            id: docSnap.id,
            period: data.period || {},
            created_at: data.created_at || '',
            top_trends: data.top_trends || [],
            tag_rankings: data.tag_rankings || [],
            weekly_insight: data.weekly_insight || '',
            next_week_outlook: data.next_week_outlook || ''
        };

    } catch (error) {
        console.error(`❌ [Firestore] Failed to fetch report ${reportId}:`, error);
        return null;
    }
}
