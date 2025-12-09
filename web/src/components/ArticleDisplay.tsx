import React from 'react';
import ArticleCard, { Article } from './ArticleCard';
import { Calendar } from 'lucide-react';

interface ArticleDisplayProps {
    articles: Article[];
    loading: boolean;
    error: string | null;
}

// Deterministic hash to keep layout stable between renders/hydrations
const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

const getSizeFromScore = (score: number, id: string, summary: string = '', title: string = ''): string => {
    // 1. Calculate Initial Target Area based on Impact Score
    const s = score || 0;
    // Base 8 (4x2) + Logarithmic Growth
    let targetArea = 8 + Math.log2(s + 1) * 2.5;

    // 2. Calculate Content Demand and Grid Capacity
    // - Title is larger, counts as ~3x char weight
    // - 1 Grid Cell (150x110) can hold roughly 70-80 chars of normal text density
    const CHARS_PER_CELL = 75;
    const titleDemand = (title.length || 0) * 3;
    const summaryDemand = (summary.length || 0);
    const totalContentDemand = titleDemand + summaryDemand;

    // 3. Determine Shape Dimensions based on targetArea
    // (This is a simplified simulation to check capacity)
    // We assume default shape is roughly rectangular
    let cols = 4;
    let rows = 2; // Default 4x2 = 8

    if (targetArea >= 24) { cols = 6; rows = 4; } // 24
    else if (targetArea >= 16) { cols = 4; rows = 4; } // 16
    else if (targetArea >= 12) { cols = 4; rows = 3; } // 12

    let currentCapacity = cols * rows * CHARS_PER_CELL;

    // 4. Adjust Dimensions based on Demand/Capacity Ratio

    // Case A: Content Overlay (Demand > Capacity) -> EXPAND
    // If content exceeds 90% of capacity, we need more space immediately
    if (totalContentDemand > currentCapacity * 0.9) {
        // Boost area significantly to jump to next tier
        targetArea = Math.max(targetArea + 8, Math.ceil(totalContentDemand / CHARS_PER_CELL));
    }

    // Case B: Excessive Whitespace (Demand < Capacity) -> SHRINK
    // If content uses less than 40% of capacity, we should shrink
    else if (totalContentDemand < currentCapacity * 0.4) {
        // Reduce area, but respect minimums
        targetArea = Math.max(8, targetArea - 4);
    }

    const hash = getHash(id);

    // 5. Map Adjusted Target Area to Actual Grid Classes
    // Massive (Area >= 24) -> 6x4 (24) or 8x3 (24)
    if (targetArea >= 24) {
        return hash % 2 === 0 ? "md:col-span-6 md:row-span-4" : "md:col-span-8 md:row-span-3";
    }

    // Huge (Area >= 16) -> 4x4 (16)
    if (targetArea >= 16) {
        return "md:col-span-4 md:row-span-4";
    }

    // Large (Area >= 12) -> 4x3 (12) or 3x4 (12)
    if (targetArea >= 12) {
        return hash % 2 === 0 ? "md:col-span-4 md:row-span-3" : "md:col-span-3 md:row-span-4";
    }

    // MINIMUM SIZE: 8 CELLS (4x2 or 2x4)
    const minHash = hash % 3;
    if (minHash === 0) return "md:col-span-4 md:row-span-2"; // 4x2
    if (minHash === 1) return "md:col-span-2 md:row-span-4"; // 2x4
    return "md:col-span-4 md:row-span-2"; // Default
};

export default function ArticleDisplay({ articles, loading, error }: ArticleDisplayProps) {

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

    if (articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Calendar className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-xl font-serif italic">No news published on this date.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* 8-Column Grid (Tetris Layout) */}
            <div className="grid grid-cols-2 md:grid-cols-8 gap-4 auto-rows-[110px] grid-flow-dense">
                {articles.map((article, index) => {
                    // Card size is based on Impact Score ONLY
                    const impactScore = article.impact_score || 0;

                    if (index === 0) {
                        return (
                            <React.Fragment key={article.id}>
                                {/* Left Spacer (Block Col 1, Row 1-3) */}
                                <div className="hidden md:block md:col-start-1 md:row-start-1 md:row-span-3 pointer-events-none" />

                                {/* The Headline Article (Center, Row 1-3) */}
                                <div className="md:col-start-2 md:col-span-6 md:row-start-1 md:row-span-3 flex flex-col">
                                    <ArticleCard
                                        article={article}
                                        className="h-full font-sans"
                                        hideSummary={false}
                                    />
                                </div>

                                {/* Right Spacer (Block Col 8, Row 1-3) */}
                                <div className="hidden md:block md:col-start-8 md:row-start-1 md:row-span-3 pointer-events-none" />
                            </React.Fragment>
                        );
                    }

                    const gridClass = getSizeFromScore(
                        impactScore,
                        article.id,
                        article.summary || '',
                        article.title_ko || article.title || ''
                    );

                    // Hide summary for very small blocks to keep it clean
                    const isSmall = gridClass.includes("col-span-1") && gridClass.includes("row-span-1");

                    return (
                        <div key={article.id} className={`${gridClass} flex flex-col`}>
                            <ArticleCard
                                article={article}
                                className="h-full font-sans"
                                hideSummary={isSmall}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
