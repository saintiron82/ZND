'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

// 클라이언트 ID 생성 (익명 식별자)
function getClientId(): string {
    if (typeof window === 'undefined') return '';

    let clientId = localStorage.getItem('znd_client_id');
    if (!clientId) {
        clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('znd_client_id', clientId);
    }
    return clientId;
}

// 투표 기록 로컬 저장 (중복 방지용)
function hasVotedLocally(articleId: string, date: string): boolean {
    if (typeof window === 'undefined') return false;
    const key = `znd_vote_${date}_${articleId}`;
    return localStorage.getItem(key) !== null;
}

function markVotedLocally(articleId: string, date: string, vote: string): void {
    if (typeof window === 'undefined') return;
    const key = `znd_vote_${date}_${articleId}`;
    localStorage.setItem(key, vote);
}

function getLocalVote(articleId: string, date: string): string | null {
    if (typeof window === 'undefined') return null;
    const key = `znd_vote_${date}_${articleId}`;
    return localStorage.getItem(key);
}

interface ZSFeedbackButtonsProps {
    articleId: string;
    date: string;
    showStats?: boolean;  // 동의 지수 표시 여부 (기본: false)
    size?: 'sm' | 'md';   // 버튼 크기
    className?: string;
}

interface VoteStats {
    lower: number;
    agree: number;
    higher: number;
    totalVotes: number;
}

export default function ZSFeedbackButtons({
    articleId,
    date,
    showStats = false,
    size = 'sm',
    className = '',
}: ZSFeedbackButtonsProps) {
    const [userVote, setUserVote] = useState<string | null>(null);
    const [stats, setStats] = useState<VoteStats | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    // 마운트 시 로컬 투표 기록 확인
    useEffect(() => {
        setMounted(true);
        const localVote = getLocalVote(articleId, date);
        if (localVote) {
            setUserVote(localVote);
        }
    }, [articleId, date]);

    // 통계 조회 (showStats가 true일 때만)
    useEffect(() => {
        if (showStats && mounted) {
            fetchStats();
        }
    }, [showStats, mounted, articleId, date]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`/api/feedback?date=${date}&articleId=${articleId}`);
            const data = await res.json();
            if (data.success && data.aggregate) {
                setStats(data.aggregate.votes);
            }
        } catch (error) {
            console.error('Failed to fetch feedback stats:', error);
        }
    };

    const handleVote = useCallback(async (vote: 'lower' | 'agree' | 'higher') => {
        if (userVote || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const clientId = getClientId();
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    articleId,
                    date,
                    vote,
                    clientId,
                }),
            });

            const data = await res.json();

            if (data.success || data.alreadyVoted) {
                setUserVote(vote);
                markVotedLocally(articleId, date, vote);

                if (data.aggregate) {
                    setStats(data.aggregate.votes);
                }
            }
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        } finally {
            setIsSubmitting(false);
        }
    }, [articleId, date, userVote, isSubmitting]);

    // SSR 대응
    if (!mounted) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                <div className="w-6 h-6 bg-muted/30 rounded animate-pulse" />
                <div className="w-6 h-6 bg-muted/30 rounded animate-pulse" />
            </div>
        );
    }

    const buttonBase = size === 'sm'
        ? 'w-6 h-6 text-xs'
        : 'w-8 h-8 text-sm';

    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

    // 동의율 계산
    const agreeRate = stats && stats.totalVotes > 0
        ? Math.round(((stats.agree + 0) / stats.totalVotes) * 100)
        : null;

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            {/* 더 낮아야 버튼 */}
            <button
                onClick={() => handleVote('lower')}
                disabled={!!userVote || isSubmitting}
                title="ZS가 더 낮아야 해요 (품질이 낮음)"
                className={`
          ${buttonBase} rounded flex items-center justify-center transition-all
          ${userVote === 'lower'
                        ? 'bg-red-500/20 text-red-500 ring-1 ring-red-500/50'
                        : userVote
                            ? 'bg-muted/20 text-muted-foreground/30 cursor-not-allowed'
                            : 'bg-muted/30 text-muted-foreground hover:bg-red-500/20 hover:text-red-500'
                    }
        `}
            >
                <ChevronDown className={iconSize} />
            </button>

            {/* 동의 버튼 (선택적) */}
            <button
                onClick={() => handleVote('agree')}
                disabled={!!userVote || isSubmitting}
                title="ZS 점수에 동의해요"
                className={`
          ${buttonBase} rounded flex items-center justify-center transition-all
          ${userVote === 'agree'
                        ? 'bg-green-500/20 text-green-500 ring-1 ring-green-500/50'
                        : userVote
                            ? 'bg-muted/20 text-muted-foreground/30 cursor-not-allowed'
                            : 'bg-muted/30 text-muted-foreground hover:bg-green-500/20 hover:text-green-500'
                    }
        `}
            >
                <Check className={iconSize} />
            </button>

            {/* 더 높아야 버튼 */}
            <button
                onClick={() => handleVote('higher')}
                disabled={!!userVote || isSubmitting}
                title="ZS가 더 높아야 해요 (품질이 높음)"
                className={`
          ${buttonBase} rounded flex items-center justify-center transition-all
          ${userVote === 'higher'
                        ? 'bg-blue-500/20 text-blue-500 ring-1 ring-blue-500/50'
                        : userVote
                            ? 'bg-muted/20 text-muted-foreground/30 cursor-not-allowed'
                            : 'bg-muted/30 text-muted-foreground hover:bg-blue-500/20 hover:text-blue-500'
                    }
        `}
            >
                <ChevronUp className={iconSize} />
            </button>

            {/* 통계 표시 (선택적) */}
            {showStats && stats && stats.totalVotes > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                    {agreeRate}% 동의
                </span>
            )}
        </div>
    );
}
