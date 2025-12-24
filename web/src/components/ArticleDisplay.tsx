'use client';

import React from 'react';
import ArticleDisplayDesktop from './ArticleDisplayDesktop';
import ArticleDisplayMobile from './ArticleDisplayMobile';
import { Article } from './ArticleCard';

interface ArticleDisplayProps {
    articles: Article[];
    loading: boolean;
    error: string | null;
    currentDate?: string;
}

export default function ArticleDisplay(props: ArticleDisplayProps) {
    return (
        <>
            {/* Desktop Layout (Hidden on Mobile) */}
            <div className="hidden md:block">
                <ArticleDisplayDesktop {...props} />
            </div>

            {/* Mobile Layout (Hidden on Desktop) */}
            <div className="block md:hidden">
                <ArticleDisplayMobile {...props} />
            </div>
        </>
    );
}
