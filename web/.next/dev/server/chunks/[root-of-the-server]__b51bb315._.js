module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/app/api/visitor/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
let dailyStats = {
    date: '',
    count: 0,
    notifiedMilestones: new Set()
};
const MILESTONES = [
    10,
    50,
    100,
    500
];
function getTodayDate() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}
async function sendMilestoneNotification(milestone, webhookUrl) {
    const emojis = {
        10: '🎉',
        50: '🔥',
        100: '🚀',
        500: '🏆'
    };
    const messages = {
        10: '첫 번째 마일스톤! 오늘 10명이 방문했어요!',
        50: '좋은 흐름! 오늘 50명이 방문했어요!',
        100: '대단해요! 오늘 100명 돌파!',
        500: '놀라워요! 오늘 500명이 ZED를 찾았어요!'
    };
    const payload = {
        embeds: [
            {
                title: `${emojis[milestone] || '🎯'} 방문자 ${milestone}명 달성!`,
                description: messages[milestone] || `오늘 ${milestone}명이 방문했습니다!`,
                color: 0xfbbf24,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'ZED Visitor Milestone'
                }
            }
        ]
    };
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        console.log(`[Visitor] 마일스톤 ${milestone}명 알림 전송 완료`);
    } catch (error) {
        console.error(`[Visitor] 마일스톤 알림 실패:`, error);
    }
}
async function POST(request) {
    try {
        const today = getTodayDate();
        // 날짜가 바뀌면 카운터 리셋
        if (dailyStats.date !== today) {
            dailyStats = {
                date: today,
                count: 0,
                notifiedMilestones: new Set()
            };
        }
        // 방문자 카운트 증가
        dailyStats.count += 1;
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        // 마일스톤 체크 및 알림
        if (webhookUrl) {
            for (const milestone of MILESTONES){
                if (dailyStats.count >= milestone && !dailyStats.notifiedMilestones.has(milestone)) {
                    dailyStats.notifiedMilestones.add(milestone);
                    await sendMilestoneNotification(milestone, webhookUrl);
                }
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            date: today,
            count: dailyStats.count
        });
    } catch (error) {
        console.error('[Visitor] 오류:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: '서버 오류'
        }, {
            status: 500
        });
    }
}
async function GET() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        date: dailyStats.date || getTodayDate(),
        count: dailyStats.count,
        milestones: MILESTONES,
        notified: Array.from(dailyStats.notifiedMilestones)
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b51bb315._.js.map