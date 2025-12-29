import { NextResponse } from 'next/server';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicationSchemaParser } from '@/lib/schemaParser';

export const dynamic = 'force-dynamic';

const ZND_ENV = process.env.NEXT_PUBLIC_ZND_ENV || 'release';

/**
 * GET /api/debug/schema
 * 발행 정보 스키마 디버그 체크 API
 */
export async function GET() {
    try {
        // 1. _meta 문서 Raw 데이터 조회
        const metaRef = doc(db, ZND_ENV, 'data', 'publications', '_meta');
        const metaDoc = await getDoc(metaRef);

        if (!metaDoc.exists()) {
            return NextResponse.json({
                success: false,
                error: '_meta document not found',
                env: ZND_ENV
            });
        }

        const rawMeta = metaDoc.data();
        const rawIssues = rawMeta.issues || [];

        // 2. 스키마 버전별 분석
        const issueAnalysis = rawIssues.map((issue: any, idx: number) => {
            const version = PublicationSchemaParser.detectVersion(issue);
            return {
                index: idx,
                schema_version: version,
                detected_fields: {
                    // v3.0.0 fields
                    edition_code: issue.edition_code || null,
                    edition_name: issue.edition_name || null,
                    article_count: issue.article_count ?? null,
                    // v2.0.0 fields
                    code: issue.code || null,
                    name: issue.name || null,
                    count: issue.count ?? null,
                    // Common
                    status: issue.status || null,
                    updated_at: issue.updated_at || null,
                },
                parsed: PublicationSchemaParser.parseMetaIssue(issue)
            };
        });

        // 3. released 상태만 필터
        const releasedIssues = issueAnalysis.filter((i: any) => i.detected_fields.status === 'released');

        // 4. 첫 번째 released issue의 상세 문서 확인
        let firstIssueDetail = null;
        if (releasedIssues.length > 0) {
            const firstEditionCode = releasedIssues[0].parsed.edition_code;
            if (firstEditionCode) {
                const pubRef = doc(db, ZND_ENV, 'data', 'publications', firstEditionCode);
                const pubDoc = await getDoc(pubRef);
                if (pubDoc.exists()) {
                    const pubData = pubDoc.data();
                    firstIssueDetail = {
                        edition_code: pubData.edition_code,
                        edition_name: pubData.edition_name,
                        article_count: pubData.article_count,
                        articles_length: pubData.articles?.length || 0,
                        schema_version: pubData.schema_version || 'unknown',
                        status: pubData.status,
                        first_article_sample: pubData.articles?.[0] ? {
                            id: pubData.articles[0].id,
                            title_ko: pubData.articles[0].title_ko?.substring(0, 50),
                            impact_score: pubData.articles[0].impact_score,
                            zero_echo_score: pubData.articles[0].zero_echo_score
                        } : null
                    };
                }
            }
        }

        return NextResponse.json({
            success: true,
            env: ZND_ENV,
            meta: {
                latest_updated_at: rawMeta.latest_updated_at,
                total_issues: rawIssues.length,
                released_count: releasedIssues.length
            },
            issues: issueAnalysis,
            first_released_detail: firstIssueDetail
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
