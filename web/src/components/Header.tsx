'use client';

import React from 'react';

export default function Header({ currentDate }: { currentDate?: string | null }) {
    return (
        <header
            className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b border-border/40 shadow-sm transition-all duration-300 ease-in-out"
        >
            <div className="flex flex-col items-center max-w-7xl mx-auto">
                <h1 className="font-black tracking-tighter text-foreground font-sans leading-none flex items-baseline gap-2 md:gap-4 justify-center text-4xl md:text-6xl">
                    ZeroNoise<span className="text-primary">.</span>
                    <span className="font-light italic text-muted-foreground tracking-normal font-serif text-2xl md:text-4xl">Daily</span>
                </h1>

                <div className="flex flex-col items-center mt-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground font-sans">
                        {currentDate ? new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading...'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-sans">
                        Vol. 1 • Curated Global Insights
                    </p>
                </div>
            </div>
        </header>
    );
}
