'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ArticleCard from '@/components/ArticleCard';

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

export default function Home() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState<string | null>(null);
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    useEffect(() => {
        // Get date from URL query param if present
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');
        fetchArticles(dateParam);
    }, []);

    async function fetchArticles(date?: string | null) {
        setLoading(true);
        try {
            const url = date ? `/api/articles?date=${date}` : '/api/articles';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch articles');
            }
            const data = await response.json();
            setArticles(data.articles);
            setCurrentDate(data.currentDate);
            setAvailableDates(data.availableDates || []);

            // Update URL without reload
            if (data.currentDate) {
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('date', data.currentDate);
                window.history.pushState({}, '', newUrl);
            }
        } catch (err: any) {
            console.error("Error fetching articles:", err);
            setError("Failed to load articles. Please ensure the crawler has run.");
        } finally {
            setLoading(false);
        }
    }

    const handleDateChange = (date: string) => {
        fetchArticles(date);
    };

    const getPrevNextDates = () => {
        if (!currentDate || availableDates.length === 0) return { prev: null, next: null };
        const currentIndex = availableDates.indexOf(currentDate);
        if (currentIndex === -1) return { prev: null, next: null };

        // availableDates is sorted desc (newest first)
        // Next Day -> newer date (lower index)
        // Prev Day -> older date (higher index)
        const nextDate = currentIndex > 0 ? availableDates[currentIndex - 1] : null;
        const prevDate = currentIndex < availableDates.length - 1 ? availableDates[currentIndex + 1] : null;

        return { prev: prevDate, next: nextDate };
    };

    const { prev, next } = getPrevNextDates();

    return (
        <main className="min-h-screen bg-paper dark:bg-zinc-900 p-4 md:p-8 font-sans transition-colors duration-300">
            <header className="mb-8 md:mb-10 max-w-7xl mx-auto border-b-4 border-double border-black dark:border-white pb-6 text-center">
                <div className="flex flex-col items-center mb-6">
                    <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-zinc-900 dark:text-white font-serif leading-none flex items-baseline gap-2 md:gap-4 justify-center">
                        ZeroNoise<span className="text-indigo-700">.</span>
                        <span className="text-3xl md:text-5xl font-light italic text-zinc-400 dark:text-zinc-500 tracking-normal">Daily</span>
                    </h1>
                    <div className="mt-4 flex flex-col items-center">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                            {currentDate ? new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading...'}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">
                            Vol. 1 • Curated Global Insights
                        </p>
                    </div>
                </div>

                {/* Navigation Bar */}
                <div className="flex justify-between items-center border-t border-zinc-900/10 dark:border-zinc-100/10 pt-3 max-w-4xl mx-auto w-full">
                    <button
                        onClick={() => prev && handleDateChange(prev)}
                        disabled={!prev}
                        className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors ${prev ? 'text-zinc-600 hover:text-indigo-800 cursor-pointer' : 'text-zinc-300 cursor-not-allowed'}`}
                    >
                        ← Previous
                    </button>

                    <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-300 font-serif italic text-center hidden md:block">
                        "All the signal, none of the noise."
                    </p>

                    <button
                        onClick={() => next && handleDateChange(next)}
                        disabled={!next}
                        className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors ${next ? 'text-zinc-600 hover:text-indigo-800 cursor-pointer' : 'text-zinc-300 cursor-not-allowed'}`}
                    >
                        Next →
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <>
                    {articles.length > 0 ? (
                        <div className="max-w-7xl mx-auto">
                            {/* Top Section: Lead + Sidebar */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-t border-black dark:border-white border-b-4 border-double">
                                {/* Lead Article (Left/Center - 8 cols) */}
                                <div className="lg:col-span-8 border-r border-zinc-200 dark:border-zinc-800 p-4 md:p-6">
                                    {articles[0] && (
                                        <ArticleCard article={articles[0]} variant="lead" />
                                    )}
                                </div>

                                {/* Sidebar (Right - 4 cols) */}
                                <div className="lg:col-span-4 flex flex-col">
                                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                                        <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-500 text-center">Top Stories</h3>
                                    </div>
                                    <div className="flex flex-col">
                                        {articles.slice(1, 5).map((article) => (
                                            <ArticleCard key={article.id} article={article} variant="sidebar" className="px-4" />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Feed Section (Bottom - 3 cols) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-l border-zinc-200 dark:border-zinc-800">
                                {articles.slice(5).map((article) => (
                                    <div key={article.id} className="border-r border-b border-zinc-200 dark:border-zinc-800">
                                        <ArticleCard article={article} variant="standard" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-xl text-zinc-400 font-serif italic">No news published on this date.</p>
                        </div>
                    )}
                </>
            )}

            {error && (
                <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50" role="alert">
                    <strong className="font-bold">Notice: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
        </main>
    );
}
