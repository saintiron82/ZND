'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import CategoryNav from './CategoryNav';

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
            className="relative md:sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b border-border/40 shadow-sm transition-all duration-300 ease-in-out"
        >
            {/* 좌측 상단 로고 - 모바일에서는 숨김 (타이틀과 겹침 방지) */}
            <Link href="/" className="hidden md:block absolute left-4 top-2">
                <Image
                    src="/logo.png"
                    alt="ZED"
                    width={160}
                    height={160}
                    className="object-contain"
                    style={{ width: 'auto', height: 'auto', maxHeight: '100px' }}
                    priority
                />
            </Link>

            {/* 테마 토글 버튼 - 우측 상단 고정 */}
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>

            <div className="flex flex-col items-center max-w-7xl mx-auto">
                <h1 className="font-black tracking-tighter text-foreground font-sans leading-none flex items-center gap-1 md:gap-2 justify-center text-4xl md:text-6xl">
                    ZeroEcho
                    <span className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-teal-500 inline-flex self-end mb-1 md:mb-2"></span>
                    <span className="font-light italic text-muted-foreground tracking-normal font-serif text-2xl md:text-4xl">Daily</span>
                </h1>

                <div className="flex flex-col items-center mt-2">
                    <p className="text-sm font-bold tracking-[0.1em] text-muted-foreground font-sans">
                        {editionName && <span className="text-teal-600 dark:text-teal-400">{formatEdition(editionName)}</span>}
                        {editionName && currentDate && <span className="mx-2">•</span>}
                        {currentDate ? formatDate(currentDate) : 'Loading...'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-sans relative group/slogan cursor-help inline-flex items-center gap-1">
                        Pure Signal, Zero Echo
                        <span className="text-teal-500/60 hover:text-teal-500 transition-colors">?</span>
                        {/* What ZS? 통합 설명 툴팁 */}
                        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-4 py-3 bg-white/95 dark:bg-zinc-900/95 text-foreground text-[11px] font-normal normal-case tracking-normal rounded-xl shadow-2xl border border-border w-64 opacity-0 invisible group-hover/slogan:opacity-100 group-hover/slogan:visible transition-all duration-200 z-[100] text-center leading-relaxed">
                            <span className="font-bold text-teal-600 dark:text-teal-400 block mb-1">What&apos;s ZS (Zero Score)?</span>
                            기사의 노이즈 억제 점수입니다.<br />
                            <span className="text-emerald-500 font-semibold">낮을수록</span> 기존 미디어에서 반복되지 않은<br />
                            <span className="text-teal-600 dark:text-teal-400 font-semibold">신선하고 독창적인 정보</span>예요 ✨
                            <span className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white dark:border-b-zinc-900"></span>
                        </span>
                    </p>
                </div>

                {/* Category Navigation inside Header Frame */}
                <div className="mt-3 pt-2 border-t border-border/40">
                    <CategoryNav />
                </div>
            </div>
        </header>
    );
}
