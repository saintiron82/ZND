/**
 * 발행 스키마 해석기 (Publication Schema Parser)
 * 
 * 모든 스키마 버전을 동일한 출력 형식으로 변환
 * - v2.0.0: 레거시 형식 (code, name, count)
 * - v3.0.0: 신규 형식 (edition_code, edition_name, article_count, articles 내장)
 */

// =============================================================================
// 출력 인터페이스 (모든 버전에서 동일하게 출력됨)
// =============================================================================

export interface NormalizedIssue {
    id: string;
    edition_code: string;
    edition_name: string;
    article_count: number;
    published_at: string;
    updated_at: string;
    released_at?: string;
    status: 'preview' | 'released';
    date: string;
    schema_version: string;
}

export interface NormalizedArticle {
    id: string;
    article_id: string;
    title: string;
    title_ko: string;
    title_en: string;
    summary: string;
    url: string;
    source_id: string;
    category: string;
    layout_type: string;
    impact_score: number;
    zero_echo_score: number;
    tags: string[];
    published_at: string;
    date: string;
    filename: string;
}

// =============================================================================
// 입력 인터페이스 (Raw Firestore 데이터)
// =============================================================================

interface RawMetaIssue {
    // v3.0.0 fields
    edition_code?: string;
    edition_name?: string;
    article_count?: number;
    published_at?: string;
    schema_version?: string;
    // v2.0.0 fields (legacy)
    code?: string;
    name?: string;
    count?: number;
    // Common fields
    updated_at?: string;
    status?: 'preview' | 'released';
}

interface RawArticle {
    id?: string;
    article_id?: string;
    title?: string;
    title_ko?: string;
    title_en?: string;
    summary?: string;
    url?: string;
    source_id?: string;
    category?: string;
    layout_type?: string;
    impact_score?: number;
    zero_echo_score?: number;
    tags?: string[];
    published_at?: string;
    date?: string;
    filename?: string;
    [key: string]: any;
}

interface RawPublicationDoc {
    edition_code?: string;
    edition_name?: string;
    article_count?: number;
    article_ids?: string[];
    articles?: RawArticle[];
    published_at?: string;
    updated_at?: string;
    released_at?: string;
    status?: 'preview' | 'released';
    date?: string;
    schema_version?: string;
}

// =============================================================================
// 스키마 해석기 클래스
// =============================================================================

export class PublicationSchemaParser {
    /**
     * 스키마 버전 감지
     */
    static detectVersion(data: RawMetaIssue | RawPublicationDoc): string {
        if (data.schema_version) {
            return data.schema_version;
        }

        // edition_code가 있으면 3.0.0 이상
        if ('edition_code' in data && data.edition_code) {
            return '3.0.0';
        }

        // code가 있으면 2.0.0
        if ('code' in data && (data as RawMetaIssue).code) {
            return '2.0.0';
        }

        return 'unknown';
    }

    /**
     * _meta 문서의 issues 배열을 정규화
     */
    static parseMetaIssues(rawIssues: RawMetaIssue[]): NormalizedIssue[] {
        return rawIssues.map(raw => this.parseMetaIssue(raw));
    }

    /**
     * 개별 _meta issue 항목을 정규화
     */
    static parseMetaIssue(raw: RawMetaIssue): NormalizedIssue {
        const version = this.detectVersion(raw);

        // 필드 추출 (v3.0.0 우선, v2.0.0 폴백)
        const editionCode = raw.edition_code || raw.code || '';
        const editionName = raw.edition_name || raw.name || '';
        const articleCount = raw.article_count ?? raw.count ?? 0;
        const publishedAt = raw.published_at || raw.updated_at || '';
        const updatedAt = raw.updated_at || '';
        const status = raw.status || 'preview';

        // 날짜 파싱 (YYMMDD_N → YYYY-MM-DD)
        const date = this.parseEditionCodeToDate(editionCode);

        return {
            id: editionCode,
            edition_code: editionCode,
            edition_name: editionName,
            article_count: articleCount,
            published_at: publishedAt,
            updated_at: updatedAt,
            status: status,
            date: date,
            schema_version: version
        };
    }

    /**
     * publications/{edition_code} 문서를 정규화
     */
    static parsePublicationDoc(raw: RawPublicationDoc): NormalizedIssue {
        const version = this.detectVersion(raw);

        const editionCode = raw.edition_code || '';
        const editionName = raw.edition_name || '';
        const articleCount = raw.article_count || raw.articles?.length || 0;
        const publishedAt = raw.published_at || '';
        const updatedAt = raw.updated_at || '';
        const releasedAt = raw.released_at;
        const status = raw.status || 'preview';
        const date = raw.date || this.parseEditionCodeToDate(editionCode);

        return {
            id: editionCode,
            edition_code: editionCode,
            edition_name: editionName,
            article_count: articleCount,
            published_at: publishedAt,
            updated_at: updatedAt,
            released_at: releasedAt,
            status: status,
            date: date,
            schema_version: version
        };
    }

    /**
     * 기사 배열을 정규화
     */
    static parseArticles(rawArticles: RawArticle[]): NormalizedArticle[] {
        return rawArticles.map(raw => this.parseArticle(raw));
    }

    /**
     * 개별 기사를 정규화
     */
    static parseArticle(raw: RawArticle): NormalizedArticle {
        const articleId = raw.id || raw.article_id || '';

        return {
            id: articleId,
            article_id: articleId,
            title: raw.title || raw.title_ko || '',
            title_ko: raw.title_ko || raw.title || '',
            title_en: raw.title_en || '',
            summary: raw.summary || '',
            url: raw.url || '',
            source_id: raw.source_id || 'unknown',
            category: raw.category || 'Uncategorized',
            layout_type: raw.layout_type || 'Standard',
            impact_score: raw.impact_score ?? 0,
            zero_echo_score: raw.zero_echo_score ?? 0,
            tags: raw.tags || [],
            published_at: raw.published_at || '',
            date: raw.date || '',
            filename: raw.filename || `${raw.source_id}_${articleId}.json`
        };
    }

    /**
     * edition_code에서 날짜 추출 (YYMMDD_N → YYYY-MM-DD)
     */
    static parseEditionCodeToDate(editionCode: string): string {
        if (!editionCode) return '';

        // YYMMDD_N 형식에서 YYMMDD 추출
        const dateMatch = editionCode.replace(/_\d+$/, '');

        if (dateMatch && dateMatch.length === 6 && /^\d{6}$/.test(dateMatch)) {
            const yy = dateMatch.substring(0, 2);
            const mm = dateMatch.substring(2, 4);
            const dd = dateMatch.substring(4, 6);
            return `20${yy}-${mm}-${dd}`;
        }

        return '';
    }

    /**
     * 디버그용: 스키마 정보 출력
     */
    static debugInfo(raw: RawMetaIssue | RawPublicationDoc): string {
        const version = this.detectVersion(raw);
        const fields = Object.keys(raw).join(', ');
        return `[SchemaParser] Version: ${version}, Fields: ${fields}`;
    }
}

// =============================================================================
// 편의 함수 (기존 코드 호환용)
// =============================================================================

export function normalizeIssue(raw: any): NormalizedIssue {
    return PublicationSchemaParser.parseMetaIssue(raw);
}

export function normalizeArticle(raw: any): NormalizedArticle {
    return PublicationSchemaParser.parseArticle(raw);
}

export function normalizeArticles(rawArticles: any[]): NormalizedArticle[] {
    return PublicationSchemaParser.parseArticles(rawArticles);
}
