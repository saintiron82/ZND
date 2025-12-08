import React from 'react';
import { ExternalLink, Clock, Hash } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

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
    className?: string;
    hideSummary?: boolean; // Option to hide summary for small cards
    showImage?: boolean;   // Option to show image (if we had one)
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, className = '', hideSummary = false }) => {
    const { title_ko, summary, tags, url, crawled_at, source_id, score } = article;

    // ZeroNoise Logic
    // 0.0 ~ 2.9: Pure Signal (High Quality) -> Full Summary, Emphasized
    // 3.0 ~ 6.0: General (Standard) -> Clamped Summary
    // 6.0+: Discarded (Should be filtered out, but handle gracefully just in case)

    const isPureSignal = score !== undefined && score < 3.0;

    // Dynamic Density: Pure Signal gets full text, others get clamped
    const summaryClass = isPureSignal
        ? "line-clamp-none text-[15px] md:text-base"
        : "line-clamp-4 text-sm md:text-[15px]";

    // Card Style: Pure Signal gets a subtle border/shadow boost
    const cardStyle = isPureSignal
        ? "ring-1 ring-primary/20 bg-card/50 shadow-sm"
        : "bg-card hover:bg-card/80";

    // Score Color
    const getScoreColor = (s: number) => {
        if (s < 3.0) return "text-emerald-600 dark:text-emerald-400";
        return "text-amber-600 dark:text-amber-400";
    };

    // Date formatting
    const formatDate = (date: string | { seconds: number }) => {
        if (typeof date === 'string') {
            return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
        if (date && typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
        return '';
    };

    const dateStr = formatDate(crawled_at);

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "group flex flex-col justify-between h-full p-6 transition-all duration-300 rounded-xl",
                cardStyle,
                className
            )}
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground font-sans">
                    <div className="flex items-center gap-3">
                        <span className="text-primary">{source_id}</span>
                        {score !== undefined && (
                            <span className={cn("flex items-center gap-1", getScoreColor(score))}>
                                ZN {score.toFixed(1)}
                            </span>
                        )}
                    </div>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {dateStr}</span>
                </div>

                <h3 className={cn(
                    "font-black font-sans leading-[1.1] group-hover:text-primary transition-colors tracking-tight",
                    hideSummary ? "text-lg line-clamp-3" : (isPureSignal ? "text-2xl md:text-4xl" : "text-xl md:text-2xl")
                )}>
                    {title_ko}
                </h3>

                {!hideSummary && (
                    <p className={cn("text-muted-foreground leading-relaxed font-sans transition-all", summaryClass)}>
                        {summary}
                    </p>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                <div className="flex gap-2 overflow-hidden">
                    {tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-secondary px-2 py-1 rounded-sm whitespace-nowrap font-sans">
                            #{tag}
                        </span>
                    ))}
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </a>
    );
};

export default ArticleCard;
