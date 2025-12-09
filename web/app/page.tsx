'use client';

import { useEffect, useState } from 'react';
import PageFrame from '@/components/PageFrame';
import ArticleDisplay from '@/components/ArticleDisplay';

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
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');
        fetchArticles(dateParam);
    }, []);

    async function fetchArticles(date?: string | null) {
        setLoading(true);
        try {
            const url = date ? `/api/articles?date=${date}` : '/api/articles';
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Failed to fetch articles');
            }
            const data = await response.json();
            setArticles(data.articles);
            setCurrentDate(data.currentDate);
            setAvailableDates(data.availableDates || []);

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
        const nextDate = currentIndex > 0 ? availableDates[currentIndex - 1] : null;
        const prevDate = currentIndex < availableDates.length - 1 ? availableDates[currentIndex + 1] : null;
        return { prev: prevDate, next: nextDate };
    };

    const { prev, next } = getPrevNextDates();

    return (
        <PageFrame
            currentDate={currentDate}
            prevDate={prev}
            nextDate={next}
            onDateChange={handleDateChange}
        >
            <ArticleDisplay
                articles={articles}
                loading={loading}
                error={error}
            />
        </PageFrame>
    );
}
