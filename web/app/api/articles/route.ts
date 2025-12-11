import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase';
// import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Cache duration: 0 (No cache)
export const revalidate = 0;
export const dynamic = 'force-dynamic';

import { optimizeArticleOrder } from '@/utils/layoutOptimizer';

async function getLocalArticles(targetDate: string, requestHelper: { headers: Headers, result: { notModified: boolean, articles: any[], lastModified?: string } }) {
    try {
        const dataDir = path.join(process.cwd(), '../supplier/data');
        const cacheRootDir = path.join(process.cwd(), 'data_cache');
        const cacheDateDir = path.join(cacheRootDir, targetDate);
        const viewModelPath = path.join(cacheDateDir, 'view_model.json');

        // 1. [Fast Path] Try to read view_model.json (Web Cache)
        if (fs.existsSync(viewModelPath)) {
            try {
                const viewModelContent = fs.readFileSync(viewModelPath, 'utf-8');
                const viewModel = JSON.parse(viewModelContent);
                if (viewModel.articles && Array.isArray(viewModel.articles)) {
                    requestHelper.result.articles = viewModel.articles;

                    // Use file mtime for Last-Modified
                    const stats = fs.statSync(viewModelPath);
                    requestHelper.result.lastModified = stats.mtime.toISOString();

                    const ifModifiedSince = requestHelper.headers.get('if-modified-since');
                    if (ifModifiedSince) {
                        const ifModifiedTime = new Date(ifModifiedSince).getTime();
                        if (Math.floor(stats.mtimeMs / 1000) * 1000 <= ifModifiedTime + 1000) {
                            requestHelper.result.notModified = true;
                        }
                    }
                    return;
                }
            } catch (e) {
                console.warn('[API] Cache corrupt, regenerating:', e);
            }
        }

        // 2. [Slow Path] Read Raw Data & Calculate Layout
        if (!fs.existsSync(dataDir)) return;
        const fullPath = path.join(dataDir, targetDate);
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) return;

        let rawArticles: any[] = [];

        // Try daily_summary.json first
        const summaryPath = path.join(fullPath, 'daily_summary.json');
        if (fs.existsSync(summaryPath)) {
            try {
                const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
                if (summary.articles) rawArticles = summary.articles;
            } catch (e) { }
        }

        // Fallback to scanning individual files if summary failed or empty
        if (rawArticles.length === 0) {
            const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json') && f !== 'daily_summary.json');
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(fullPath, file), 'utf-8');
                    const article = JSON.parse(content);
                    if (article.id || article.url) {
                        if (!article.id) article.id = file.replace('.json', '');
                        if (article.zero_echo_score !== undefined && article.score === undefined) article.score = article.zero_echo_score;
                        rawArticles.push(article);
                    }
                } catch (e) { }
            }
        }

        if (rawArticles.length > 0) {
            // 3. Optimize Layout (Baking)
            console.log(`[Layout] Calculating for ${targetDate}...`);
            const optimizedArticles = optimizeArticleOrder(rawArticles);

            // 4. Save to Web Cache
            try {
                fs.mkdirSync(cacheDateDir, { recursive: true });
                const viewModel = {
                    generated_at: new Date().toISOString(),
                    articles: optimizedArticles
                };
                fs.writeFileSync(viewModelPath, JSON.stringify(viewModel, null, 2), 'utf-8');
                console.log(`[Layout] Baked view_model.json to ${viewModelPath}`);
            } catch (e) {
                console.error('[Layout] Failed to save cache:', e);
            }

            requestHelper.result.articles = optimizedArticles;
        }

    } catch (error) {
        console.error('[API] Error reading local files:', error);
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedDate = searchParams.get('date');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        console.log(`[API Request] Time: ${new Date().toISOString()}, UA: ${userAgent}`);

        // 1. Get available dates from local directories FIRST to determine default date
        const dataDir = path.join(process.cwd(), '../supplier/data');
        let availableDates: string[] = [];
        if (fs.existsSync(dataDir)) {
            availableDates = fs.readdirSync(dataDir).filter(file => {
                return fs.statSync(path.join(dataDir, file)).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(file);
            }).sort().reverse();
        }

        // 2. Determine target date (Requested -> Latest Available -> Today)
        const targetDate = requestedDate || availableDates[0] || new Date().toISOString().split('T')[0];

        // Helper object to carry results
        const resultHelper = {
            notModified: false,
            articles: [] as any[],
            lastModified: undefined as string | undefined
        };

        // Fetch Local Articles with Smart Caching
        await getLocalArticles(targetDate, { headers: request.headers, result: resultHelper });

        // Handle 304 Not Modified
        if (resultHelper.notModified) {
            console.log(`[API] 304 Not Modified for ${targetDate}`);
            return new NextResponse(null, { status: 304 });
        }

        let articles = resultHelper.articles;
        const source = 'Local Files Only';

        // REMOVED: Sorting by date overwrites the optimized layout order.
        // The articles are already sorted by Importance (Awards -> Score) by the LayoutOptimizer.
        // articles.sort((a, b) => { ... });

        console.log(`[API] Returning ${articles.length} articles from ${source} for date ${targetDate}`);

        let validArticles = articles.filter((a: any) => {
            const score = a.score ?? a.zero_echo_score ?? 0;
            // Filter out articles with High Noise (ZeroEcho Score >= 7.0)
            return score < 7.0;
        });

        // Date filter
        validArticles = validArticles.filter((a: any) => {
            if (!a.crawled_at) return false;
            const dateStr = new Date(a.crawled_at).toISOString().split('T')[0];
            return dateStr === targetDate;
        });

        const headers: any = {
            'Content-Type': 'application/json',
        };
        if (resultHelper.lastModified) {
            headers['Last-Modified'] = resultHelper.lastModified;
        }

        return NextResponse.json({
            articles: validArticles,
            currentDate: targetDate,
            availableDates: availableDates,
            source: source
        }, { headers });

    } catch (error) {
        console.error('Error serving articles:', error);
        return NextResponse.json({
            articles: [],
            error: 'Failed to load data.'
        }, { status: 500 });
    }
}
