﻿import React, { useState } from 'react';
import Header from './Header';

import Footer from './Footer';
import TrendingKeywords from './TrendingKeywords';
import IssueSelector, { IssueItem } from './IssueSelector';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

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
    const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);

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
            <div
                className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-border z-50 px-4 py-1.5 safe-area-inset-bottom backdrop-blur-md bg-transparent"
            >
                {/* 다크모드 배경용 (absolute overlay) */}
                <div className="absolute inset-0 bg-white/75 dark:bg-zinc-950/75 -z-10" />
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

                    {/* 현재 호수 표시 (클릭하여 선택기 열기) */}
                    <div className="relative">
                        <button
                            onClick={() => setIsMobileSelectorOpen(!isMobileSelectorOpen)}
                            className="flex flex-col items-center justify-center gap-1.5 py-1 active:scale-95 transition-transform"
                        >
                            <div className="flex flex-col items-center leading-none gap-0.5">
                                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                    {editionName || ''}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {currentDate ? formatDateKo(currentDate) : ''}
                                </span>
                            </div>

                            {/* 가로 가이드 바 (Teal Color Indicator) */}
                            <div className={`h-1.5 rounded-full transition-all duration-300 mt-1 ${isMobileSelectorOpen
                                ? 'bg-teal-600 w-20 shadow-[0_0_8px_rgba(13,148,136,0.8)]'
                                : 'bg-teal-500 w-12 opacity-80 animate-pulse'
                                }`} />
                        </button>
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

            {/* Mobile Selector Modal (Moved outside to escape stacking context) */}
            {isMobileSelectorOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-transparent z-[60]"
                        onClick={() => setIsMobileSelectorOpen(false)}
                    />

                    {/* Popup Container */}
                    <div className="fixed bottom-[70px] left-1/2 -translate-x-1/2 w-64 max-h-80 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[70] overflow-y-auto flex flex-col p-1 scrollbar-hide ring-1 ring-black/5 safe-area-inset-bottom">
                        <div className="px-3 py-2 text-xs font-bold text-muted-foreground border-b border-border/50 mb-1 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                            회차 목록
                        </div>
                        {issues.map((issue) => {
                            const isActive = issue.id === currentIssueId;
                            return (
                                <button
                                    key={issue.id}
                                    onClick={() => {
                                        if (onIssueSelect) onIssueSelect(issue.id);
                                        setIsMobileSelectorOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between shrink-0 ${isActive
                                        ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 font-bold'
                                        : 'text-foreground hover:bg-secondary'
                                        }`}
                                >
                                    <span>{formatEditionLabel(issue.date, issue.edition_name)}</span>
                                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Footer - Full width */}
            <Footer />
        </div>
    );
}
