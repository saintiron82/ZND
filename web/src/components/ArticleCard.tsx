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

const ArticleCard: React.FC<ArticleCardProps> = ({ article, variant = 'standard', className = '' }) => {
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

    // Base container - no background, organic feel
    const containerBase = `group flex flex-col justify-between transition-colors duration-200 ${className}`;

    if (variant === 'lead') {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className={`${containerBase} p-4 md:p-0`}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-black dark:border-white pb-2 mb-2">
                        <span>The Lead</span>
                        <span>{formatDate(crawled_at)}</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black font-serif leading-tight text-zinc-900 dark:text-zinc-50 group-hover:text-indigo-800 dark:group-hover:text-indigo-300 transition-colors">
                        {title_ko}
                    </h2>
                    <div className="text-lg md:text-xl font-serif leading-relaxed text-zinc-700 dark:text-zinc-300 columns-1 md:columns-2 gap-8">
                        {summary}
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                        <span className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">{source_id}</span>
                        {tags?.map(tag => (
                            <span key={tag} className="text-[10px] uppercase tracking-wide text-zinc-500 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded-full">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </a>
        );
    }

    if (variant === 'sidebar') {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className={`${containerBase} py-4 border-b border-zinc-200 dark:border-zinc-800 last:border-0`}>
                <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold font-serif leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
                        {title_ko}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 font-serif">
                        {summary}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider">
                        <span>{source_id}</span>
                        <span>{formatDate(crawled_at)}</span>
                    </div>
                </div>
            </a>
        );
    }

    // Standard variant (Feed)
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={`${containerBase} p-5 border-b border-zinc-200 dark:border-zinc-800 md:border-b-0`}>
            <div className="flex flex-col h-full gap-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-400">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">{source_id}</span>
                    <span>{formatDate(crawled_at)}</span>
                </div>
                <h3 className="text-xl font-bold font-serif leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">
                    {title_ko}
                </h3>
                <p className="text-sm font-serif leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-4">
                    {summary}
                </p>
                <div className="mt-auto pt-3 flex items-center gap-2">
                    {tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] uppercase tracking-wide text-zinc-400">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </a>
    );
};

export default ArticleCard;
