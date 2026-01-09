'use client';

import React, { useState, useEffect, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import { Sparkles } from 'lucide-react';
import CategoryNav from './CategoryNav';
import version from '../../package.json';

import Link from 'next/link';

interface HeaderProps {
    currentDate?: string | null;
    editionName?: string | null;
}

export default function Header({ currentDate, editionName }: HeaderProps) {
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const helpRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 및 스크롤 감지하여 툴팁 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (helpRef.current && !helpRef.current.contains(event.target as Node)) {
                setIsHelpOpen(false);
            }
        };

        const handleScroll = () => {
            if (isHelpOpen) {
                setIsHelpOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside); // 모바일 터치 대응
        window.addEventListener('scroll', handleScroll);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isHelpOpen]);

    // 날짜 포맷팅 함수
    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const weekday = weekdays[localDate.getDay()];
        return `${year}년 ${month}월 ${day}일 ${weekday}`;
    };

    // 회차 표시
    const formatEdition = (name: string) => name;

    const toggleHelp = (e: React.MouseEvent) => {
        e.stopPropagation(); // 버블링 방지
        setIsHelpOpen(!isHelpOpen);
    };

    return (
        <header
            className="relative md:sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-border/40 shadow-sm transition-all duration-300 ease-in-out"
        >
            {/* 상단 섹션 (로고, 날짜, 슬로건) - 하단 보더라인 포함 */}
            <div className="pt-4 pb-2 border-b border-border/40 relative">
                {/* 테마 토글 버튼 - 우측 상단 */}
                <div className="absolute right-4 top-4">
                    <ThemeToggle />
                </div>

                <div className="flex flex-col items-center max-w-7xl mx-auto">
                    <h1 className="font-black tracking-tighter text-foreground font-sans leading-none flex items-center gap-1 md:gap-2 justify-center text-4xl md:text-6xl cursor-pointer hover:opacity-80 transition-opacity">
                        <Link href="/" className="flex items-center gap-1 md:gap-2">
                            <span className="text-teal-500">Z</span>eroEcho
                            <span className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-teal-500 inline-flex self-end mb-1 md:mb-2"></span>
                            <span className="font-light italic text-muted-foreground tracking-normal font-serif text-2xl md:text-4xl">Daily</span>
                            <span className="ml-2 text-xs text-muted-foreground font-mono self-end mb-1">v{version.version}</span>
                            {process.env.NEXT_PUBLIC_ZND_ENV === 'dev' && (
                                <span className="ml-2 text-xs md:text-lg text-teal-500 font-bold border border-teal-500 rounded px-1 self-start mt-1 select-none">
                                    dev
                                </span>
                            )}
                        </Link>
                    </h1>

                    <div className="flex flex-col items-center mt-2">
                        <p className="text-sm font-bold tracking-[0.1em] text-muted-foreground font-sans">
                            {editionName && <span className="text-teal-600 dark:text-teal-400">{formatEdition(editionName)}</span>}
                            {editionName && currentDate && <span className="mx-2">•</span>}
                            {currentDate ? formatDate(currentDate) : '불러오는 중...'}
                        </p>
                        <div className="relative mt-1 flex items-center gap-1.5" ref={helpRef}>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-sans">
                                Pure Signal, Zero Echo
                            </p>
                            <button
                                onClick={toggleHelp}
                                className={`flex items-center justify-center rounded-full p-1 transition-all duration-300 focus:outline-none shadow-sm ${isHelpOpen
                                    ? 'bg-teal-600 text-white ring-2 ring-teal-200 dark:ring-teal-800 scale-110'
                                    : 'bg-teal-500 text-white hover:bg-teal-600 hover:scale-105 hover:shadow-md animate-[pulse_3s_ease-in-out_infinite]'
                                    }`}
                                aria-label="What is ZS?"
                            >
                                <Sparkles className="w-3 h-3" strokeWidth={3} />
                            </button>

                            {/* What ZS? 통합 설명 툴팁 */}
                            <div
                                className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 px-4 py-3 bg-white/95 dark:bg-zinc-900/95 text-foreground text-[11px] font-normal normal-case tracking-normal rounded-xl shadow-2xl border border-border w-64 text-center leading-relaxed z-[100] transition-all duration-200 ${isHelpOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                                    }`}
                            >
                                <span className="font-bold text-teal-600 dark:text-teal-400 block mb-1">What&apos;s ZS (Zero Score)?</span>
                                기사의 노이즈 억제 점수입니다.<br />
                                <span className="text-emerald-500 font-semibold">낮을수록</span> 기존 미디어에서 반복되지 않은<br />
                                <span className="text-teal-600 dark:text-teal-400 font-semibold">신선하고 독창적인 정보</span>예요 ✨
                                <span className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white dark:border-b-zinc-900"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 네비게이션 탭 (언더라인 아래 위치) */}
            <div className="border-b border-border/40">
                <CategoryNav />
            </div>
        </header>
    );
}
