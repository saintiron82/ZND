import { NextRequest, NextResponse } from 'next/server';

/**
 * 방문자 마일스톤 알림 시스템
 * 하루 방문자가 10, 50, 100, 500명 도달 시 Discord 알림
 */

// 메모리 기반 카운터 (서버 재시작 시 리셋)
interface DailyStats {
    date: string;
    count: number;
    notifiedMilestones: Set<number>;
}

let dailyStats: DailyStats = {
    date: '',
    count: 0,
    notifiedMilestones: new Set(),
};

const MILESTONES = [10, 50, 100, 500];

function getTodayDate(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

async function sendMilestoneNotification(milestone: number, webhookUrl: string) {
    const emojis: Record<number, string> = {
        10: '🎉',
        50: '🔥',
        100: '🚀',
        500: '🏆',
    };

    const messages: Record<number, string> = {
        10: '첫 번째 마일스톤! 오늘 10명이 방문했어요!',
        50: '좋은 흐름! 오늘 50명이 방문했어요!',
        100: '대단해요! 오늘 100명 돌파!',
        500: '놀라워요! 오늘 500명이 ZED를 찾았어요!',
    };

    const payload = {
        embeds: [
            {
                title: `${emojis[milestone] || '🎯'} 방문자 ${milestone}명 달성!`,
                description: messages[milestone] || `오늘 ${milestone}명이 방문했습니다!`,
                color: 0xfbbf24, // amber-400
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'ZED Visitor Milestone',
                },
            },
        ],
    };

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        console.log(`[Visitor] 마일스톤 ${milestone}명 알림 전송 완료`);
    } catch (error) {
        console.error(`[Visitor] 마일스톤 알림 실패:`, error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const today = getTodayDate();

        // 날짜가 바뀌면 카운터 리셋
        if (dailyStats.date !== today) {
            dailyStats = {
                date: today,
                count: 0,
                notifiedMilestones: new Set(),
            };
        }

        // 방문자 카운트 증가
        dailyStats.count += 1;

        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

        // 마일스톤 체크 및 알림
        if (webhookUrl) {
            for (const milestone of MILESTONES) {
                if (dailyStats.count >= milestone && !dailyStats.notifiedMilestones.has(milestone)) {
                    dailyStats.notifiedMilestones.add(milestone);
                    await sendMilestoneNotification(milestone, webhookUrl);
                }
            }
        }

        return NextResponse.json({
            success: true,
            date: today,
            count: dailyStats.count,
        });

    } catch (error) {
        console.error('[Visitor] 오류:', error);
        return NextResponse.json({ error: '서버 오류' }, { status: 500 });
    }
}

// GET: 현재 통계 조회 (디버그용)
export async function GET() {
    return NextResponse.json({
        date: dailyStats.date || getTodayDate(),
        count: dailyStats.count,
        milestones: MILESTONES,
        notified: Array.from(dailyStats.notifiedMilestones),
    });
}
