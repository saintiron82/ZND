import { GetServerSideProps } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import HomePageClient from '@/components/HomePageClient';
import { optimizeArticleOrder } from '@/utils/layoutOptimizer';

async function getStagingData() {
    try {
        const stagingDir = path.join(process.cwd(), '..', 'supplier', 'staging');

        try {
            await fs.access(stagingDir);
        } catch {
            console.log('[Preview] Staging directory not found');
            return [];
        }

        const entries = await fs.readdir(stagingDir, { withFileTypes: true });

        const dateDirs = entries
            .filter(dirent => dirent.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dirent.name))
            .map(dirent => ({
                name: dirent.name,
                sourcePath: path.join(stagingDir, dirent.name)
            }));

        const allArticles: any[] = [];

        for (const { name, sourcePath } of dateDirs) {
            try {
                const files = await fs.readdir(sourcePath);
                const jsonFiles = files.filter(file => file.endsWith('.json'));

                for (const file of jsonFiles) {
                    try {
                        const content = await fs.readFile(path.join(sourcePath, file), 'utf8');
                        const article = JSON.parse(content);

                        if (article.rejected || article.published) continue;
                        if (article.dedup_status === 'duplicate') continue;

                        if (article.article_id || article.id || article.url) {
                            allArticles.push(article);
                        }
                    } catch (e) {
                        console.error(`[Preview] Failed to load: ${file}`, e);
                    }
                }
            } catch (e) {
                console.error(`[Preview] Failed to read date dir: ${name}`, e);
            }
        }

        if (allArticles.length > 0) {
            return optimizeArticleOrder(allArticles);
        }

        return allArticles;
    } catch (error) {
        console.error('[Preview] Error reading staging:', error);
        return [];
    }
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const articles = await getStagingData();
    return {
        props: {
            articles,
        },
    };
};

export default function PreviewPage({ articles }: { articles: any[] }) {
    if (!articles || articles.length === 0) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black p-8 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                        🔒 Preview Mode
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400 text-xl">
                        Staging에 표시할 기사가 없습니다.
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-500 mt-2">
                        Staging Preview에서 기사를 추가하세요.
                    </p>
                </div>
            </div>
        );
    }

    return <HomePageClient articles={articles} isPreview={true} />;
}
