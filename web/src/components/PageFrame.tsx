import React from 'react';
import Header from './Header';
import CategoryNav from './CategoryNav';
import Footer from './Footer';
import TrendingKeywords from './TrendingKeywords';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PageFrameProps {
    children: React.ReactNode;
    currentDate: string | null;
    prevDate: string | null;
    nextDate: string | null;
    onDateChange: (date: string) => void;
    articles?: Array<{ tags?: string[] }>; // For trending keywords
}

export default function PageFrame({
    children,
    currentDate,
    prevDate,
    nextDate,
    onDateChange,
    articles = []
}: PageFrameProps) {

    // 날짜 포맷 유틸리티
    const formatEdition = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const yy = date.getFullYear().toString().slice(-2);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        return `${yy}${mm}${dd}_${dayName}_1`;
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header - 전체 폭 */}
            <Header currentDate={currentDate} />

            {/* 3단 레이아웃: 좌측 네비 | 본문 | 우측 네비 */}
            <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_80px] lg:grid-cols-[100px_1fr_100px] xl:grid-cols-[100px_1fr_220px] min-h-[calc(100vh-200px)]">

                {/* 좌측 열: PREV 버튼 - 상단 배치 */}
                <div className="hidden md:flex items-start justify-center sticky top-0 h-screen pt-8">
                    {prevDate && (
                        <button
                            onClick={() => onDateChange(prevDate)}
                            className="flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg"
                        >
                            <ChevronLeft className="w-10 h-10" />
                            <span className="text-xs font-black tracking-widest uppercase text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatEdition(prevDate)}
                            </span>
                        </button>
                    )}
                </div>

                {/* 중앙 열: 본문 콘텐츠 */}
                <div className="flex flex-col w-full max-w-7xl mx-auto px-4 md:px-8">
                    {/* Mobile: 상단 네비게이션 바 */}
                    <div className="md:hidden flex justify-between items-center py-4 border-b border-border/50 mb-6">
                        <button
                            onClick={() => prevDate && onDateChange(prevDate)}
                            disabled={!prevDate}
                            className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            {prevDate ? formatEdition(prevDate) : 'PREV'}
                        </button>
                        <span className="text-xs font-bold uppercase text-primary">
                            {currentDate && formatEdition(currentDate)}
                        </span>
                        <button
                            onClick={() => nextDate && onDateChange(nextDate)}
                            disabled={!nextDate}
                            className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                            {nextDate ? formatEdition(nextDate) : 'NEXT'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* 카테고리 네비게이션 */}
                    <CategoryNav />

                    {/* 기사 콘텐츠 영역 */}
                    <main className="flex-1 py-6">
                        {children}
                    </main>
                </div>

                {/* 우측 열: NEXT 버튼 + Trending Keywords - 상단 배치 */}
                <div className="hidden md:flex flex-col items-center sticky top-0 h-screen pt-8">
                    {/* NEXT 버튼 - 상단 배치 */}
                    {nextDate && (
                        <button
                            onClick={() => onDateChange(nextDate)}
                            className="flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg"
                        >
                            <ChevronRight className="w-10 h-10" />
                            <span className="text-xs font-black tracking-widest uppercase text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatEdition(nextDate)}
                            </span>
                        </button>
                    )}

                    {/* Trending Keywords - 그 아래 (xl 이상에서만) */}
                    {articles.length > 0 && (
                        <div className="hidden xl:block w-full px-2 mt-8">
                            <TrendingKeywords articles={articles} maxItems={5} />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer - 전체 폭 */}
            <Footer />
        </div>
    );
}
