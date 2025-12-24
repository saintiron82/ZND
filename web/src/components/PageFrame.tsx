﻿import React from 'react';
import Header from './Header';

import Footer from './Footer';
import TrendingKeywords from './TrendingKeywords';
import IssueSelector, { IssueItem } from './IssueSelector';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PageFrameProps {
    children: React.ReactNode;
    currentDate: string | null;
    editionName?: string | null;
    prevDate: string | null;
    prevEditionName?: string | null;
    prevIssueId?: string | null;
    nextDate: string | null;
    nextEditionName?: string | null;
    nextIssueId?: string | null;
    onDateChange: (date: string) => void;
    articles?: Array<{ tags?: string[] }>;
    issues?: IssueItem[];
    currentIssueId?: string | null;
    onIssueSelect?: (issueId: string) => void;
}

export default function PageFrame({
    children,
    currentDate,
    editionName,
    prevDate,
    prevEditionName,
    prevIssueId,
    nextDate,
    nextEditionName,
    nextIssueId,
    onDateChange,
    articles = [],
    issues = [],
    currentIssueId = null,
    onIssueSelect
}: PageFrameProps) {

    // Date format utility ("12월 21일" format)
    const formatDateKo = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return `${month}월 ${day}일`;
    };

    // Edition label format ("12월 21일 1호" format)
    const formatEditionLabel = (dateStr: string, edition?: string | null) => {
        const datePart = formatDateKo(dateStr);
        if (edition) {
            return `${datePart} ${edition}`;
        }
        return datePart;
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header - Full width */}
            <Header currentDate={currentDate} editionName={editionName} />

            {/* 3-column layout: Left sidebar | Content | Right sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] min-h-[calc(100vh-200px)]">

                {/* Left sidebar: PREV button + Issue selector */}
                <div className="hidden lg:flex flex-col items-center pt-8 px-2 sticky top-[220px] self-start h-fit">
                    {/* PREV button (placeholder if none) */}
                    {prevDate ? (
                        <button
                            onClick={() => onDateChange(prevIssueId || prevDate)}
                            className="flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg"
                        >
                            <ChevronLeft className="w-10 h-10" />
                            <span className="text-xs font-bold tracking-wide text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatEditionLabel(prevDate, prevEditionName)}
                            </span>
                        </button>
                    ) : (
                        <div className="h-[72px]" /> /* Placeholder - button height */
                    )}

                    {/* Issue Selector - visible on lg+ */}
                    {issues.length > 0 && onIssueSelect && (
                        <div className="w-full px-2 mt-8">
                            <IssueSelector
                                issues={issues}
                                currentIssueId={currentIssueId}
                                onIssueSelect={onIssueSelect}
                            />
                        </div>
                    )}
                </div>

                {/* Center: Main content */}
                <div className="flex flex-col w-full max-w-7xl mx-auto px-4 md:px-8">
                    {/* Article content area */}
                    <main className="flex-1 pt-4 pb-4">
                        {children}
                    </main>
                </div>

                {/* Right sidebar: NEXT button + Trending Keywords */}
                <div className="hidden lg:flex flex-col items-center pt-8 px-2 sticky top-[220px] self-start h-fit">
                    {/* NEXT button (placeholder if none) */}
                    {nextDate ? (
                        <button
                            onClick={() => onDateChange(nextIssueId || nextDate)}
                            className="flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg"
                        >
                            <ChevronRight className="w-10 h-10" />
                            <span className="text-xs font-bold tracking-wide text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatEditionLabel(nextDate, nextEditionName)}
                            </span>
                        </button>
                    ) : (
                        <div className="h-[72px]" /> /* Placeholder - button height */
                    )}

                    {/* Trending Keywords - same height as Issue Selector */}
                    {articles.length > 0 && (
                        <div className="w-full px-2 mt-8">
                            <TrendingKeywords articles={articles} maxItems={5} />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile: Bottom Fixed Navigation */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border z-50 px-4 py-3 safe-area-inset-bottom">
                <div className="flex items-center justify-between max-w-lg mx-auto">
                    {/* 이전 버튼 */}
                    <button
                        onClick={() => prevDate && onDateChange(prevIssueId || prevDate)}
                        disabled={!prevDate}
                        className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-30 transition-colors min-w-[60px]"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-[10px] font-medium">이전</span>
                    </button>

                    {/* 현재 호수 표시 */}
                    <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                            {editionName || ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {currentDate ? formatDateKo(currentDate) : ''}
                        </span>
                    </div>

                    {/* 다음 버튼 */}
                    <button
                        onClick={() => nextDate && onDateChange(nextIssueId || nextDate)}
                        disabled={!nextDate}
                        className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-30 transition-colors min-w-[60px]"
                    >
                        <ChevronRight className="w-5 h-5" />
                        <span className="text-[10px] font-medium">다음</span>
                    </button>

                    {/* 최신호 버튼 - 다음 버튼이 최신호가 아닐 때만 표시 */}
                    {issues.length > 0 && onIssueSelect && nextIssueId && nextIssueId !== issues[0]?.id && (
                        <button
                            onClick={() => onIssueSelect(issues[0].id)}
                            className="flex flex-col items-center gap-0.5 text-white min-w-[60px]"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center">
                                <span className="text-sm">⚡</span>
                            </div>
                            <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400">최신호</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Footer - Full width */}
            <Footer />
        </div>
    );
}
