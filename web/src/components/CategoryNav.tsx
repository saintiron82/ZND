'use client';

import React from 'react';
import Link from 'next/link';

const categories = [
    { id: 'all', label: 'All News', href: '/' },
    { id: 'politics', label: 'Politics', href: '/?category=politics' },
    { id: 'economy', label: 'Economy', href: '/?category=economy' },
    { id: 'tech', label: 'Technology', href: '/?category=tech' },
    { id: 'culture', label: 'Culture', href: '/?category=culture' },
    { id: 'opinion', label: 'Opinion', href: '/?category=opinion' },
];

export default function CategoryNav() {
    return (
        <nav className="w-full border-b border-border mb-8">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <ul className="flex items-center justify-center gap-6 md:gap-10 overflow-x-auto py-4 no-scrollbar">
                    {categories.map((category) => (
                        <li key={category.id} className="shrink-0">
                            <Link
                                href={category.href}
                                className="text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-sans"
                            >
                                {category.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}
