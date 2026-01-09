'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CategoryNav() {
    const pathname = usePathname();

    const tabs = [
        { id: 'news', label: 'NEWS', href: '/' },
        { id: 'reports', label: 'REPORTS', href: '/reports' },
    ];

    const isActive = (href: string) => {
        const path = pathname || '';
        if (href === '/') return path === '/';
        return path.startsWith(href);
    };

    return (
        <nav className="w-full">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <ul className="flex items-center justify-center gap-8">
                    {tabs.map((tab) => {
                        const active = isActive(tab.href);
                        return (
                            <li key={tab.id} className="relative">
                                <Link
                                    href={tab.href}
                                    className={`text-sm font-bold tracking-widest transition-colors font-sans py-3 block ${active
                                        ? 'text-teal-600 dark:text-teal-400'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {tab.label}
                                </Link>
                                {active && (
                                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-teal-500 rounded-full" />
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </nav>
    );
}
