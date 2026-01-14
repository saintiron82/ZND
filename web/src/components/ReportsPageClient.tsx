'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Header from './Header';
import Footer from '@/components/Footer';
import { TrendingUp, Calendar } from 'lucide-react';
import { getTagColor } from '@/lib/tagColors';
import { TrendReport } from '@/lib/firestoreService';

interface ReportsPageClientProps {
    initialReports: TrendReport[];
}

export default function ReportsPageClient({ initialReports }: ReportsPageClientProps) {
    const [reports, setReports] = useState<TrendReport[]>(initialReports);
    const [selectedReport, setSelectedReport] = useState<TrendReport | null>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [topTags, setTopTags] = useState<string[]>([]);

    // 초기 로드 시 리포트가 있으면 첫 번째 선택
    useEffect(() => {
        if (reports.length > 0 && !selectedReport) {
            setSelectedReport(reports[0]);
            buildChartData(reports);
        }
    }, [reports]);

    // 차트 데이터 빌드
    function buildChartData(reportList: TrendReport[]) {
        const chronReports = [...reportList].reverse();
        const latestReport = reportList[0];

        let targetTags: string[] = [];
        if (latestReport && latestReport.tag_rankings) {
            targetTags = latestReport.tag_rankings.slice(0, 5).map((t: any) => t.tag);
        }

        setTopTags(targetTags);

        const data = chronReports.map(report => {
            const entry: any = {
                week: report.period?.end?.slice(5) || report.id.slice(0, 10)
            };

            for (const tag of targetTags) {
                const found = (report.tag_rankings || []).find((t: any) => t.tag === tag);
                const rank = found ? found.rank : null;
                entry[tag] = rank || 30;
                entry[`${tag}_info`] = {
                    rank: rank,
                    count: found ? found.count : 0
                };
            }
            return entry;
        });

        setChartData(data);
    }

    const formatDateKo = (dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-').map(Number);
        return `${month}월 ${day}일`;
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header currentDate={selectedReport?.period?.end} />

            {/* 상단: 차트 */}
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
                                        allowDataOverflow={true}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--glass-bg)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value: any, name: string | undefined, props: any) => {
                                            if (value === null || name === undefined) return null;
                                            const info = props?.payload?.[`${name}_info`];
                                            const count = info?.count || 0;
                                            return [`${count}건`, name];
                                        }}
                                        itemSorter={(item) => (item.value as number) || 999}
                                    />
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

            {/* 메인 콘텐츠 */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
                    <aside className="lg:sticky lg:top-8 lg:self-start">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-4 h-4 text-teal-500" />
                            <h2 className="font-semibold text-foreground">리포트 선택</h2>
                        </div>
                        <div className="space-y-2">
                            {reports.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-4">저장된 리포트가 없습니다.</p>
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
                                            <p className="font-bold text-sm">{formatDateKo(report.period?.end)} 기준</p>
                                            <p className={`text-xs ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                                                {report.period?.start} ~ {report.period?.end}
                                            </p>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <div>
                        {selectedReport ? (
                            <div className="space-y-6">
                                <div className="pb-4 border-b border-border">
                                    <h2 className="text-2xl font-bold text-foreground">
                                        {formatDateKo(selectedReport.period?.end)} 주간 리포트
                                    </h2>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        분석 기간: {selectedReport.period?.start} ~ {selectedReport.period?.end}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">🔥 TOP 트렌드</h3>
                                    <div className="space-y-4">
                                        {(selectedReport.top_trends || []).map((trend, i) => (
                                            <div key={i} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-5">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${trend.rank === 1 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                                        trend.rank === 2 ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-800' :
                                                            trend.rank === 3 ? 'bg-gradient-to-r from-amber-600 to-amber-700' :
                                                                'bg-teal-500'
                                                        }`}>
                                                        {trend.rank}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-foreground text-lg leading-tight">{trend.topic}</h4>
                                                        <div className="flex flex-wrap gap-1.5 my-3">
                                                            {(trend.tags || []).map((tag: string) => (
                                                                <span key={tag} className="px-2.5 py-1 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-muted-foreground text-sm leading-relaxed">{trend.summary}</p>
                                                        {trend.key_players && trend.key_players.length > 0 && (
                                                            <p className="text-xs text-muted-foreground mt-2">👥 {trend.key_players.join(', ')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedReport.weekly_insight && (
                                        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-900/30 rounded-xl p-5 border border-teal-200/50 dark:border-teal-800/50">
                                            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">💡 주간 인사이트</h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed">{selectedReport.weekly_insight}</p>
                                        </div>
                                    )}
                                    {selectedReport.next_week_outlook && (
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-5 border border-amber-200/50 dark:border-amber-800/50">
                                            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">🔮 다음 주 전망</h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed">{selectedReport.next_week_outlook}</p>
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
