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
                <button
                    onClick={() => prevDate && onDateChange(prevDate)}
                    disabled={!prevDate}
                    className="fixed left-8 top-32 flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors group z-50"
                    title="Previous Edition"
                >
                    <ChevronLeft className="w-8 h-8" />
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {prevDate ? new Date(prevDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : 'PREV'}
                    </span>
                </button>
                <button
                    onClick={() => nextDate && onDateChange(nextDate)}
                    disabled={!nextDate}
                    className="fixed right-8 top-32 flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors group z-50"
                    title="Next Edition"
                >
                    <ChevronRight className="w-8 h-8" />
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {nextDate ? new Date(nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : 'NEXT'}
                    </span>
                </button>
            </div>

            <div className="relative max-w-7xl mx-auto">
                <Header currentDate={currentDate} />

                {/* Mobile: Simple row below header */}
                <div className="md:hidden flex justify-between items-center mb-6 px-2">
                    <button
                        onClick={() => prevDate && onDateChange(prevDate)}
                        disabled={!prevDate}
                        className="flex items-center gap-1 text-sm font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                        <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <button
                        onClick={() => nextDate && onDateChange(nextDate)}
                        disabled={!nextDate}
                        className="flex items-center gap-1 text-sm font-bold uppercase text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                        Next <ChevronRight className="w-4 h-4" />
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
