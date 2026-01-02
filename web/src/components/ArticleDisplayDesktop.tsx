'use client';

import React, { useMemo } from 'react';
import ArticleCard, { Article } from './ArticleCard';
import { Calendar } from 'lucide-react';
import { optimizeArticleOrder } from '../utils/layoutOptimizer';

interface ArticleDisplayProps {
    articles: Article[];
    loading: boolean;
    error: string | null;
    currentDate?: string;
}

// Award style by type
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

// 레이아웃 패턴 종류
type LayoutPattern = 'L-shape' | 'reverse-L' | 'T-shape' | 'reverse-T' | 'three-equal' | 'two-one' | 'one-two';

// 패턴별 기사 수
const PATTERN_ARTICLE_COUNT: Record<LayoutPattern, number> = {
    'L-shape': 3,
    'reverse-L': 3,
    'T-shape': 3,
    'reverse-T': 3,
    'three-equal': 3,
    'two-one': 3,
    'one-two': 3,
};

// 패턴 순서 (다양성을 위해 순환)
const PATTERN_SEQUENCE: LayoutPattern[] = [
    'L-shape',      // ㄱ자: 왼쪽 세로 + 오른쪽 2개
    'reverse-T',    // 역T: 상단 2개 + 하단 넓게
    'reverse-L',    // ㄴ자: 왼쪽 2개 + 오른쪽 세로
    'T-shape',      // T자: 상단 넓게 + 하단 2개
    'three-equal',  // 3등분
    'two-one',      // 상단 2개 작게 + 하단 1개 넓게
    'one-two',      // 상단 1개 넓게 + 하단 2개 작게
];

export default function ArticleDisplayDesktop({ articles, loading, error, currentDate }: ArticleDisplayProps) {
    const optimizedArticles = useMemo(() => {
        if (!articles || articles.length === 0) return [];
        if (articles[0].cols && articles[0].rows) {
            return articles;
        }
        return optimizeArticleOrder(articles);
    }, [articles]);

    // 어워드 기사와 일반 기사 분리
    const { awardArticles, normalArticles } = useMemo(() => {
        const awarded: Article[] = [];
        const normal: Article[] = [];
        const awardedIds = new Set<string>();

        for (const article of optimizedArticles) {
            if (article.awards && article.awards.length > 0 && !awardedIds.has(article.id)) {
                awarded.push(article);
                awardedIds.add(article.id);
            } else if (!awardedIds.has(article.id)) {
                normal.push(article);
            }
        }

        return { awardArticles: awarded, normalArticles: normal };
    }, [optimizedArticles]);

    // 일반 기사들을 패턴에 따라 그룹화
    const articleGroups = useMemo(() => {
        const groups: { pattern: LayoutPattern; articles: Article[] }[] = [];
        let idx = 0;
        let patternIdx = 0;

        while (idx < normalArticles.length) {
            const pattern = PATTERN_SEQUENCE[patternIdx % PATTERN_SEQUENCE.length];
            const count = PATTERN_ARTICLE_COUNT[pattern];
            const groupArticles = normalArticles.slice(idx, idx + count);

            if (groupArticles.length > 0) {
                groups.push({ pattern, articles: groupArticles });
            }

            idx += count;
            patternIdx++;
        }

        return groups;
    }, [normalArticles]);

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
        <div className="w-full space-y-8">
            {/* 어워드 기사들 각각 풀 와이드로 단독 배치 */}
            {awardArticles.length > 0 && (
                <section className="space-y-6">
                    {awardArticles.map((article, idx) => (
                        <AwardCard key={article.id || `award-${idx}`} article={article} />
                    ))}
                </section>
            )}

            {/* 구분선 */}
            {normalArticles.length > 0 && awardArticles.length > 0 && (
                <div className="border-t border-border/30" />
            )}

            {/* 일반 기사들 - 다양한 패턴으로 배치 */}
            {articleGroups.map((group, groupIdx) => (
                <LayoutSection
                    key={`group-${groupIdx}`}
                    pattern={group.pattern}
                    articles={group.articles}
                    currentDate={currentDate}
                />
            ))}
        </div>
    );
}

// 레이아웃 섹션 컴포넌트
interface LayoutSectionProps {
    pattern: LayoutPattern;
    articles: Article[];
    currentDate?: string;
}

