import { promises as fs } from 'fs';
import path from 'path';
import ArticleCard from '@/components/ArticleCard';
import ArticleDisplay from '@/components/ArticleDisplay';
import { optimizeArticleOrder } from '@/utils/layoutOptimizer';


import HomePageClient from '@/components/HomePageClient';

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

        // NEW: Lightweight index - load individual files
        if (manifest.articles && Array.isArray(manifest.articles)) {
          for (const entry of manifest.articles) {
            // Check if this is a lightweight entry (has filename) or full article
            if (entry.filename) {
              // Lightweight index: load individual file
              try {
                const articlePath = path.join(sourcePath, entry.filename);
                const articleContent = await fs.readFile(articlePath, 'utf8');
                const article = JSON.parse(articleContent);
                dirArticles.push(article);
              } catch (e) {
                console.error(`Failed to load article: ${entry.filename}`, e);
              }
            } else {
              // Legacy full article in index (backward compatible)
              dirArticles.push(entry);
            }
          }
        }
      } catch (err) {
        // Fallback: Scan individual JSON files
        try {
          const files = await fs.readdir(sourcePath);
          const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json' && file !== 'view_model.json' && file !== 'daily_summary.json');
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
  return <HomePageClient articles={articles} />;
}


