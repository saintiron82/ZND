
'use client';

import React, { useState, useMemo } from 'react';
import ArticleDisplay from '@/components/ArticleDisplay';
import PageFrame from '@/components/PageFrame';
import { useDatePolling } from '@/hooks/useDatePolling';
import { RefreshCcw, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HomePageClientProps {
    articles: any[];
    isPreview?: boolean;
}

export default function HomePageClient({ articles, isPreview = false }: HomePageClientProps) {
    const router = useRouter();

    // 날짜별 그룹핑 로직 (발행일 기준) + 그룹별 어워드 재계산
    const { groupedArticles, sortedDates } = useMemo(() => {
        const grouped: { [key: string]: any[] } = {};
        articles.forEach((article: any) => {
            let dateStr = '';
            let dateObj: Date | null = null;

            // 발행일(published_at) 기준으로 그룹핑
            if (typeof article.published_at === 'string') {
                dateObj = new Date(article.published_at);
            } else if (article.published_at && typeof article.published_at === 'object' && 'seconds' in article.published_at) {
                dateObj = new Date(article.published_at.seconds * 1000);
            }
            // fallback: published_at이 없으면 crawled_at 사용
            else if (typeof article.crawled_at === 'string') {
                dateObj = new Date(article.crawled_at);
            } else if (article.crawled_at && typeof article.crawled_at === 'object' && 'seconds' in article.crawled_at) {
                dateObj = new Date(article.crawled_at.seconds * 1000);
            }

            if (dateObj && !isNaN(dateObj.getTime())) {
                // 로컬 시간 기준으로 YYYY-MM-DD 형식 추출
                const year = dateObj.getFullYear();
                const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                const day = dateObj.getDate().toString().padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
            }

            if (dateStr) {
                if (!grouped[dateStr]) {
                    grouped[dateStr] = [];
                }
                grouped[dateStr].push(article);
            }
        });

        // 각 그룹별로 어워드 재계산 (published_at 기준 그룹에서 어워드 결정)
        Object.keys(grouped).forEach(dateKey => {
            const groupArticles = grouped[dateKey];

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

            // 어워드 순으로 정렬하여 그룹에 다시 할당
            grouped[dateKey] = [...groupArticles].sort((a, b) => {
                const aAwards = a.awards?.length ?? 0;
                const bAwards = b.awards?.length ?? 0;
                if (bAwards !== aAwards) return bAwards - aAwards;
                // 어워드 개수가 같으면 Combined Score 순
                const zeA = a.zero_echo_score ?? a.zeroEchoScore ?? 10;
                const zeB = b.zero_echo_score ?? b.zeroEchoScore ?? 10;
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                const combinedA = (10 - zeA) + isA;
                const combinedB = (10 - zeB) + isB;
                return combinedB - combinedA;
            });
        });

        const sorted = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        return { groupedArticles: grouped, sortedDates: sorted };
    }, [articles]);

    // 현재 선택된 날짜 인덱스 (가장 최신 날짜가 기본)
    const [currentDateIndex, setCurrentDateIndex] = useState(0);

    // 현재 표시할 날짜 및 기사
    const currentDate = sortedDates.length > 0 ? sortedDates[currentDateIndex] : null;
    const currentArticles = currentDate ? groupedArticles[currentDate] : [];

    // 이전/다음 날짜 계산
    const prevDate = currentDateIndex < sortedDates.length - 1 ? sortedDates[currentDateIndex + 1] : null;
    const nextDate = currentDateIndex > 0 ? sortedDates[currentDateIndex - 1] : null;

    // 날짜 변경 핸들러
    const handleDateChange = (targetDate: string) => {
        const newIndex = sortedDates.indexOf(targetDate);
        if (newIndex !== -1) {
            setCurrentDateIndex(newIndex);
        }
    };

    // 1분(60초)마다 폴링하여 새 데이터 확인
    const latestDate = sortedDates.length > 0 ? sortedDates[0] : null;
    const { hasNewDate, serverLatestDate } = useDatePolling(latestDate, 60000);

    const handleRefresh = () => {
        router.refresh();
        window.location.reload();
    };

    return (
        <PageFrame
            currentDate={currentDate}
            prevDate={prevDate}
            nextDate={nextDate}
            onDateChange={handleDateChange}
            articles={currentArticles}
        >

            {/* 새 데이터 알림 배너 (Alert Banner) */}
            {hasNewDate && (
                <div
                    onClick={handleRefresh}
                    className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] cursor-pointer animate-in fade-in slide-in-from-top-4 duration-500"
                >
                    <div className="bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-xl flex items-center gap-3 hover:scale-105 transition-transform font-bold border border-primary/20 backdrop-blur-md">
                        <RefreshCcw className="w-4 h-4 animate-spin-slow" />
                        <span>New Edition Available ({serverLatestDate})</span>
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            )}

            {/* Preview 모드 배너 */}
            {isPreview && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]">
                    <div className="bg-amber-500 text-black px-6 py-2 rounded-full shadow-xl flex items-center gap-2 font-bold">
                        <span>🔒 PREVIEW MODE</span>
                        <span className="text-amber-900 text-sm">- 발행 전 미리보기</span>
                    </div>
                </div>
            )}

            {/* 현재 날짜의 기사만 표시 (일간 신문 스타일) */}
            {currentDate && currentArticles.length > 0 ? (
                <ArticleDisplay articles={currentArticles} loading={false} error={null} />
            ) : (
                <div className="text-center py-20 text-muted-foreground">
                    <p className="text-xl">표시할 기사가 없습니다.</p>
                </div>
            )}
        </PageFrame>
    );
}
