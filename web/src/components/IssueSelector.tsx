'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronDown, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface IssueItem {
    id: string;
    date: string;
    edition_name: string;
    article_count: number;
}

interface IssueSelectorProps {
    issues: IssueItem[];
    currentIssueId: string | null;
    onIssueSelect: (issueId: string) => void;
}

// 날짜 포맷 유틸리티 ("12월 21일" 형식)
const formatDateKo = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${month}월 ${day}일`;
};

const INITIAL_ITEMS = 10;  // 초기 표시 개수
const LOAD_MORE_COUNT = 10; // 추가 로드 개수

export default function IssueSelector({ issues, currentIssueId, onIssueSelect }: IssueSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(INITIAL_ITEMS);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const currentIssue = issues.find(i => i.id === currentIssueId);
    const displayIssues = issues.slice(0, visibleCount);
    const hasMore = visibleCount < issues.length;

    // 드롭다운 열릴 때 초기화
    useEffect(() => {
        if (isOpen) {
            setVisibleCount(INITIAL_ITEMS);
        }
    }, [isOpen]);

    // 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 스크롤 이벤트 핸들러 (무한 스크롤)
    const handleScroll = useCallback(() => {
        if (!listRef.current || isLoadingMore || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        const scrollThreshold = 50; // 하단 50px 전에 로드 시작

        if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
            setIsLoadingMore(true);
            // 약간의 딜레이로 부드러운 로딩 효과
            setTimeout(() => {
                setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, issues.length));
                setIsLoadingMore(false);
            }, 200);
        }
    }, [isLoadingMore, hasMore, issues.length]);

    if (issues.length === 0) {
        return (
            <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-bold text-foreground">회차 선택</span>
                </div>
                <p className="text-xs text-muted-foreground text-center py-2 mt-2">
                    발행된 회차가 없습니다.
                </p>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="relative bg-card rounded-xl border border-border p-4">
            {/* 드롭다운 트리거 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 hover:bg-secondary/50 rounded-lg p-2 -m-2 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-bold text-foreground">
                            {currentIssue ? formatDateKo(currentIssue.date) : '회차 선택'}
                        </span>
                        {currentIssue && (
                            <span className="text-[10px] text-muted-foreground">
                                {currentIssue.edition_name}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {/* 드롭다운 메뉴 (무한 스크롤) */}
            {isOpen && (
                <div
                    ref={listRef}
                    onScroll={handleScroll}
                    className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
                >
                    {/* 최신호 바로가기 */}
                    {issues.length > 0 && issues[0].id !== currentIssueId && (
                        <button
                            onClick={() => {
                                onIssueSelect(issues[0].id);
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between py-2.5 px-3 transition-colors text-left rounded-t-lg bg-gradient-to-r from-teal-50 to-transparent dark:from-teal-950/50 dark:to-transparent hover:from-teal-100 dark:hover:from-teal-950/70 border-b border-border/50"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-base">⚡</span>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
                                        최신호로 이동
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatDateKo(issues[0].date)} • {issues[0].edition_name}
                                    </span>
                                </div>
                            </div>
                        </button>
                    )}

                    {displayIssues.map((issue) => {
                        const isActive = issue.id === currentIssueId;
                        return (
                            <button
                                key={issue.id}
                                onClick={() => {
                                    onIssueSelect(issue.id);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between py-2.5 px-3 transition-colors text-left",
                                    "first:rounded-t-lg",
                                    !hasMore && "last:rounded-b-lg",
                                    isActive
                                        ? "bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400"
                                        : "hover:bg-secondary/50 text-foreground"
                                )}
                            >
                                <div className="flex flex-col">
                                    <span className={cn(
                                        "text-sm",
                                        isActive ? "font-bold" : "font-medium"
                                    )}>
                                        {formatDateKo(issue.date)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {issue.edition_name} • {issue.article_count}건
                                    </span>
                                </div>
                                {isActive && (
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                )}
                            </button>
                        );
                    })}

                    {/* 로딩 인디케이터 */}
                    {hasMore && (
                        <div className="flex items-center justify-center py-3 text-muted-foreground">
                            {isLoadingMore ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <span className="text-xs">↓ 스크롤하여 더 보기</span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
