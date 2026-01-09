'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TrendingUp, Calendar } from 'lucide-react';

// Types
interface TrendReport {
    id: string;
    period: { start: string; end: string };
    top_trends: Array<{
        rank: number;
        topic: string;
        tags: string[];
        summary: string;
        key_players?: string[];
    }>;
    tag_rankings: Array<{
        rank: number;
        tag: string;
        count: number;
    }>;
    weekly_insight: string;
    next_week_outlook: string;
    created_at: string;
}

// 공통 유틸리티에서 import
import { getTagColor } from '@/lib/tagColors';

export default function ReportsPage() {
    const [reports, setReports] = useState<TrendReport[]>([]);
    const [selectedReport, setSelectedReport] = useState<TrendReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<any[]>([]);
    const [topTags, setTopTags] = useState<string[]>([]);

    // 리포트 목록 로드
    useEffect(() => {
        async function fetchReports() {
            try {
                const res = await fetch('/api/trends');
                const data = await res.json();
                if (data.success && data.reports) {
                    setReports(data.reports);
                    if (data.reports.length > 0) {
                        setSelectedReport(data.reports[0]);
                    }
                    buildChartData(data.reports);
                }
            } catch (e) {
                console.error('Failed to fetch reports:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchReports();
    }, []);

    // 차트 데이터 빌드 (최신 리포트의 상위 5개 태그 기준)
    function buildChartData(reportList: TrendReport[]) {
        // 전체 리포트를 시간순으로 정렬 (Oldest -> Newest)
        const chronReports = [...reportList].reverse();

        // 최신 리포트 기준 상위 5개 태그 추출
        const latestReport = reportList[0];

        let targetTags: string[] = [];
        if (latestReport && latestReport.tag_rankings) {
            targetTags = latestReport.tag_rankings.slice(0, 5).map(t => t.tag);
        }

        setTopTags(targetTags);

        // 차트 데이터 생성
        const data = chronReports.map(report => {
            const entry: any = {
                week: report.period?.end?.slice(5) || report.id.slice(0, 10)
            };

            for (const tag of targetTags) {
                const found = (report.tag_rankings || []).find(t => t.tag === tag);
                const rank = found ? found.rank : null;

                // 차트 표시 값: 랭크가 없으면 30위로 간주 (바닥)
                entry[tag] = rank || 30;

                // 실제 정보 저장 (툴팁용)
                entry[`${tag}_info`] = {
                    rank: rank,
                    count: found ? found.count : 0
                };
            }

            return entry;
        });

        setChartData(data);
    }

    // 날짜 포맷 (종료일 기준)
    const formatDateKo = (dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-').map(Number);
        return `${month}월 ${day}일`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground">
                <Header currentDate={null} />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <p className="text-muted-foreground">로딩 중...</p>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header currentDate={selectedReport?.period?.end} />

            {/* 상단: 차트 (최신 정보 기반, 항상 표시) */}
            <section className="border-b border-border bg-gradient-to-b from-teal-50/50 to-transparent dark:from-teal-950/20 dark:to-transparent">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-foreground">트렌드 차트</h1>
                    </div>

                    {chartData.length > 0 ? (
                        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4">
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                                    <XAxis dataKey="week" stroke="currentColor" fontSize={12} />
                                    <YAxis
                                        stroke="currentColor"
                                        fontSize={12}
                                        reversed={true}
                                        domain={[0.5, 6]}
                                        ticks={[1, 2, 3, 4, 5]}
                                        tickFormatter={(value) => `${value}위`}
                                        allowDataOverflow={true} // 데이터가 범위를 벗어나도 됨 (클립핑)
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--glass-bg)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value: any, name: string | undefined, props: any) => {
                                            if (value === null || name === undefined) return null;

                                            // _info 객체에서 실제 정보 가져오기
                                            const info = props?.payload?.[`${name}_info`];
                                            const count = info?.count || 0;

                                            // 순위 설명 제거하고 건수만 표시
                                            return [`${count}건`, name];
                                        }}
                                        itemSorter={(item) => (item.value as number) || 999}
                                    />
                                    {/* Legend 제거됨 */}
                                    {topTags.map((tag) => (
                                        <Line
                                            key={tag}
                                            type="monotone"
                                            dataKey={tag}
                                            stroke={getTagColor(tag)}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">차트 데이터가 없습니다.</p>
                    )}
                </div>
            </section>

            {/* 메인: 사이드바 + 리포트 상세 */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">

                    {/* 왼쪽 사이드바: 리포트 날짜 선택 */}
                    <aside className="lg:sticky lg:top-8 lg:self-start">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-4 h-4 text-teal-500" />
                            <h2 className="font-semibold text-foreground">리포트 선택</h2>
                        </div>

                        <div className="space-y-2">
                            {reports.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-4">
                                    저장된 리포트가 없습니다.
                                </p>
                            ) : (
                                reports.map(report => {
                                    const isActive = selectedReport?.id === report.id;
                                    return (
                                        <button
                                            key={report.id}
                                            onClick={() => setSelectedReport(report)}
                                            className={`w-full text-left p-3 rounded-xl transition-all ${isActive
                                                ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                                                : 'bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-teal-500 text-foreground'
                                                }`}
                                        >
                                            <p className="font-bold text-sm">
                                                {formatDateKo(report.period?.end)} 기준
                                            </p>
                                            <p className={`text-xs ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                                                {report.period?.start} ~ {report.period?.end}
                                            </p>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* 가운데: 선택된 리포트 상세 */}
                    <div>
                        {selectedReport ? (
                            <div className="space-y-6">
                                {/* 리포트 헤더 */}
                                <div className="pb-4 border-b border-border">
                                    <h2 className="text-2xl font-bold text-foreground">
                                        {formatDateKo(selectedReport.period?.end)} 주간 리포트
                                    </h2>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        분석 기간: {selectedReport.period?.start} ~ {selectedReport.period?.end}
                                    </p>
                                </div>

                                {/* TOP 트렌드 */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        🔥 TOP 트렌드
                                    </h3>
                                    <div className="space-y-4">
                                        {(selectedReport.top_trends || []).map((trend, i) => (
                                            <div
                                                key={i}
                                                className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-5"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${trend.rank === 1 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                                        trend.rank === 2 ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-800' :
                                                            trend.rank === 3 ? 'bg-gradient-to-r from-amber-600 to-amber-700' :
                                                                'bg-teal-500'
                                                        }`}>
                                                        {trend.rank}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-foreground text-lg leading-tight">
                                                            {trend.topic}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-1.5 my-3">
                                                            {(trend.tags || []).map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="px-2.5 py-1 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-muted-foreground text-sm leading-relaxed">
                                                            {trend.summary}
                                                        </p>
                                                        {trend.key_players && trend.key_players.length > 0 && (
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                👥 {trend.key_players.join(', ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 인사이트 섹션 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedReport.weekly_insight && (
                                        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 rounded-xl p-5 border border-teal-200/50 dark:border-teal-800/50">
                                            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                                                💡 주간 인사이트
                                            </h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed">
                                                {selectedReport.weekly_insight}
                                            </p>
                                        </div>
                                    )}

                                    {selectedReport.next_week_outlook && (
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-5 border border-amber-200/50 dark:border-amber-800/50">
                                            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                                                🔮 다음 주 전망
                                            </h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed">
                                                {selectedReport.next_week_outlook}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                왼쪽에서 리포트를 선택하세요.
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
