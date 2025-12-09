import React from 'react';
import Header from './Header';
import CategoryNav from './CategoryNav';
import Footer from './Footer';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PageFrameProps {
    children: React.ReactNode;
    currentDate: string | null;
    prevDate: string | null;
    nextDate: string | null;
    onDateChange: (date: string) => void;
}

export default function PageFrame({
    children,
    currentDate,
    prevDate,
    nextDate,
    onDateChange
}: PageFrameProps) {
    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 relative">
            {/* Navigation Buttons - Positioned relative to the viewport/frame for better visibility */}
            {/* Desktop: Fixed positioning to ensure they are always visible on the sides */}
            <div className="hidden md:block">
                {(() => {
                    const formatEdition = (dateStr: string) => {
                        const date = new Date(dateStr);
                        const yy = date.getFullYear().toString().slice(-2);
                        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
                        const dd = date.getDate().toString().padStart(2, '0');
                        const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                        return `${yy}${mm}${dd}_${day}_1`;
                    };

                    return (
                        <>
                            {prevDate && (
                                <button
                                    onClick={() => onDateChange(prevDate)}
                                    className="fixed left-8 top-32 flex flex-col items-center gap-2 p-3 text-foreground transition-all z-[60] rounded-lg group opacity-40 hover:opacity-100 hover:bg-background/80 hover:backdrop-blur-sm hover:border hover:border-border hover:shadow-sm"
                                >
                                    <ChevronLeft className="w-10 h-10" />
                                    <span className="text-sm font-black tracking-widest uppercase whitespace-nowrap max-h-0 opacity-0 overflow-hidden group-hover:max-h-10 group-hover:opacity-100 transition-all duration-300">
                                        {formatEdition(prevDate)}
                                    </span>
                                </button>
                            )}
                            {nextDate && (
                                <button
                                    onClick={() => onDateChange(nextDate)}
                                    className="fixed right-8 top-32 flex flex-col items-center gap-2 p-3 text-foreground transition-all z-[60] rounded-lg group opacity-40 hover:opacity-100 hover:bg-background/80 hover:backdrop-blur-sm hover:border hover:border-border hover:shadow-sm"
                                >
                                    <ChevronRight className="w-10 h-10" />
                                    <span className="text-sm font-black tracking-widest uppercase whitespace-nowrap max-h-0 opacity-0 overflow-hidden group-hover:max-h-10 group-hover:opacity-100 transition-all duration-300">
                                        {formatEdition(nextDate)}
                                    </span>
                                </button>
                            )}
                        </>
                    );
                })()}
            </div>

            <Header currentDate={currentDate} />

            <div className="relative max-w-7xl mx-auto">

                {/* Mobile: Simple row below header */}
                <div className="md:hidden flex justify-between items-center mb-6 px-2">
                    <button
                        onClick={() => prevDate && onDateChange(prevDate)}
                        disabled={!prevDate}
                        className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {prevDate ? (() => {
                            const date = new Date(prevDate);
                            const yy = date.getFullYear().toString().slice(-2);
                            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
                            const dd = date.getDate().toString().padStart(2, '0');
                            const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                            return `${yy}${mm}${dd}_${day}_1`;
                        })() : 'PREV'}
                    </button>
                    <button
                        onClick={() => nextDate && onDateChange(nextDate)}
                        disabled={!nextDate}
                        className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                        {nextDate ? (() => {
                            const date = new Date(nextDate);
                            const yy = date.getFullYear().toString().slice(-2);
                            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
                            const dd = date.getDate().toString().padStart(2, '0');
                            const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                            return `${yy}${mm}${dd}_${day}_1`;
                        })() : 'NEXT'}
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <CategoryNav />
            </div>

            <main className="max-w-7xl mx-auto w-full px-4 md:px-8">
                {children}
            </main>

            <Footer />
        </div>
    );
}
