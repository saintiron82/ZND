import HomePageClient from '@/components/HomePageClient';
import { optimizeArticleOrder } from '@/utils/layoutOptimizer';

// No caching for preview - always fresh
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5500';

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
    [key: string]: any;
}

/**
 * Preview 회차 목록 조회
 */
async function getPreviewIssues(): Promise<Issue[]> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/publications/list?status=preview`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            console.error('Failed to fetch preview issues:', res.status);
            return [];
        }

        const data = await res.json();
        return data.success ? data.issues : [];
    } catch (error) {
        console.error('Error fetching preview issues:', error);
        return [];
    }
}

/**
 * 특정 회차의 기사 조회
 */
async function getArticlesByIssue(publishId: string): Promise<Article[]> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/publications/view?publish_id=${publishId}`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            console.error('Failed to fetch articles:', res.status);
            return [];
        }

        const data = await res.json();
        if (!data.success) return [];

        const articles = data.articles || [];
        return optimizeArticleOrder(articles);
    } catch (error) {
        console.error('Error fetching articles:', error);
        return [];
    }
}

/**
 * 모든 preview 회차의 기사를 가져와서 합침
 */
async function getAllPreviewArticles(): Promise<{ issues: Issue[]; articles: Article[] }> {
    const issues = await getPreviewIssues();

    if (issues.length === 0) {
        return { issues: [], articles: [] };
    }

    const articlePromises = issues.map(issue => getArticlesByIssue(issue.id));
    const articlesArrays = await Promise.all(articlePromises);

    const allArticles: Article[] = [];
    issues.forEach((issue, idx) => {
        const issueArticles = articlesArrays[idx] || [];
        issueArticles.forEach(article => {
            allArticles.push({
                ...article,
                publish_id: issue.id,
                edition_name: issue.edition_name,
                edition_code: issue.edition_code,
            });
        });
    });

    return { issues, articles: allArticles };
}

export default async function PreviewPage() {
    const { issues, articles } = await getAllPreviewArticles();

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
                ⚠️ PREVIEW MODE - 이 페이지는 아직 공개되지 않은 미리보기입니다
            </div>
            {/* Add top padding to prevent content overlap */}
            <div style={{ paddingTop: '40px' }}>
                <HomePageClient articles={articles} issues={issues} />
            </div>
        </div>
    );
}
