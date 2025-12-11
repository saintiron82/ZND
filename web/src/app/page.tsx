import { promises as fs } from 'fs';
import path from 'path';
import ArticleCard from '@/components/ArticleCard';
import ArticleDisplay from '@/components/ArticleDisplay';

// CACHE CONFIGURATION
// Revalidate this page every 0 seconds (No Cache).
export const revalidate = 0;

async function getData() {
  try {
    // NEW: Read index.json manifest from date directories
    const dataDir = path.join(process.cwd(), '..', 'supplier', 'data');
    const entries = await fs.readdir(dataDir, { withFileTypes: true });

    // Filter for directories that look like dates (YYYY-MM-DD)
    const dateDirs = entries
      .filter(dirent => dirent.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dirent.name))
      .map(dirent => path.join(dataDir, dirent.name));

    const allArticles: any[] = [];

    for (const dir of dateDirs) {
      // Try to read index.json
      const manifestPath = path.join(dir, 'index.json');
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        if (manifest.articles && Array.isArray(manifest.articles)) {
          allArticles.push(...manifest.articles);
        }
      } catch (err) {
        // Fallback: If index.json is missing (legacy folder?), scan regular json files
        // console.warn(`Manifest missing for ${dir}, falling back to scan.`);
        const files = await fs.readdir(dir);
        const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json');
        for (const file of jsonFiles) {
          try {
            const content = await fs.readFile(path.join(dir, file), 'utf8');
            const article = JSON.parse(content);
            if (article.id || article.url) allArticles.push(article);
          } catch (e) { /* ignore */ }
        }
      }
    }

    // Filter out articles without article_id
    return allArticles.filter(article => article.article_id);
  } catch (error) {
    console.error("Error reading articles directories:", error);
    return [];
  }
}

export default async function Home() {
  const articles = await getData();

  // Group articles by date (YYYY-MM-DD)
  const groupedArticles: { [key: string]: any[] } = {};
  articles.forEach((article: any) => {
    let dateStr = '';
    if (typeof article.crawled_at === 'string') {
      dateStr = new Date(article.crawled_at).toLocaleDateString();
    } else if (article.crawled_at && typeof article.crawled_at === 'object' && 'seconds' in article.crawled_at) {
      dateStr = new Date(article.crawled_at.seconds * 1000).toLocaleDateString();
    }

    if (dateStr) {
      if (!groupedArticles[dateStr]) {
        groupedArticles[dateStr] = [];
      }
      groupedArticles[dateStr].push(article);
    }
  });

  // Sort dates descending
  const sortedDates = Object.keys(groupedArticles).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <main className="max-w-7xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">
            Latest Tech News
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Curated tech news and insights, powered by AI.
          </p>
        </header>

        <div className="flex flex-col gap-12">
          {sortedDates.map(date => {
            // Sort articles by Combined Score (Descending) -> Highest Combined Score First
            // Combined Score = (10 - ZES) + Impact Score
            // Lower ZES (better quality) + Higher Impact = Higher Combined Score
            const dateArticles = groupedArticles[date].sort((a: any, b: any) => {
              const znsA = a.zero_echo_score || 0;
              const znsB = b.zero_echo_score || 0;
              const impactA = a.impact_score || 0;
              const impactB = b.impact_score || 0;

              const combinedA = (10 - znsA) + impactA;
              const combinedB = (10 - znsB) + impactB;

              return combinedB - combinedA;
            });

            return (
              <section key={date} className="mb-0">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-baseline gap-4 border-b border-border pb-2">
                  <span className="font-serif italic text-3xl">{date.split('.')[2]}</span>
                  <span className="text-muted-foreground text-sm uppercase tracking-widest font-sans">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long' })}
                  </span>
                </h2>
                <ArticleDisplay articles={dateArticles} loading={false} error={null} />
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
