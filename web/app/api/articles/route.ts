import { NextResponse } from 'next/server';
// import { db } from '@/lib/firebase';
// import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Cache duration: 0 (No cache)
export const revalidate = 0;
export const dynamic = 'force-dynamic';

async function getLocalArticles(targetDate: string, requestHelper: { headers: Headers, result: { notModified: boolean, articles: any[], lastModified?: string } }) {
    try {
        const dataDir = path.join(process.cwd(), '../supplier/data');
        if (!fs.existsSync(dataDir)) {
            return;
        }

        const fullPath = path.join(dataDir, targetDate);
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
            return;
        }

        // 1. Try to read daily_summary.json
        const summaryPath = path.join(fullPath, 'daily_summary.json');
        if (fs.existsSync(summaryPath)) {
            try {
                const summaryContent = fs.readFileSync(summaryPath, 'utf-8');
                const summary = JSON.parse(summaryContent);

                // Smart Caching Check
                const lastModified = summary.last_updated; // Expect ISO string
                requestHelper.result.lastModified = lastModified;

                const ifModifiedSince = requestHelper.headers.get('if-modified-since');
                if (ifModifiedSince && lastModified) {
                    const ifModifiedTime = new Date(ifModifiedSince).getTime();
                    const lastModifiedTime = new Date(lastModified).getTime();
                    // Allow some small slack or exact match.
                    if (lastModifiedTime <= ifModifiedTime + 1000) {
                        requestHelper.result.notModified = true;
                        return;
                    }
                }

                if (summary.articles) {
                    requestHelper.result.articles = summary.articles;
                    return;
                }
            } catch (e) {
                console.warn('[API] Error reading daily_summary.json, falling back to file scan:', e);
            }
        }

        // 2. Fallback: Scan individual files
        const articles: any[] = [];
        const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json') && f !== 'daily_summary.json');

        let maxMtime = 0;

        for (const file of files) {
            try {
                const filePath = path.join(fullPath, file);
                const stats = fs.statSync(filePath);
                if (stats.mtimeMs > maxMtime) maxMtime = stats.mtimeMs;

                const content = fs.readFileSync(filePath, 'utf-8');
                const article = JSON.parse(content);

                if (article.zero_noise_score !== undefined && article.score === undefined) {
                    article.score = article.zero_noise_score;
                }
                if (!article.id) {
                    article.id = file.replace('.json', '');
                }
                articles.push(article);
            } catch (e) {
                console.error(`[API] Error reading file ${file}:`, e);
            }
        }

        // Use latest file mtime as Last-Modified if summary missing
        if (maxMtime > 0) {
            const lastModDate = new Date(maxMtime).toISOString();
            requestHelper.result.lastModified = lastModDate;

            const ifModifiedSince = requestHelper.headers.get('if-modified-since');
            if (ifModifiedSince) {
                const ifModifiedTime = new Date(ifModifiedSince).getTime();
                if (Math.floor(maxMtime / 1000) * 1000 <= ifModifiedTime + 1000) {
                    requestHelper.result.notModified = true;
                    return;
                }
            }
        }

        requestHelper.result.articles = articles;

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

        // Sort by crawled_at desc
        articles.sort((a, b) => {
            const dateA = new Date(a.crawled_at || 0).getTime();
            const dateB = new Date(b.crawled_at || 0).getTime();
            return dateB - dateA;
        });

        console.log(`[API] Returning ${articles.length} articles from ${source} for date ${targetDate}`);

        let validArticles = articles.filter((a: any) => {
            const score = a.score ?? a.zero_noise_score ?? 0;
            // Filter out articles with High Noise (ZeroNoise Score >= 7.0)
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