function LayoutSection({ pattern, articles, currentDate }: LayoutSectionProps) {
    // 기사가 부족하면 균등 분할로 폴백
    if (articles.length < 3) {
        return (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map((article, idx) => (
                    <ArticleCard
                        key={article.id || `article-${idx}`}
                        article={article}
                        className="font-sans"
                        hideSummary={false}
                        cols={5}
                        currentDate={currentDate}
                    />
                ))}
            </section>
        );
    }

    const [a1, a2, a3] = articles;

    switch (pattern) {
        case 'L-shape':
            // ㄱ자: 왼쪽 세로 긴 기사 + 오른쪽 2개 가로
            return (
                <section className="flex flex-col md:flex-row gap-4">
                    <div className="md:w-2/5">
                        <ArticleCard article={a1} className="font-sans h-full" hideSummary={false} cols={4} currentDate={currentDate} />
                    </div>
                    <div className="md:w-3/5 flex flex-col gap-4">
                        <ArticleCard article={a2} className="font-sans" hideSummary={false} cols={6} currentDate={currentDate} />
                        <ArticleCard article={a3} className="font-sans" hideSummary={false} cols={6} currentDate={currentDate} />
                    </div>
                </section>
            );

        case 'reverse-L':
            // ㄴ자: 왼쪽 2개 가로 + 오른쪽 세로 긴 기사
            return (
                <section className="flex flex-col md:flex-row gap-4">
                    <div className="md:w-3/5 flex flex-col gap-4">
                        <ArticleCard article={a1} className="font-sans" hideSummary={false} cols={6} currentDate={currentDate} />
                        <ArticleCard article={a2} className="font-sans" hideSummary={false} cols={6} currentDate={currentDate} />
                    </div>
                    <div className="md:w-2/5">
                        <ArticleCard article={a3} className="font-sans h-full" hideSummary={false} cols={4} currentDate={currentDate} />
                    </div>
                </section>
            );

        case 'T-shape':
            // T자: 상단 넓게 + 하단 2개
            return (
                <section className="flex flex-col gap-4">
                    <ArticleCard article={a1} className="font-sans" hideSummary={false} cols={10} currentDate={currentDate} />
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="md:w-1/2">
                            <ArticleCard article={a2} className="font-sans" hideSummary={false} cols={5} currentDate={currentDate} />
                        </div>
                        <div className="md:w-1/2">
                            <ArticleCard article={a3} className="font-sans" hideSummary={false} cols={5} currentDate={currentDate} />
                        </div>
                    </div>
                </section>
            );

        case 'reverse-T':
            // 역T자: 상단 2개 + 하단 넓게
            return (
                <section className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="md:w-1/2">
                            <ArticleCard article={a1} className="font-sans" hideSummary={false} cols={5} currentDate={currentDate} />
                        </div>
                        <div className="md:w-1/2">
                            <ArticleCard article={a2} className="font-sans" hideSummary={false} cols={5} currentDate={currentDate} />
                        </div>
                    </div>
                    <ArticleCard article={a3} className="font-sans" hideSummary={false} cols={10} currentDate={currentDate} />
                </section>
            );

        case 'three-equal':
            // 3등분 균일
            return (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ArticleCard article={a1} className="font-sans" hideSummary={false} cols={3} currentDate={currentDate} />
                    <ArticleCard article={a2} className="font-sans" hideSummary={false} cols={3} currentDate={currentDate} />
                    <ArticleCard article={a3} className="font-sans" hideSummary={false} cols={3} currentDate={currentDate} />
                </section>
            );

        case 'two-one':
            // 상단 2개 작게 + 하단 1개 넓게
            return (
                <section className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="md:w-2/5">
                            <ArticleCard article={a1} className="font-sans" hideSummary={false} cols={4} currentDate={currentDate} />
                        </div>
                        <div className="md:w-3/5">
                            <ArticleCard article={a2} className="font-sans" hideSummary={false} cols={6} currentDate={currentDate} />
                        </div>
                    </div>
                    <ArticleCard article={a3} className="font-sans" hideSummary={false} cols={10} currentDate={currentDate} />
                </section>
            );

        case 'one-two':
            // 상단 1개 넓게 + 하단 2개 작게
            return (
                <section className="flex flex-col gap-4">
                    <ArticleCard article={a1} className="font-sans" hideSummary={false} cols={10} currentDate={currentDate} />
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="md:w-3/5">
                            <ArticleCard article={a2} className="font-sans" hideSummary={false} cols={6} currentDate={currentDate} />
                        </div>
                        <div className="md:w-2/5">
                            <ArticleCard article={a3} className="font-sans" hideSummary={false} cols={4} currentDate={currentDate} />
                        </div>
                    </div>
                </section>
            );

        default:
            return null;
    }
}

// 어워드 카드 컴포넌트
function AwardCard({ article }: { article: Article }) {
    return (
        <div className="bg-white/5 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-zinc-300 dark:border-zinc-700 p-6 md:p-8">
            {/* Award Badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                {article.awards?.map((award: string) => (
                    <span key={award} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${getAwardStyle(award)}`}>
                        🏆 {award}
                    </span>
                ))}
            </div>

            <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group">
                <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                    ZS {(article.zero_echo_score || 0).toFixed(1)}
                </span>
                <h2 className="text-2xl md:text-3xl font-black leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors mt-2 mb-4">
                    {article.title_ko}
                </h2>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {article.summary}
                </p>
            </a>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">{article.source_id}</span>
                {article.tags?.slice(0, 4).map((tag: string) => (
                    <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-secondary/50 text-muted-foreground">
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
}
