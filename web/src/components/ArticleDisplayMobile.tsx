'use client';

import React, { useMemo, useRef } from 'react';
import ArticleCard, { Article } from './ArticleCard';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface ArticleDisplayProps {
    articles: Article[];
    loading: boolean;
    error: string | null;
    currentDate?: string;
}

export default function ArticleDisplayMobile({ articles, loading, error, currentDate }: ArticleDisplayProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleScroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = window.innerWidth * 0.8; // 80vw per card
            scrollContainerRef.current.scrollBy({
                left: direction === 'right' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // Mobile optimization: Divide articles into separate sections
    const { topArticles, scrollArticles } = useMemo(() => {
        if (!articles || articles.length === 0) return { topArticles: [], scrollArticles: [] };

        // 상위 3개까지는 세로로 배치, 나머지는 가로 스크롤
        // Top 3 stacked vertically, reset horizontal scroll
        return {
            topArticles: articles.slice(0, 3),
            scrollArticles: articles.slice(3)
        };
    }, [articles]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-destructive/10 text-destructive p-6 rounded-lg text-center mx-4">
                <p className="font-bold mb-2">Error Loading News</p>
                <p>{error}</p>
            </div>
        );
    }

    if (articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Calendar className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-xl font-serif italic">No news published on this date.</p>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-6 pb-2">
            {/* 1. Top Section: Stacked Vertically */}
            <div className="flex flex-col gap-6 px-4">
                {topArticles.map((article, index) => (
                    <div key={article.id || `mobile-top-${index}`} className="w-full">
                        <ArticleCard
                            article={article}
                            className="w-full"
                            hideSummary={false}
                            cols={6}
                            currentDate={currentDate}
                        />
                    </div>
                ))}
            </div>

            {/* 2. Scroll Section: Horizontal Snap Scroll with Glassmorphism */}
            {scrollArticles.length > 0 && (
                <div className="w-full flex flex-col gap-3 relative">
                    <div className="px-4 text-sm font-bold text-muted-foreground tracking-widest uppercase">
                        More News
                    </div>

                    {/* Scroll Container with Glassmorphism edges */}
                    <div className="relative">
                        {/* Left blur overlay */}
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background via-background/80 to-transparent z-10 pointer-events-none" />

                        {/* Right blur overlay */}
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none" />

                        {/* Vertical Swipe Guides (Brand Color) - Interactive Buttons */}
                        <button
                            onClick={() => handleScroll('left')}
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-24 w-4 flex items-center justify-center z-20 cursor-pointer group focus:outline-none"
                            aria-label="Scroll Left"
                        >
                            <div className="h-full w-1 bg-teal-500/80 rounded-r-full group-active:bg-teal-600 animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.5)] transition-colors" />
                        </button>

                        <button
                            onClick={() => handleScroll('right')}
                            className="absolute right-0 top-1/2 -translate-y-1/2 h-24 w-4 flex items-center justify-center z-20 cursor-pointer group focus:outline-none"
                            aria-label="Scroll Right"
                        >
                            <div className="h-full w-1 bg-teal-500/80 rounded-l-full group-active:bg-teal-600 animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.5)] transition-colors" />
                        </button>

                        {/* Snap Scroll Container */}
                        <div
                            ref={scrollContainerRef}
                            className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-8 pb-2 scrollbar-hide"
                            style={{ touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' }}
                        >
                            {scrollArticles.map((article, index) => (
                                <div
                                    key={article.id || `mobile-scroll-${index}`}
                                    className="flex-none w-[80vw] snap-center px-4"
                                >
                                    <ArticleCard
                                        article={article}
                                        className="w-full"
                                        hideSummary={false}
                                        cols={6}
                                        currentDate={currentDate}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
