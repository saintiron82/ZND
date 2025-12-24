﻿'use client';

import React, { useState, useMemo } from 'react';
import ArticleDisplay from '@/components/ArticleDisplay';
import PageFrame from '@/components/PageFrame';
import { RefreshCcw, ArrowRight, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Issue {
    id: string;
    edition_code: string;
    edition_name: string;
    article_count: number;
    published_at: string;
    released_at?: string;
    status: 'preview' | 'released';
    date: string;
}

interface HomePageClientProps {
    articles: any[];
    issues?: Issue[];
}

export default function HomePageClient({ articles, issues = [] }: HomePageClientProps) {
    const router = useRouter();

    // Group by issue + award calculation logic
    const { groupedByIssue, sortedIssueIds } = useMemo(() => {
        const grouped: { [key: string]: { issue: Issue | null; articles: any[] } } = {};

        // Group articles by publish_id (issue)
        articles.forEach((article: any) => {
            const issueId = article.publish_id || 'unknown';

            if (!grouped[issueId]) {
                const matchingIssue = issues.find(i => i.id === issueId) || null;
                grouped[issueId] = {
                    issue: matchingIssue,
                    articles: []
                };
            }
            grouped[issueId].articles.push(article);
        });

        // Calculate awards for each group
        Object.keys(grouped).forEach(issueId => {
            const groupArticles = grouped[issueId].articles;

            // Initialize awards
            groupArticles.forEach(a => { a.awards = []; });

            // Combined Score sorting (Today's Headline)
            const byCombo = [...groupArticles].sort((a, b) => {
                const zeA = a.zero_echo_score ?? a.zeroEchoScore ?? 10;
                const zeB = b.zero_echo_score ?? b.zeroEchoScore ?? 10;
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                const combinedA = (10 - zeA) + isA;
                const combinedB = (10 - zeB) + isB;
                return combinedB - combinedA;
            });

            // ZS sorting (Zero Echo Award - lower is better)
            const byZS = [...groupArticles].sort((a, b) => {
                const zeA = a.zero_echo_score ?? a.zeroEchoScore ?? 10;
                const zeB = b.zero_echo_score ?? b.zeroEchoScore ?? 10;
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                const zsDiff = zeA - zeB;
                if (Math.abs(zsDiff) < 0.01) {
                    return isB - isA; // Tiebreaker: higher IS
                }
                return zsDiff;
            });

            // Impact Score sorting (Hot Topic)
            const byIS = [...groupArticles].sort((a, b) => {
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                return isB - isA;
            });

            // Assign awards
            if (byCombo.length > 0) {
                if (!byCombo[0].awards) byCombo[0].awards = [];
                byCombo[0].awards.push("Today's Headline");
            }
            if (byZS.length > 0) {
                if (!byZS[0].awards) byZS[0].awards = [];
                if (!byZS[0].awards.includes("Zero Echo Award")) {
                    byZS[0].awards.push("Zero Echo Award");
                }
            }
            if (byIS.length > 0) {
                if (!byIS[0].awards) byIS[0].awards = [];
                if (!byIS[0].awards.includes("Hot Topic")) {
                    byIS[0].awards.push("Hot Topic");
                }
            }

            // Sort by awards first
            grouped[issueId].articles = [...groupArticles].sort((a, b) => {
                const aAwards = a.awards?.length ?? 0;
                const bAwards = b.awards?.length ?? 0;
                if (bAwards !== aAwards) return bAwards - aAwards;
                const zeA = a.zero_echo_score ?? a.zeroEchoScore ?? 10;
                const zeB = b.zero_echo_score ?? b.zeroEchoScore ?? 10;
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                const combinedA = (10 - zeA) + isA;
                const combinedB = (10 - zeB) + isB;
                return combinedB - combinedA;
            });
        });

        // Sort issues by edition_code (higher number is latest)
        // edition_code format: YYMMDD_N (e.g. 241224_1, 241224_2)
        const sorted = Object.keys(grouped).sort((a, b) => {
            const issueA = grouped[a].issue;
            const issueB = grouped[b].issue;
            const codeA = issueA?.edition_code || a;
            const codeB = issueB?.edition_code || b;
            return codeB.localeCompare(codeA);
        });

        return { groupedByIssue: grouped, sortedIssueIds: sorted };
    }, [articles, issues]);

    // Current selected issue index (latest issue is default)
    const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Current displayed issue and articles
    const currentIssueId = sortedIssueIds.length > 0 ? sortedIssueIds[currentIssueIndex] : null;
    const currentIssueData = currentIssueId ? groupedByIssue[currentIssueId] : null;
    const currentArticles = currentIssueData?.articles || [];
    const currentIssue = currentIssueData?.issue;

    // Previous/Next issue calculation (for PageFrame navigation)
    const prevIssueId = currentIssueIndex < sortedIssueIds.length - 1 ? sortedIssueIds[currentIssueIndex + 1] : null;
    const nextIssueId = currentIssueIndex > 0 ? sortedIssueIds[currentIssueIndex - 1] : null;
    const prevIssue = prevIssueId ? groupedByIssue[prevIssueId]?.issue : null;
    const nextIssue = nextIssueId ? groupedByIssue[nextIssueId]?.issue : null;

    // Issue change handler
    const handleIssueChange = (issueId: string) => {
        const newIndex = sortedIssueIds.indexOf(issueId);
        if (newIndex !== -1) {
            setCurrentIssueIndex(newIndex);
            setIsDropdownOpen(false);
        }
    };

    // Date-based navigation (for PageFrame)
    const handleDateChange = (target: string) => {
        // Check if target is an issue id
        if (groupedByIssue[target]) {
            handleIssueChange(target);
        }
    };

    const handleRefresh = () => {
        router.refresh();
        window.location.reload();
    };

    return (
        <PageFrame
            currentDate={currentIssue?.date || null}
            editionName={currentIssue?.edition_name || null}
            prevDate={prevIssue?.date || null}
            prevEditionName={prevIssue?.edition_name || null}
            prevIssueId={prevIssueId}
            nextDate={nextIssue?.date || null}
            nextEditionName={nextIssue?.edition_name || null}
            nextIssueId={nextIssueId}
            onDateChange={(target) => {
                // Check if target is issue ID first
                if (sortedIssueIds.includes(target)) {
                    handleIssueChange(target);
                    return;
                }
                // Find issue by date
                const matchingId = sortedIssueIds.find(id => {
                    const issue = groupedByIssue[id]?.issue;
                    return issue?.date === target;
                });
                if (matchingId) handleIssueChange(matchingId);
            }}
            articles={currentArticles}
            issues={sortedIssueIds.map(id => {
                const issue = groupedByIssue[id]?.issue;
                return issue ? {
                    id: issue.id,
                    date: issue.date,
                    edition_name: issue.edition_name,
                    article_count: issue.article_count
                } : null;
            }).filter((issue): issue is { id: string; date: string; edition_name: string; article_count: number } => issue !== null)}
            currentIssueId={currentIssueId}
            onIssueSelect={handleIssueChange}
        >
            {/* Current issue articles display */}
            {currentIssueId && currentArticles.length > 0 ? (
                <ArticleDisplay articles={currentArticles} loading={false} error={null} />
            ) : (
                <div className="text-center py-20 text-muted-foreground">
                    <p className="text-xl">표시할 기사가 없습니다.</p>
                    <p className="text-sm mt-2">발행된 호가 아직 없습니다.</p>
                </div>
            )}
        </PageFrame>
    );
}
