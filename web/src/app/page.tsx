import { promises as fs } from 'fs';
import path from 'path';
import ArticleCard from '@/components/ArticleCard';

async function getData() {
  try {
    // Navigate up from web/ to News/ then to supplier/data/articles.json
    // process.cwd() is usually d:\News\web
    const filePath = path.join(process.cwd(), '..', 'supplier', 'data', 'articles.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Error reading articles:", error);
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

        {sortedDates.map(date => (
          <section key={date} className="mb-16">
            <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-200 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {date}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[minmax(300px,auto)]">
              {groupedArticles[date].map((article: any, index: number) => (
                <ArticleCard key={`${article.url}-${index}`} article={article} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
