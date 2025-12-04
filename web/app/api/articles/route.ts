import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the path to the supplier data directory
// Assuming the structure is:
// d:\News
//   ├── web
//   └── supplier
//       └── data
const DATA_DIR = path.resolve(process.cwd(), '../supplier/data');

export async function GET() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            console.error(`Data directory not found: ${DATA_DIR}`);
            return NextResponse.json({ articles: [] });
        }

        const articles: any[] = [];

        // Get all date directories (YYYY-MM-DD)
        const dateDirs = fs.readdirSync(DATA_DIR)
            .filter(file => fs.statSync(path.join(DATA_DIR, file)).isDirectory())
            .filter(file => /^\d{4}-\d{2}-\d{2}$/.test(file)) // Match YYYY-MM-DD format
            .sort()
            .reverse(); // Newest dates first

        // Limit to last 3 days to avoid reading too many files
        const recentDirs = dateDirs.slice(0, 3);

        for (const dateDir of recentDirs) {
            const dirPath = path.join(DATA_DIR, dateDir);
            const files = fs.readdirSync(dirPath)
                .filter(file => file.endsWith('.json'));

            for (const file of files) {
                try {
                    const filePath = path.join(dirPath, file);
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const article = JSON.parse(fileContent);

                    // Add ID if not present (use filename as ID)
                    if (!article.id) {
                        article.id = file.replace('.json', '');
                    }

                    articles.push(article);
                } catch (err) {
                    console.error(`Error reading file ${file}:`, err);
                }
            }
        }

        // Sort by crawled_at descending
        articles.sort((a, b) => {
            const dateA = new Date(a.crawled_at).getTime();
            const dateB = new Date(b.crawled_at).getTime();
            return dateB - dateA;
        });

        return NextResponse.json({ articles });

    } catch (error) {
        console.error('Error serving articles:', error);
        return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
    }
}
