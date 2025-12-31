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
    // v3.x fields only
    edition_code?: string;
    edition_name?: string;
    article_count?: number;
    index?: number;
    published_at?: string;
    updated_at?: string;
    status?: 'preview' | 'released';
    schema_version?: string;
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
     * 스키마 버전 감지 (schema_version 필드 기반)
     */
    static detectVersion(data: RawMetaIssue | RawPublicationDoc): string {
        if (data.schema_version) {
            return data.schema_version;
        }

        // schema_version이 없으면 edition_code 존재 여부로 추정
        if ('edition_code' in data && data.edition_code) {
            return '3.0';
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
     * schema_version 기반 명시적 분기 처리
     * 해당 버전 파서가 없으면 하위 버전으로 폴백
     */
    static parseMetaIssue(raw: RawMetaIssue): NormalizedIssue {
        const version = raw.schema_version || 'unknown';

        // 지원 버전 목록 (내림차순)
        const supportedVersions = ['3.1', '3.0'];

        // 정확히 일치하는 버전 찾기
        let targetVersion = supportedVersions.find(v => version === v);

        // 없으면 메이저.마이너 파싱 후 폴백
        if (!targetVersion && version !== 'unknown') {
            const [major, minor] = version.split('.').map(Number);

            // 같은 메이저 버전 중 지원되는 가장 높은 버전으로 폴백
            targetVersion = supportedVersions.find(v => {
                const [vMajor] = v.split('.').map(Number);
                return vMajor === major;
            });

            if (targetVersion) {
                console.info(`[SchemaParser] v${version} → v${targetVersion} fallback`);
            }
        }

        // v3.x 파서 (3.0, 3.1 공통)
        if (targetVersion?.startsWith('3.')) {
            return this._parseV3Issue(raw, version);
        }

        // 지원되지 않는 버전
        console.warn(`[SchemaParser] Unsupported schema version: ${version}`);
        return this._emptyIssue(version);
    }

    /**
     * v3.x 파서 (edition_code, edition_name, article_count)
     */
    private static _parseV3Issue(raw: RawMetaIssue, version: string): NormalizedIssue {
        const editionCode = raw.edition_code || '';
        const editionName = raw.edition_name || '';
        const articleCount = raw.article_count ?? 0;
        const publishedAt = raw.published_at || '';
        const updatedAt = raw.updated_at || '';
        const status = raw.status || 'preview';
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
     * 빈 이슈 반환 (지원되지 않는 버전용)
     */
    private static _emptyIssue(version: string): NormalizedIssue {
        return {
            id: '',
            edition_code: '',
            edition_name: '',
            article_count: 0,
            published_at: '',
            updated_at: '',
            status: 'preview',
            date: '',
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
