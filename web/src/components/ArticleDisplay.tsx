﻿'use client';

import React from 'react';
import { Article } from './ArticleCard';
import ArticleDisplayMobile from './ArticleDisplayMobile';
import ArticleDisplayDesktop from './ArticleDisplayDesktop';

interface ArticleDisplayProps {
    articles: Article[];
    loading: boolean;
    error: string | null;
    currentDate?: string;
}

export default function ArticleDisplay(props: ArticleDisplayProps) {
    return (
        <>
            {/* Mobile View (< 768px) */}
            <div className="block md:hidden">
                <ArticleDisplayMobile {...props} />
            </div>

            {/* Desktop View (>= 768px) */}
            <div className="hidden md:block">
                <ArticleDisplayDesktop {...props} />
            </div>
        </>
    );
}
