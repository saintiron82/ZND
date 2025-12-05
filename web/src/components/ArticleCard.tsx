import React from 'react';

interface Article {
    id: string;
    title_ko: string;
    summary: string;
    score: number;
    layout_type: string;
    url: string;
    tags: string[];
    source_id: string;
    crawled_at: string | { seconds: number };
}

interface ArticleCardProps {
    article: Article;
    variant?: 'lead' | 'sidebar' | 'standard';
    className?: string;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, className = '' }) => {
    const { title_ko, summary, score, tags, url, crawled_at, source_id } = article;

    // Date formatting
    const formatDate = (date: string | { seconds: number }) => {
        if (typeof date === 'string') {
            return new Date(date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        if (date && typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        return '';
    };

    // Zero Noise Certified Badge
    const ZeroMark = () => (
        <div className="absolute -top-2 -right-2 bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-lg z-10 flex items-center gap-1 border border-yellow-200 transform rotate-3">
            <span>★ ZN Certified</span>
        </div>
    );

    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={`group relative flex flex-col justify-between transition-all duration-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl p-5 ${className}`}>
            {score === 0 && <ZeroMark />}

            <div className="flex flex-col gap-3 h-full">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-400">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">{source_id}</span>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <span className={`font-bold ${score === 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'}`}>
                            NI: {score.toFixed(1)}
                        </span>
                    </div>
                    <span>{formatDate(crawled_at)}</span>
                </div>

                <h3 className="text-xl md:text-2xl font-bold font-serif leading-tight text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
                    {title_ko}
                </h3>

                <p className="text-sm md:text-base font-serif leading-relaxed text-zinc-600 dark:text-zinc-400 flex-grow">
                    {summary}
                </p>

                <div className="mt-4 flex flex-wrap gap-1">
                    {tags?.map(tag => (
                        <span key={tag} className="text-[9px] uppercase tracking-wide text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded-sm group-hover:border-indigo-200 dark:group-hover:border-indigo-800 transition-colors">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </a>
    );
};

export default ArticleCard;
