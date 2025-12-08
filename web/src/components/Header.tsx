'use client';

import React from 'react';

export default function Header({ currentDate }: { currentDate?: string | null }) {
    return (
        <header className="mb-10 max-w-7xl mx-auto border-b-4 border-double border-foreground pb-6 text-center pt-8">
            <div className="flex flex-col items-center mb-6">
                <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-foreground font-sans leading-none flex items-baseline gap-2 md:gap-4 justify-center">
                    ZeroNoise<span className="text-primary">.</span>
                    <span className="text-3xl md:text-5xl font-light italic text-muted-foreground tracking-normal font-serif">Daily</span>
                </h1>
                <div className="mt-4 flex flex-col items-center">
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
