import React from 'react';
import { ExternalLink, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface Article {
    id: string;
    title_ko: string;
    summary: string;
    impact_score?: number;
    title?: string;
    zero_noise_score?: number;
    score?: number;
    layout_type?: string;
    url: string;
    tags: string[];
    source_id: string;
    crawled_at: string | { seconds: number };
}

interface ArticleCardProps {
    article: Article;
    className?: string;
    hideSummary?: boolean;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, className = '', hideSummary = false }) => {
    const { title_ko, summary, tags, url, crawled_at, source_id, impact_score, zero_noise_score } = article;

    // Use zero_noise_score for quality indication
    const znScore = zero_noise_score ?? 0;

    // Low ZeroNoise Score (Clean) = Green, High (Noise) = Amber/Red
    // Assuming standard ZN scale: 0-3 Good, 3-6 Okay, 6+ Bad
    const getScoreColor = (s: number) => {
        if (s < 3.0) return "text-emerald-600 dark:text-emerald-400";
        if (s < 6.0) return "text-amber-600 dark:text-amber-400";
        return "text-red-600 dark:text-red-400";
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

    // Dynamic Title Size based on Impact Score
    // ADJUSTMENT: Reduced sizes AGAIN (Very Compact)
    const getTitleSize = (s?: number) => {
        const score = s || 0;
        if (hideSummary) return "text-[10px] md:text-xs";

        if (score >= 7.5) return "text-xl md:text-3xl";  // Ultra Impact (was 4xl)
        if (score >= 6) return "text-lg md:text-2xl";    // High Impact (was 3xl)
        if (score >= 4) return "text-base md:text-xl";   // Medium-High (was 2xl)
        if (score >= 2) return "text-sm md:text-lg";     // Medium (was xl)
        return "text-xs md:text-base";                   // Low Impact (was lg)
    };

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "group flex flex-col h-full p-5 transition-all duration-300 rounded-xl bg-card hover:bg-card/80 border border-border/50 hover:border-primary/20 hover:shadow-md",
                className
            )}
        >
            <div className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-sans shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-primary/80">{source_id}</span>
                        <span className={cn("flex items-center gap-1", getScoreColor(znScore))}>
                            ZN {znScore.toFixed(1)}
                        </span>
                    </div>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {dateStr}</span>
                </div>

                <h3 className={cn(
                    "font-black font-sans leading-[1.1] group-hover:text-primary transition-colors tracking-tight shrink-0",
                    getTitleSize(impact_score)
                )}>
                    {title_ko}
                </h3>

                {!hideSummary && (
                    <p className="text-muted-foreground leading-relaxed font-sans text-sm overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                        {summary}
                    </p>
                )}
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between shrink-0">
                <div className="flex gap-1 overflow-hidden">
                    {tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-sm whitespace-nowrap font-sans">
                            #{tag}
                        </span>
                    ))}
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </a>
    );
};

export default ArticleCard;
