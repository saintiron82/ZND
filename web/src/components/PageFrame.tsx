import React from 'react';
import Header from './Header';
import CategoryNav from './CategoryNav';
import Footer from './Footer';
import TrendingKeywords from './TrendingKeywords';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PageFrameProps {
    children: React.ReactNode;
    currentDate: string | null;
    editionName?: string | null;  // 회차명 (예: "1호", "2호")
    prevDate: string | null;
    prevEditionName?: string | null;
    nextDate: string | null;
    nextEditionName?: string | null;
    onDateChange: (date: string) => void;
    articles?: Array<{ tags?: string[] }>; // For trending keywords
}

export default function PageFrame({
    children,
    currentDate,
    editionName,
    prevDate,
    prevEditionName,
    nextDate,
    nextEditionName,
    onDateChange,
    articles = []
}: PageFrameProps) {

    // 날짜 포맷 유틸리티 ("12월 21일" 형식)
    const formatDateKo = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return `${month}월 ${day}일`;
    };

    // 회차 포맷 ("12월 21일 1호" 형식)
    const formatEditionLabel = (dateStr: string, edition?: string | null) => {
        const datePart = formatDateKo(dateStr);
        if (edition) {
            return `${datePart} ${edition}`;
        }
        return datePart;
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header - 전체 폭 */}
            <Header currentDate={currentDate} editionName={editionName} />

            {/* 3단 레이아웃: 좌측 네비 | 본문 | 우측 네비 */}
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] min-h-[calc(100vh-200px)]">

                {/* 좌측 열: PREV 버튼 */}
                <div className="hidden lg:flex flex-col items-center pt-8 px-2">
                    {prevDate && (
                        <button
                            onClick={() => onDateChange(prevDate)}
                            className="flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg"
                        >
                            <ChevronLeft className="w-10 h-10" />
                            <span className="text-xs font-bold tracking-wide text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatEditionLabel(prevDate, prevEditionName)}
                            </span>
                        </button>
                    )}
                </div>

                {/* 중앙 열: 본문 콘텐츠 */}
                <div className="flex flex-col w-full max-w-7xl mx-auto px-4 md:px-8">
                    {/* Mobile: 상단 네비게이션 바 */}
                    <div className="lg:hidden flex justify-between items-center py-4 border-b border-border/50 mb-6">
                        <button
                            onClick={() => prevDate && onDateChange(prevDate)}
                            disabled={!prevDate}
                            className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            {prevDate ? formatDateKo(prevDate) : '이전'}
                        </button>
                        <span className="text-xs font-bold text-primary">
                            {currentDate ? formatEditionLabel(currentDate, editionName) : ''}
                        </span>
                        <button
                            onClick={() => nextDate && onDateChange(nextDate)}
                            disabled={!nextDate}
                            className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                            {nextDate ? formatDateKo(nextDate) : '다음'}
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

                {/* 우측 열: NEXT 버튼 + Trending Keywords */}
                <div className="hidden lg:flex flex-col items-center pt-8 px-2">
                    {/* NEXT 버튼 */}
                    {nextDate && (
                        <button
                            onClick={() => onDateChange(nextDate)}
                            className="flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg"
                        >
                            <ChevronRight className="w-10 h-10" />
                            <span className="text-xs font-bold tracking-wide text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatEditionLabel(nextDate, nextEditionName)}
                            </span>
                        </button>
                    )}

                    {/* Trending Keywords - lg 이상에서 표시 */}
                    {articles.length > 0 && (
                        <div className="w-full px-2 mt-8">
                            <TrendingKeywords articles={articles} maxItems={8} />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer - 전체 폭 */}
            <Footer />
        </div>
    );
}
