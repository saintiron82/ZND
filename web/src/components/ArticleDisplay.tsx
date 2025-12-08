import React from 'react';
import ArticleCard from './ArticleCard';
import { Calendar } from 'lucide-react';
import { getGridClass } from '@/lib/layoutStrategy';

interface Article {
    id: string;
    title_ko: string;
    summary: string;
    score: number;
    layout_type: string;
    url: string;
    tags: string[];
    source_id: string;
    crawled_at: any;
}

interface ArticleDisplayProps {
    articles: Article[];
    loading: boolean;
    error: string | null;
}

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
            {/* 10-Column Mosaic Grid */}
            <div className="grid grid-cols-1 md:grid-cols-10 gap-4 auto-rows-[minmax(250px,auto)]">
                {articles.filter(a => (a.score || 0) < 6).map((article, index) => {
                    const gridClass = getGridClass(index);
                    // Hide summary for smaller cards (approximate logic)
                    const isSmall = gridClass.includes("col-span-3") || gridClass.includes("col-span-2");

                    return (
                        <div key={article.id} className={`${gridClass} flex flex-col`}>
                            <ArticleCard
                                article={article}
                                className="h-full border border-border shadow-sm"
                                hideSummary={isSmall}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
