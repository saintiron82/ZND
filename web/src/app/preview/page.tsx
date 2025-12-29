import HomePageClient from '@/components/HomePageClient';
import { fetchPublishedIssues, fetchArticlesByIssueId, Issue, Article } from '@/lib/firestoreService';
import { optimizeArticleOrder } from '@/utils/layoutOptimizer';

// No caching for preview - always fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 숨겨진 Preview 모드 페이지
 * 접속: /preview
 * released + preview 상태 모두 표시
 */
export default async function PreviewPage() {
    console.log('🔓 [Preview Mode] Loading all issues including preview...');

    // preview 모드로 데이터 조회 (includePreview: true)
    const { issues } = await fetchPublishedIssues(true);

    if (issues.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">No Issues Found</h1>
                    <p className="text-muted-foreground">No published or preview issues available.</p>
                </div>
            </div>
        );
    }

    // 각 회차의 기사 조회 (병렬)
    const articlePromises = issues.map(async (issue: Issue) => {
        try {
            const articles = await fetchArticlesByIssueId(issue.id);
            return optimizeArticleOrder(articles).map((article: Article) => ({
                ...article,
                publish_id: issue.id,
                edition_name: issue.edition_name,
                edition_code: issue.edition_code,
            }));
        } catch (err) {
            console.error(`[Preview] Failed to fetch articles for issue ${issue.id}`, err);
            return [];
        }
    });

    const articlesArrays = await Promise.all(articlePromises);
    const allArticles = articlesArrays.flat();

    console.log(`🔓 [Preview Mode] Loaded ${issues.length} issues, ${allArticles.length} articles`);

    return (
        <div>
            {/* Preview Mode Indicator */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(90deg, #ffc107, #ff9800)',
                color: '#333',
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                textAlign: 'center',
                zIndex: 9999,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
                ⚠️ PREVIEW MODE - 이 페이지는 아직 공개되지 않은 미리보기입니다 ({issues.length}개 회차)
            </div>
            {/* Add top padding to prevent content overlap */}
            <div style={{ paddingTop: '40px' }}>
                <HomePageClient articles={allArticles} issues={issues} />
            </div>
        </div>
    );
}
