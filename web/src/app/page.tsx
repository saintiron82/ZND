import { promises as fs } from 'fs';
import path from 'path';
import ArticleCard from '@/components/ArticleCard';
import ArticleDisplay from '@/components/ArticleDisplay';
import { optimizeArticleOrder } from '@/utils/layoutOptimizer';

// CACHE CONFIGURATION
// Revalidate this page every 1 hour (ISR).
// We rely on view_model.json for persistence, but ISR helps unnecessary reads.
export const revalidate = 3600;

async function getData() {
  try {
    const dataDir = path.join(process.cwd(), '..', 'supplier', 'data');
    const cacheRootDir = path.join(process.cwd(), 'data_cache'); // web/data_cache

    // DEBUG LOGGING
    const debugLog = async (msg: string) => {
      const logPath = path.join(process.cwd(), 'debug_log.txt');
      try {
        await fs.appendFile(logPath, msg + '\n');
      } catch (e) {
        console.error('Failed to write debug log', e);
      }
    };
    await debugLog(`[${new Date().toISOString()}] getData called. CacheDir: ${cacheRootDir}`);

    // Ensure cache root exists
    try {
      await fs.mkdir(cacheRootDir, { recursive: true });
    } catch (e) { /* ignore if exists */ }

    const entries = await fs.readdir(dataDir, { withFileTypes: true });

    // Filter for directories that look like dates (YYYY-MM-DD)
    const dateDirs = entries
      .filter(dirent => dirent.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dirent.name))
      .map(dirent => ({
        name: dirent.name,
        sourcePath: path.join(dataDir, dirent.name),
        cachePath: path.join(cacheRootDir, dirent.name)
      }));

    const allArticles: any[] = [];

    for (const { name, sourcePath, cachePath } of dateDirs) {
      const viewModelPath = path.join(cachePath, 'view_model.json');

      try {
        // [Fast Path] Try to read view_model.json from Web Cache
        const viewModelContent = await fs.readFile(viewModelPath, 'utf8');
        const viewModel = JSON.parse(viewModelContent);
        if (viewModel.articles && Array.isArray(viewModel.articles)) {
          allArticles.push(...viewModel.articles);
          continue; // Successfully loaded from cache
        }
      } catch (err) {
        // Cache missing, proceed to generation
      }

      // [Calculated Path] Read raw data from Supplier, calculate layout, and save to Web Cache
      let dirArticles: any[] = [];
      const manifestPath = path.join(sourcePath, 'index.json');

      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        if (manifest.articles && Array.isArray(manifest.articles)) {
          dirArticles = manifest.articles;
        }
      } catch (err) {
        // Fallback: Scan individual JSON files
        try {
          const files = await fs.readdir(sourcePath);
          const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json' && file !== 'view_model.json');
          for (const file of jsonFiles) {
            try {
              const content = await fs.readFile(path.join(sourcePath, file), 'utf8');
              const article = JSON.parse(content);
              if (article.id || article.url) dirArticles.push(article);
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* dir missing? */ }
      }

      if (dirArticles.length > 0) {
        // Calculate Layout
        await debugLog(`[Layout] Calculating for ${name}...`);
        const optimizedArticles = optimizeArticleOrder(dirArticles);

        // Save to Web Cache (BAKING)
        try {
          await fs.mkdir(cachePath, { recursive: true }); // Ensure date dir exists in cache
          const viewModel = {
            generated_at: new Date().toISOString(),
            articles: optimizedArticles
          };
          await fs.writeFile(viewModelPath, JSON.stringify(viewModel, null, 2), 'utf8');
          await debugLog(`[Layout] Saved view_model.json to ${viewModelPath}`);
        } catch (writeErr) {
          console.error(`[Layout] Failed to save view_model.json:`, writeErr);
          await debugLog(`[Error] Failed to save view_model: ${JSON.stringify(writeErr)}`);
        }

        allArticles.push(...optimizedArticles);
      }
    }

    // Filter out articles without article_id
    return allArticles.filter(article => article.article_id || article.id);
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
            // Articles are ALREADY sorted and optimized by the server-side logic (or loaded from view_model)
            // We just render them. 
            // Note: The grouping logic above might disrupt the strict order if optimizeArticleOrder 
            // returned a flat list for the whole dir. 
            // Since we process PER DIR (which usually maps to PER DATE), the order within the group should be preserved
            // exactly as it was in the optimizedArticles array.

            const dateArticles = groupedArticles[date];

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

