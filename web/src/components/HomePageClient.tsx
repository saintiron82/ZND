
'use client';

import React from 'react';
import ArticleDisplay from '@/components/ArticleDisplay';
import { useDatePolling } from '@/hooks/useDatePolling';
import { RefreshCcw, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HomePageClientProps {
    articles: any[];
    isPreview?: boolean;
}

export default function HomePageClient({ articles, isPreview = false }: HomePageClientProps) {
    const router = useRouter();

    // 날짜별 그룹핑 로직 (클라이언트에서 수행하여 구조 유연성 확보)
    const groupedArticles: { [key: string]: any[] } = {};
    articles.forEach((article: any) => {
        let dateStr = '';
        if (typeof article.crawled_at === 'string') {
            dateStr = new Date(article.crawled_at).toLocaleDateString();
        } else if (article.crawled_at && typeof article.crawled_at === 'object' && 'seconds' in article.crawled_at) {
            dateStr = new Date(article.crawled_at.seconds * 1000).toLocaleDateString();
        }

        if (dateStr) {
            if (!groupedArticles[dateStr]) {
                groupedArticles[dateStr] = [];
            }
            groupedArticles[dateStr].push(article);
        }
    });

    const sortedDates = Object.keys(groupedArticles).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const latestDate = sortedDates.length > 0 ? sortedDates[0] : null;

    // 1분(60초)마다 폴링하여 새 데이터 확인
    const { hasNewDate, serverLatestDate } = useDatePolling(latestDate, 60000);

    const handleRefresh = () => {
        router.refresh(); // 서버 컴포넌트 재실행 (데이터 갱신)
        window.location.reload(); // 확실하게 새로고침 (캐시 이슈 방지)
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-8 relative">

            {/* 새 데이터 알림 배너 (Alert Banner) */}
            {hasNewDate && (
                <div
                    onClick={handleRefresh}
                    className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] cursor-pointer animate-in fade-in slide-in-from-top-4 duration-500"
                >
                    <div className="bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-xl flex items-center gap-3 hover:scale-105 transition-transform font-bold border border-primary/20 backdrop-blur-md">
                        <RefreshCcw className="w-4 h-4 animate-spin-slow" />
                        <span>New Edition Available ({serverLatestDate})</span>
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            )}

            {/* Preview 모드 배너 */}
            {isPreview && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]">
                    <div className="bg-amber-500 text-black px-6 py-2 rounded-full shadow-xl flex items-center gap-2 font-bold">
                        <span>🔒 PREVIEW MODE</span>
                        <span className="text-amber-900 text-sm">- 발행 전 미리보기</span>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto">
                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                        Latest Tech News
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                        Curated tech news and insights, powered by AI.
                    </p>
                </header>

                <div className="flex flex-col gap-12">
                    {sortedDates.map(date => {
                        const dateArticles = groupedArticles[date];

                        return (
                            <section key={date} className="mb-0">
                                <h2 className="text-xl font-bold text-foreground mb-6 flex items-baseline gap-4 border-b border-border pb-2">
                                    <span className="font-serif italic text-3xl">{date.split('.')[2]}</span>
                                    <span className="text-muted-foreground text-sm uppercase tracking-widest font-sans">
                                        {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long' })}
                                    </span>
                                </h2>
                                <ArticleDisplay articles={dateArticles} loading={false} error={null} />
                            </section>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
