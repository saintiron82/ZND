'use client';

import React from 'react';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
    currentDate?: string | null;
    editionName?: string | null;  // 회차명 (예: "1호", "2호")
}

export default function Header({ currentDate, editionName }: HeaderProps) {
    // 날짜 포맷팅 함수
    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const weekday = weekdays[localDate.getDay()];
        return `${year}년 ${month}월 ${day}일 ${weekday}`;
    };

    // 회차 표시 (edition_name이 "1호" 형태면 "제 1호"로 변환)
    const formatEdition = (name: string) => {
        if (name.endsWith('호')) {
            const num = name.replace('호', '');
            return `제 ${num}호`;
        }
        return name;
    };

    return (
        <header
            className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b border-border/40 shadow-sm transition-all duration-300 ease-in-out"
        >
            {/* 테마 토글 버튼 - 우측 상단 고정 */}
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>

            <div className="flex flex-col items-center max-w-7xl mx-auto">
                <h1 className="font-black tracking-tighter text-foreground font-sans leading-none flex items-baseline gap-2 md:gap-4 justify-center text-4xl md:text-6xl">
                    ZeroEcho<span className="text-primary">.</span>
                    <span className="font-light italic text-muted-foreground tracking-normal font-serif text-2xl md:text-4xl">Daily</span>
                </h1>

                <div className="flex flex-col items-center mt-2">
                    <p className="text-sm font-bold tracking-[0.1em] text-muted-foreground font-sans">
                        {editionName && <span className="text-primary">{formatEdition(editionName)}</span>}
                        {editionName && currentDate && <span className="mx-2">•</span>}
                        {currentDate ? formatDate(currentDate) : 'Loading...'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-sans">
                        Curated Global AI Insights • Published Daily
                    </p>
                </div>
            </div>
        </header>
    );
}
