import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Cache duration: 1 minute
export const revalidate = 60;

async function getLocalArticles() {
    try {
        // Assuming process.cwd() is the 'web' directory
        const dataDir = path.join(process.cwd(), '../supplier/data');

        if (!fs.existsSync(dataDir)) {
            console.warn(`[API] Local data directory not found: ${dataDir}`);
            return [];
        }

        const articles: any[] = [];

        // Read date directories (e.g., 2025-12-07)
        const dateDirs = fs.readdirSync(dataDir).filter(file => {
            return fs.statSync(path.join(dataDir, file)).isDirectory();
        });

        // Sort date dirs descending to get latest first
        dateDirs.sort().reverse();

        // Limit to last 3 days to avoid reading too many files
        const recentDirs = dateDirs.slice(0, 3);

        for (const dateDir of recentDirs) {
            const fullPath = path.join(dataDir, dateDir);
            const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));

            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(fullPath, file), 'utf-8');
                    const article = JSON.parse(content);
                    // Add ID if missing (use filename)
                    if (!article.id) {
                        article.id = file.replace('.json', '');
                    }
                    articles.push(article);
                } catch (e) {
                    console.error(`[API] Error reading file ${file}:`, e);
                }
            }
        }

        // Sort by crawled_at desc
        return articles.sort((a, b) => {
            const dateA = new Date(a.crawled_at || 0).getTime();
            const dateB = new Date(b.crawled_at || 0).getTime();
            return dateB - dateA;
        });

    } catch (error) {
        console.error('[API] Error reading local files:', error);
        return [];
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedDate = searchParams.get('date');
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        console.log(`[API Request] Time: ${new Date().toISOString()}, UA: ${userAgent}`);

        let articles: any[] = [];
        let source = 'Firestore';

        try {
            const articlesRef = collection(db, 'articles');
            const q = query(articlesRef, orderBy('crawled_at', 'desc'));
            const querySnapshot = await getDocs(q);

            articles = querySnapshot.docs.map(doc => {
                const data = doc.data();
                let crawledAt = data.crawled_at;
                if (crawledAt instanceof Timestamp) {
                    crawledAt = crawledAt.toDate().toISOString();
                } else if (crawledAt && typeof crawledAt.toDate === 'function') {
                    crawledAt = crawledAt.toDate().toISOString();
                }

                return {
                    id: doc.id,
                    ...data,
                    crawled_at: crawledAt
                };
            });
        } catch (dbError) {
            console.warn('[API] Firestore connection failed, trying local files...', dbError);
        }

        // Fallback to local files if DB returned nothing or failed
        if (articles.length === 0) {
            console.log('[API] No articles in DB, checking local files...');
            articles = await getLocalArticles();
            source = 'Local Files';
        }

        console.log(`[API] Returning ${articles.length} articles from ${source}`);

        // Filter out noise (score < 4)
        const validArticles = articles.filter((a: any) => (a.score ?? 0) >= 4);

        // Get available dates from local directories
        const dataDir = path.join(process.cwd(), '../supplier/data');
        let availableDates: string[] = [];
        if (fs.existsSync(dataDir)) {
            availableDates = fs.readdirSync(dataDir).filter(file => {
                return fs.statSync(path.join(dataDir, file)).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(file);
            }).sort().reverse();
        }

        return NextResponse.json({
            articles: validArticles,
            currentDate: requestedDate || availableDates[0] || new Date().toISOString().split('T')[0],
            availableDates: availableDates,
            source: source
        });

    } catch (error) {
        console.error('Error serving articles:', error);
        return NextResponse.json({
            articles: [],
            error: 'Failed to load data.'
        }, { status: 500 });
    }
}
