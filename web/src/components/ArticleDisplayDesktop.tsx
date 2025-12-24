'use client';

import React, { useMemo } from 'react';
import ArticleCard, { Article } from './ArticleCard';
import { Calendar } from 'lucide-react';
import { LAYOUT_CONFIG } from '../config/layoutConfig';
import { optimizeArticleOrder } from '../utils/layoutOptimizer';

interface ArticleDisplayProps {
    articles: Article[];
    loading: boolean;
    error: string | null;
    currentDate?: string;
}

// Deterministic hash to keep layout stable
const getHash = (str: string) => {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};

// Physics-Based Layout Calculator (High-Res 10px Grid + Random Width)
// NO MINIMUM HEIGHT CONSTRAINTS - Cards shrink to fit content exactly
const getSizeFromScore = (score: number, id: string, summary: string = '', title: string = ''): { className: string, cols: number, rows: number } => {
    const { constraints, physics, grid } = LAYOUT_CONFIG;

    const textLength = summary.length;
    const minW = constraints.minWidth;
    const maxW = constraints.maxWidth;

    // 1. Determine WIDTH (Random + Score Bias for Variety)
    const hash = getHash(id);
    const widthRange = maxW - minW + 1;
    let cols = minW + (hash % widthRange);

    // Bias: High Impact articles (Score > 7) get wider cards
    if (score >= 7.0) {
        cols = Math.max(cols, 6);
    }
    cols = Math.min(cols, maxW);

    // 2. Physics Calculation - Exact Pixel Height Needed
    const availableWidthPx = (cols * physics.colWidthPx) - physics.paddingPx - ((cols - 1) * grid.gap);
    const charsPerLine = availableWidthPx / physics.charWidthPx;
    const estimatedLines = Math.ceil(textLength / charsPerLine);

    // RequiredHeight = Header(Title+Meta) + TextBody + Padding
    const requiredHeightPx = physics.headerHeightPx + (estimatedLines * physics.lineHeightPx) + physics.paddingPx;

    // 3. High-Res Grid Quantization (10px steps)
    const gapPx = 16;
    const trackPx = grid.cellHeight; // 10

    let rows = Math.ceil((requiredHeightPx + gapPx) / (trackPx + gapPx));

    // MINIMAL floor only - just prevent degenerate tiny cards
    const MIN_ROWS = 5;
    rows = Math.max(rows, MIN_ROWS);

    // Max cap for very long articles
    rows = Math.min(rows, 80);

    // Column class mappings for Tailwind
    const colMap: Record<number, string> = {
        3: "md:col-span-3",
        4: "md:col-span-4",
        5: "md:col-span-5",
        6: "md:col-span-6",
        7: "md:col-span-7",
        8: "md:col-span-8",
        9: "md:col-span-9",
        10: "md:col-span-10"
    };

    const colClass = colMap[cols] || "md:col-span-4";

    return { className: colClass, cols, rows };
};

export default function ArticleDisplayDesktop({ articles, loading, error, currentDate }: ArticleDisplayProps) {
    // Optimization Logic:
    // If articles already have layout data (cols, rows) from server-side baking, use them directly.
    // Otherwise, generate layout client-side (fallback).
    const optimizedArticles = useMemo(() => {
        if (!articles || articles.length === 0) return [];

        // Check if first article already has layout info (fast check)
        // If so, assume entire list is pre-baked (view_model.json)
        if (articles[0].cols && articles[0].rows) {
            return articles;
        }

        return optimizeArticleOrder(articles);
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
            <div className="max-w-2xl mx-auto bg-destructive/10 text-destructive p-6 rounded-lg text-center">
                <p className="font-bold mb-2">Error Loading News</p>
                <p>{error}</p>
            </div>
        );
    }

    if (optimizedArticles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Calendar className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-xl font-serif italic">No news published on this date.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* 10-Column Grid with High-Res 10px Rows */}
            <div className="grid grid-cols-2 md:grid-cols-10 gap-4 auto-rows-[10px] grid-flow-dense">
                {optimizedArticles.map((article, index) => {
                    const key = article.id || `article-${index}`;

                    // Headline article - special handling
                    if (index === 0) {
                        // Use pre-calculated size from optimizer if available, otherwise calculate
                        const cols = article.cols || 6;
                        const rows = article.rows ? Math.max(article.rows, 15) : 15;

                        return (
                            <React.Fragment key={key}>
                                <div className="hidden md:block md:col-start-1 md:col-span-2 md:row-start-1 pointer-events-none" style={{ gridRowEnd: `span ${rows}` }} />
                                <div className="md:col-start-3 md:col-span-6 md:row-start-1 flex flex-col" style={{ gridRowEnd: `span ${rows}` }}>
                                    <ArticleCard
                                        article={article}
                                        className="h-full font-sans"
                                        hideSummary={false}
                                        cols={6}
                                        rows={rows}
                                        currentDate={currentDate}
                                    />
                                </div>
                                <div className="hidden md:block md:col-start-9 md:col-span-2 md:row-start-1 pointer-events-none" style={{ gridRowEnd: `span ${rows}` }} />
                            </React.Fragment>
                        );
                    }

                    // Use pre-calculated sizes from optimizer directly (no recalculation!)
                    // The optimizer already calculated optimal sizes for gap-filling
                    const cols = article.cols || 4;
                    const rows = article.rows || 10;

                    // Column class mapping
                    const colMap: Record<number, string> = {
                        3: "md:col-span-3",
                        4: "md:col-span-4",
                        5: "md:col-span-5",
                        6: "md:col-span-6",
                        7: "md:col-span-7",
                        8: "md:col-span-8",
                        9: "md:col-span-9",
                        10: "md:col-span-10"
                    };
                    const colClass = colMap[cols] || "md:col-span-4";

                    return (
                        <div
                            key={key}
                            className={`${colClass} flex flex-col`}
                            style={{ gridRowEnd: `span ${rows}` }}
                        >
                            <ArticleCard
                                article={article}
                                className="h-full font-sans"
                                hideSummary={false}
                                cols={cols}
                                rows={rows}
                                currentDate={currentDate}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
