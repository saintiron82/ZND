'use client';

import React from 'react';
import { LAYOUT_CONFIG } from '../config/layoutConfig';
import { ExternalLink, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { sendGAEvent } from '@next/third-parties/google';
import ZSFeedbackButtons from './ZSFeedbackButtons';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface Article {
    id: string;
    title_ko: string;
    summary: string;
    impact_score?: number;
    title?: string;
    zero_echo_score?: number;
    score?: number;
    layout_type?: string;
    url: string;
    tags: string[];
    source_id: string;
    crawled_at: string | { seconds: number };
    published_at?: string | { seconds: number };  // 발행일 추가
    awards?: string[]; // Award badges: "Today's Headline", "Zero Echo Award", "Hot Topic"
    cols?: number;
    rows?: number;
}

interface ArticleCardProps {
    article: Article;
    className?: string;
    hideSummary?: boolean;
    cols?: number;
    rows?: number;
    currentDate?: string;  // 피드백용 날짜 (YYYY-MM-DD)
    showFeedback?: boolean; // 피드백 버튼 표시 여부
}

// Award badge styling
const getAwardStyle = (award: string) => {
    switch (award) {
        case "Today's Headline":
            return "bg-gradient-to-r from-amber-400 to-orange-500 text-white";
        case "Zero Echo Award":
            return "bg-gradient-to-r from-emerald-400 to-teal-500 text-white";
        case "Hot Topic":
            return "bg-gradient-to-r from-rose-400 to-pink-500 text-white";
        default:
            return "bg-teal-500 text-white";
    }
};

const ArticleCard: React.FC<ArticleCardProps> = ({ article, className = '', hideSummary = false, cols = 4, rows = 2, currentDate, showFeedback = true }) => {
    const { id, title_ko, summary, tags, url, crawled_at, published_at, source_id, impact_score, zero_echo_score, awards, layout_type } = article;

    // Use zero_echo_score for quality indication
    const zeScore = zero_echo_score ?? 0;

    // ... (score color logic) ...
    const getScoreColor = (s: number) => {
        if (s < 3.0) return "text-emerald-600 dark:text-emerald-400";
        if (s < 6.0) return "text-amber-600 dark:text-amber-400";
        return "text-red-600 dark:text-red-400";
    };

    // ... (date format logic) - 발행일(published_at) 우선 사용 ...
    const formatDate = (date: string | { seconds: number } | undefined) => {
        if (!date) return '';
        if (typeof date === 'string') {
            return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
        if (date && typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
        return '';
    };

    // 발행일(published_at) 우선, 없으면 crawled_at 사용
    // [Yena] currentDate(회차 날짜)가 있으면 우선 사용하여 달력과 일치시킴
    const dateStr = currentDate ? formatDate(currentDate) : (formatDate(published_at) || formatDate(crawled_at));

    // Dynamic Title Size based on Impact Score
    const getTitleSize = (s?: number) => {
        const score = s || 0;
        if (hideSummary) return "text-[10px] md:text-xs";

        if (score >= 7.5) return "text-xl md:text-3xl";
        if (score >= 6) return "text-lg md:text-2xl";
        if (score >= 4) return "text-base md:text-xl";
        if (score >= 2) return "text-sm md:text-lg";
        return "text-xs md:text-base";
    };

    // Dynamic Line Clamp based on actual Height (High-Res 10px Rows)
    // HeightPx = (rows * 10) + ((rows - 1) * 16). (Include Gap-4 = 16px)
    // Fixed Overhead (Title/Date/Pad) ~= 100px.
    // LineHeight ~= 24px.
    const gapPx = 16;
    const heightPx = (rows * 10) + Math.max(0, rows - 1) * gapPx;
    const maxLines = Math.max(3, Math.floor((heightPx - 100) / 24));

    // 클릭 이벤트 버블링 방지를 위한 핸들러
    const handleFeedbackClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // GA4 기사 클릭 이벤트 추적
    const handleArticleClick = () => {
        sendGAEvent('event', 'article_click', {
            article_id: id,
            article_title: title_ko.substring(0, 100), // 제목 100자 제한
            article_score: zeScore,
            layout_type: layout_type || 'standard',
            source: source_id,
            tags: tags?.slice(0, 3).join(',') || '',
            has_award: awards && awards.length > 0 ? 'yes' : 'no'
        });
    };


    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleArticleClick}
            className={cn(
                "group flex flex-col h-full p-5 transition-all duration-300 rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-800/50 hover:border-teal-400/40 hover:shadow-lg hover:shadow-teal-500/5",
                className
            )}
        >
            <div className="flex flex-col gap-3 flex-1 min-h-0">
                {/* Award Badges */}
                {awards && awards.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                        {awards.map(award => (
                            <span
                                key={award}
                                className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm",
                                    getAwardStyle(award)
                                )}
                            >
                                🏆 {award}
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-sans shrink-0">
                    <span className={cn("flex items-center gap-1", getScoreColor(zeScore))}>
                        ZS {zeScore.toFixed(1)}
                    </span>
                    {/* 날짜 표시 제거 (회차 날짜와 중복됨) */}
                </div>

                <h3 className={cn(
                    "font-black font-sans leading-[1.1] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors tracking-tight shrink-0",
                    getTitleSize(impact_score)
                )}>
                    {title_ko}
                </h3>

                {!hideSummary && (
                    <p
                        className="text-muted-foreground leading-relaxed font-sans text-sm"
                        style={{
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: maxLines,
                            overflow: 'hidden'
                        }}
                    >
                        {summary}
                    </p>
                )}
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between shrink-0">
                <div className="flex gap-1.5 items-center overflow-hidden">
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap font-sans">{source_id}</span>
                    {tags && tags.length > 0 && <span className="text-muted-foreground/50">·</span>}
                    {tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-sm whitespace-nowrap font-sans">
                            #{tag}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {/* ZS Feedback Buttons */}
                    {showFeedback && currentDate && id && (
                        <div onClick={handleFeedbackClick}>
                            <ZSFeedbackButtons
                                articleId={id}
                                date={currentDate}
                                size="sm"
                            />
                        </div>
                    )}
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
        </a>
    );
};

export default ArticleCard;

