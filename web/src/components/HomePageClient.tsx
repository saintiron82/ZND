'use client';

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

    // 회차별 그룹핑 로직 + 그룹별 어워드 재계산
    const { groupedByIssue, sortedIssueIds } = useMemo(() => {
        const grouped: { [key: string]: { issue: Issue | null; articles: any[] } } = {};

        // 기사를 publish_id(회차)별로 그룹핑
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

        // 각 그룹별로 어워드 재계산
        Object.keys(grouped).forEach(issueId => {
            const groupArticles = grouped[issueId].articles;

            // 기존 어워드 초기화
            groupArticles.forEach(a => { a.awards = []; });

            // Combined Score 기준 정렬 (Today's Headline)
            const byCombo = [...groupArticles].sort((a, b) => {
                const zeA = a.zero_echo_score ?? a.zeroEchoScore ?? 10;
                const zeB = b.zero_echo_score ?? b.zeroEchoScore ?? 10;
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                const combinedA = (10 - zeA) + isA;
                const combinedB = (10 - zeB) + isB;
                return combinedB - combinedA;
            });

            // ZS 기준 정렬 (Zero Noise Award - 낮을수록 좋음)
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

            // Impact Score 기준 정렬 (Hot Topic)
            const byIS = [...groupArticles].sort((a, b) => {
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                return isB - isA;
            });

            // 어워드 할당
            if (byCombo.length > 0) {
                if (!byCombo[0].awards) byCombo[0].awards = [];
                byCombo[0].awards.push("Today's Headline");
            }
            if (byZS.length > 0) {
                if (!byZS[0].awards) byZS[0].awards = [];
                if (!byZS[0].awards.includes("Zero Noise Award")) {
                    byZS[0].awards.push("Zero Noise Award");
                }
            }
            if (byIS.length > 0) {
                if (!byIS[0].awards) byIS[0].awards = [];
                if (!byIS[0].awards.includes("Hot Topic")) {
                    byIS[0].awards.push("Hot Topic");
                }
            }

            // 어워드 순으로 정렬
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

        // 회차를 released_at 또는 published_at 기준으로 정렬 (최신순)
        const sorted = Object.keys(grouped).sort((a, b) => {
            const issueA = grouped[a].issue;
            const issueB = grouped[b].issue;
            const dateA = issueA?.released_at || issueA?.published_at || '';
            const dateB = issueB?.released_at || issueB?.published_at || '';
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        return { groupedByIssue: grouped, sortedIssueIds: sorted };
    }, [articles, issues]);

    // 현재 선택된 회차 인덱스 (가장 최신 회차가 기본)
    const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // 현재 표시할 회차 및 기사
    const currentIssueId = sortedIssueIds.length > 0 ? sortedIssueIds[currentIssueIndex] : null;
    const currentIssueData = currentIssueId ? groupedByIssue[currentIssueId] : null;
    const currentArticles = currentIssueData?.articles || [];
    const currentIssue = currentIssueData?.issue;

    // 이전/다음 회차 계산 (PageFrame 호환용)
    const prevIssueId = currentIssueIndex < sortedIssueIds.length - 1 ? sortedIssueIds[currentIssueIndex + 1] : null;
    const nextIssueId = currentIssueIndex > 0 ? sortedIssueIds[currentIssueIndex - 1] : null;
    const prevIssue = prevIssueId ? groupedByIssue[prevIssueId]?.issue : null;
    const nextIssue = nextIssueId ? groupedByIssue[nextIssueId]?.issue : null;

    // 회차 변경 핸들러
    const handleIssueChange = (issueId: string) => {
        const newIndex = sortedIssueIds.indexOf(issueId);
        if (newIndex !== -1) {
            setCurrentIssueIndex(newIndex);
            setIsDropdownOpen(false);
        }
    };

    // 날짜 기반 변경 (PageFrame 호환용)
    const handleDateChange = (target: string) => {
        // target이 issue id인지 확인하고 처리
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
            nextDate={nextIssue?.date || null}
            nextEditionName={nextIssue?.edition_name || null}
            onDateChange={(target) => {
                // date로 매칭된 issue 찾기
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
            {/* 회차 선택은 사이드바로 이동됨 */}

            {/* 현재 회차의 기사 표시 */}
            {currentIssueId && currentArticles.length > 0 ? (
                <ArticleDisplay articles={currentArticles} loading={false} error={null} />
            ) : (
                <div className="text-center py-20 text-muted-foreground">
                    <p className="text-xl">표시할 기사가 없습니다.</p>
                    <p className="text-sm mt-2">발행된 회차가 아직 없습니다.</p>
                </div>
            )}
        </PageFrame>
    );
}
