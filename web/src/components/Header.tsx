'use client';

import React, { useEffect, useState } from 'react';

export default function Header({ currentDate }: { currentDate?: string | null }) {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header
            className={`
                sticky top-0 z-50 w-full transition-all duration-300 ease-in-out
                ${isScrolled
                    ? 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 border-b border-border/40 shadow-sm'
                    : 'bg-background mb-10 py-8 border-b-4 border-double border-foreground pb-6'
                }
            `}
        >
            <div className={`flex flex-col items-center transition-all duration-300 max-w-7xl mx-auto ${isScrolled ? 'mb-0' : 'mb-6'}`}>
                <h1 className={`
                    font-black tracking-tighter text-foreground font-sans leading-none flex items-baseline gap-2 md:gap-4 justify-center transition-all duration-300
                    ${isScrolled ? 'text-3xl md:text-5xl' : 'text-6xl md:text-9xl'}
                `}>
                    ZeroNoise<span className="text-primary">.</span>
                    <span className={`
                        font-light italic text-muted-foreground tracking-normal font-serif transition-all duration-300
                        ${isScrolled ? 'text-xl md:text-2xl' : 'text-3xl md:text-5xl'}
                    `}>Daily</span>
                </h1>

                <div className={`
                    flex flex-col items-center overflow-hidden transition-all duration-300
                    ${isScrolled ? 'h-0 opacity-0 mt-0' : 'h-16 opacity-100 mt-4'}
                `}>
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
