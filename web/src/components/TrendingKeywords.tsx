﻿'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface TrendingKeywordsProps {
    articles: Array<{ tags?: string[] }>;
    maxItems?: number;
}

// Calculate tag frequencies from articles
const calculateTagFrequencies = (articles: Array<{ tags?: string[] }>): Array<{ tag: string; count: number }> => {
    const tagCounts: Record<string, number> = {};

    articles.forEach(article => {
        article.tags?.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
};

// Tag display name mapping (actual tags from data)
const getTagDisplayName = (tag: string): string => {
    const displayNames: Record<string, string> = {
        'GEN_AI': 'Generative AI',
        'LLM': 'LLM',
        'BIZ_STRATEGY': 'Business',
        'REGULATION': 'Regulation',
        'AGENTS': 'AI Agents',
        'AI_CHIP': 'AI Chip',
        'WORK_IMPACT': 'Work Impact',
        'AI_ETHICS': 'AI Ethics',
        'DAILY_UPDATE': 'Daily Update',
        'RESEARCH': 'Research',
        'ROBOTICS': 'Robotics',
        'AUTONOMOUS': 'Autonomous',
        'VISION': 'Vision AI',
        'SPEECH': 'Speech AI',
        'EDGE_AI': 'Edge AI',
        'ML_OPS': 'MLOps',
    };
    return displayNames[tag] || tag.replace(/_/g, ' ');
};

// Rank badge colors (number)
const getRankStyle = (rank: number): string => {
    switch (rank) {
        case 1: return 'text-amber-500 font-black';
        case 2: return 'text-zinc-400 font-bold';
        case 3: return 'text-orange-700 font-bold';
        default: return 'text-zinc-500 font-medium';
    }
};

// Trending rank badge style (same as article tags)
const getTrendingBadgeStyle = (rank: number): string => {
    switch (rank) {
        case 1: return "bg-gradient-to-r from-amber-400 to-orange-500 text-white"; // Gold
        case 2: return "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-800"; // Silver
        case 3: return "bg-gradient-to-r from-amber-600 to-amber-700 text-white"; // Bronze
        case 4: return "bg-teal-500 text-white";
        case 5: return "bg-sky-500 text-white";
        default: return "bg-secondary/50 text-muted-foreground";
    }
};

export default function TrendingKeywords({ articles, maxItems = 5 }: TrendingKeywordsProps) {
    const trendingTags = React.useMemo(() => {
        return calculateTagFrequencies(articles).slice(0, maxItems);
    }, [articles, maxItems]);

    // Display container even when no tags
    if (trendingTags.length === 0) {
        return (
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-teal-500" />
                    <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                        오늘의 트렌드
                    </h3>
                </div>
                <p className="text-xs text-muted-foreground text-center py-4">
                    태그 데이터 준비 중...
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-teal-500" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                    오늘의 트렌드
                </h3>
            </div>

            <div className="space-y-1.5">
                {trendingTags.map((item, index) => (
                    <div
                        key={item.tag}
                        className={cn(
                            "flex items-center gap-1.5 py-1.5 px-2 rounded-lg transition-colors cursor-default",
                            getTrendingBadgeStyle(index + 1)
                        )}
                    >
                        <span className="text-xs font-black w-4 flex-shrink-0">
                            {index + 1}
                        </span>
                        <span className="text-xs font-bold">
                            {getTagDisplayName(item.tag)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
