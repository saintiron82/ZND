module.exports = [
"[project]/src/components/ZSFeedbackButtons.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ZSFeedbackButtons
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [app-ssr] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-up.js [app-ssr] (ecmascript) <export default as ChevronUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-ssr] (ecmascript) <export default as Check>");
'use client';
;
;
;
// 클라이언트 ID 생성 (익명 식별자)
function getClientId() {
    if ("TURBOPACK compile-time truthy", 1) return '';
    //TURBOPACK unreachable
    ;
    let clientId;
}
// 투표 기록 로컬 저장 (중복 방지용)
function hasVotedLocally(articleId, date) {
    if ("TURBOPACK compile-time truthy", 1) return false;
    //TURBOPACK unreachable
    ;
    const key = undefined;
}
function markVotedLocally(articleId, date, vote) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
    const key = undefined;
}
function getLocalVote(articleId, date) {
    if ("TURBOPACK compile-time truthy", 1) return null;
    //TURBOPACK unreachable
    ;
    const key = undefined;
}
function ZSFeedbackButtons({ articleId, date, showStats = false, size = 'sm', className = '' }) {
    const [userVote, setUserVote] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [stats, setStats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isSubmitting, setIsSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    // 마운트 시 로컬 투표 기록 확인
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setMounted(true);
        const localVote = getLocalVote(articleId, date);
        if (localVote) {
            setUserVote(localVote);
        }
    }, [
        articleId,
        date
    ]);
    // 통계 조회 (showStats가 true일 때만)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (showStats && mounted) {
            fetchStats();
        }
    }, [
        showStats,
        mounted,
        articleId,
        date
    ]);
    const fetchStats = async ()=>{
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
    const handleVote = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (vote)=>{
        if (userVote || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const clientId = getClientId();
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    articleId,
                    date,
                    vote,
                    clientId
                })
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
        } finally{
            setIsSubmitting(false);
        }
    }, [
        articleId,
        date,
        userVote,
        isSubmitting
    ]);
    // SSR 대응
    if (!mounted) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `flex items-center gap-1 ${className}`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-6 h-6 bg-muted/30 rounded animate-pulse"
                }, void 0, false, {
                    fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                    lineNumber: 131,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-6 h-6 bg-muted/30 rounded animate-pulse"
                }, void 0, false, {
                    fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                    lineNumber: 132,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
            lineNumber: 130,
            columnNumber: 13
        }, this);
    }
    const buttonBase = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
    // 동의율 계산
    const agreeRate = stats && stats.totalVotes > 0 ? Math.round((stats.agree + 0) / stats.totalVotes * 100) : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `flex items-center gap-1 ${className}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>handleVote('lower'),
                disabled: !!userVote || isSubmitting,
                title: "ZS가 더 낮아야 해요 (품질이 낮음)",
                className: `
          ${buttonBase} rounded flex items-center justify-center transition-all
          ${userVote === 'lower' ? 'bg-red-500/20 text-red-500 ring-1 ring-red-500/50' : userVote ? 'bg-muted/20 text-muted-foreground/30 cursor-not-allowed' : 'bg-muted/30 text-muted-foreground hover:bg-red-500/20 hover:text-red-500'}
        `,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                    className: iconSize
                }, void 0, false, {
                    fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                    lineNumber: 165,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                lineNumber: 151,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>handleVote('agree'),
                disabled: !!userVote || isSubmitting,
                title: "ZS 점수에 동의해요",
                className: `
          ${buttonBase} rounded flex items-center justify-center transition-all
          ${userVote === 'agree' ? 'bg-green-500/20 text-green-500 ring-1 ring-green-500/50' : userVote ? 'bg-muted/20 text-muted-foreground/30 cursor-not-allowed' : 'bg-muted/30 text-muted-foreground hover:bg-green-500/20 hover:text-green-500'}
        `,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                    className: iconSize
                }, void 0, false, {
                    fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                    lineNumber: 183,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                lineNumber: 169,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>handleVote('higher'),
                disabled: !!userVote || isSubmitting,
                title: "ZS가 더 높아야 해요 (품질이 높음)",
                className: `
          ${buttonBase} rounded flex items-center justify-center transition-all
          ${userVote === 'higher' ? 'bg-blue-500/20 text-blue-500 ring-1 ring-blue-500/50' : userVote ? 'bg-muted/20 text-muted-foreground/30 cursor-not-allowed' : 'bg-muted/30 text-muted-foreground hover:bg-blue-500/20 hover:text-blue-500'}
        `,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronUp$3e$__["ChevronUp"], {
                    className: iconSize
                }, void 0, false, {
                    fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                    lineNumber: 201,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                lineNumber: 187,
                columnNumber: 13
            }, this),
            showStats && stats && stats.totalVotes > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-xs text-muted-foreground ml-1",
                children: [
                    agreeRate,
                    "% 동의"
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
                lineNumber: 206,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ZSFeedbackButtons.tsx",
        lineNumber: 149,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/ArticleCard.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/external-link.js [app-ssr] (ecmascript) <export default as ExternalLink>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$next$2f$third$2d$parties$2f$dist$2f$google$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@next/third-parties/dist/google/index.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ZSFeedbackButtons$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ZSFeedbackButtons.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
// Award badge styling
const getAwardStyle = (award)=>{
    switch(award){
        case "Today's Headline":
            return "bg-gradient-to-r from-amber-400 to-orange-500 text-white";
        case "Zero Echo Award":
            return "bg-gradient-to-r from-emerald-400 to-teal-500 text-white";
        case "Hot Topic":
            return "bg-gradient-to-r from-rose-400 to-pink-500 text-white";
        default:
            return "bg-teal-500 text-white";
    }
};
const ArticleCard = ({ article, className = '', hideSummary = false, cols = 4, rows = 2, currentDate, showFeedback = true })=>{
    const { id, title_ko, summary, tags, url, crawled_at, published_at, source_id, impact_score, zero_echo_score, awards, layout_type } = article;
    // Use zero_echo_score for quality indication
    const zeScore = zero_echo_score ?? 0;
    // ... (score color logic) ...
    const getScoreColor = (s)=>{
        if (s < 3.0) return "text-emerald-600 dark:text-emerald-400";
        if (s < 6.0) return "text-amber-600 dark:text-amber-400";
        return "text-red-600 dark:text-red-400";
    };
    // ... (date format logic) - 발행일(published_at) 우선 사용 ...
    const formatDate = (date)=>{
        if (!date) return '';
        if (typeof date === 'string') {
            return new Date(date).toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric'
            });
        }
        if (date && typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric'
            });
        }
        return '';
    };
    // 발행일(published_at) 우선, 없으면 crawled_at 사용
    // [Yena] currentDate(회차 날짜)가 있으면 우선 사용하여 달력과 일치시킴
    const dateStr = currentDate ? formatDate(currentDate) : formatDate(published_at) || formatDate(crawled_at);
    // Dynamic Title Size based on Impact Score
    const getTitleSize = (s)=>{
        const score = s || 0;
        if (hideSummary) return "text-[10px] md:text-xs";
        if (score >= 7.5) return "text-xl md:text-3xl";
        if (score >= 6) return "text-lg md:text-2xl";
        if (score >= 4) return "text-base md:text-xl";
        if (score >= 2) return "text-sm md:text-lg";
        return "text-xs md:text-base";
    };
    // Dynamic Line Clamp based on actual Height (High-Res 10px Rows)
    // HeightPx = (rows * 10) + ((rows - 1) * 16). (Include Gap-4 = 16px)
    // Fixed Overhead (Title/Date/Pad) ~= 100px.
    // LineHeight ~= 24px.
    const gapPx = 16;
    const heightPx = rows * 10 + Math.max(0, rows - 1) * gapPx;
    const maxLines = Math.max(3, Math.floor((heightPx - 100) / 24));
    // 클릭 이벤트 버블링 방지를 위한 핸들러
    const handleFeedbackClick = (e)=>{
        e.preventDefault();
        e.stopPropagation();
    };
    // GA4 기사 클릭 이벤트 추적
    const handleArticleClick = ()=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$next$2f$third$2d$parties$2f$dist$2f$google$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sendGAEvent"])('event', 'article_click', {
            article_id: id,
            article_title: title_ko.substring(0, 100),
            article_score: zeScore,
            layout_type: layout_type || 'standard',
            source: source_id,
            tags: tags?.slice(0, 3).join(',') || '',
            has_award: awards && awards.length > 0 ? 'yes' : 'no'
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        onClick: handleArticleClick,
        className: cn("group flex flex-col h-full p-5 transition-all duration-300 rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-800/50 hover:border-teal-400/40 hover:shadow-lg hover:shadow-teal-500/5", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col gap-3 flex-1 min-h-0",
                children: [
                    awards && awards.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap gap-1.5 shrink-0",
                        children: awards.map((award)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm", getAwardStyle(award)),
                                children: [
                                    "🏆 ",
                                    award
                                ]
                            }, award, true, {
                                fileName: "[project]/src/components/ArticleCard.tsx",
                                lineNumber: 143,
                                columnNumber: 29
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/src/components/ArticleCard.tsx",
                        lineNumber: 141,
                        columnNumber: 21
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-sans shrink-0",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: cn("flex items-center gap-1", getScoreColor(zeScore)),
                            children: [
                                "ZS ",
                                zeScore.toFixed(1)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ArticleCard.tsx",
                            lineNumber: 157,
                            columnNumber: 21
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/components/ArticleCard.tsx",
                        lineNumber: 156,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: cn("font-black font-sans leading-[1.1] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors tracking-tight shrink-0", getTitleSize(impact_score)),
                        children: title_ko
                    }, void 0, false, {
                        fileName: "[project]/src/components/ArticleCard.tsx",
                        lineNumber: 163,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    !hideSummary && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-muted-foreground leading-relaxed font-sans text-sm",
                        style: {
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: maxLines,
                            overflow: 'hidden'
                        },
                        children: summary
                    }, void 0, false, {
                        fileName: "[project]/src/components/ArticleCard.tsx",
                        lineNumber: 171,
                        columnNumber: 21
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ArticleCard.tsx",
                lineNumber: 138,
                columnNumber: 13
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 pt-3 border-t border-border/40 flex items-center justify-between shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-1.5 items-center overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[10px] font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap font-sans",
                                children: source_id
                            }, void 0, false, {
                                fileName: "[project]/src/components/ArticleCard.tsx",
                                lineNumber: 187,
                                columnNumber: 21
                            }, ("TURBOPACK compile-time value", void 0)),
                            tags && tags.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-muted-foreground/50",
                                children: "·"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ArticleCard.tsx",
                                lineNumber: 188,
                                columnNumber: 49
                            }, ("TURBOPACK compile-time value", void 0)),
                            tags?.slice(0, 2).map((tag)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-sm whitespace-nowrap font-sans",
                                    children: [
                                        "#",
                                        tag
                                    ]
                                }, tag, true, {
                                    fileName: "[project]/src/components/ArticleCard.tsx",
                                    lineNumber: 190,
                                    columnNumber: 25
                                }, ("TURBOPACK compile-time value", void 0)))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ArticleCard.tsx",
                        lineNumber: 186,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            showFeedback && currentDate && id && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                onClick: handleFeedbackClick,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ZSFeedbackButtons$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    articleId: id,
                                    date: currentDate,
                                    size: "sm"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ArticleCard.tsx",
                                    lineNumber: 199,
                                    columnNumber: 29
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/src/components/ArticleCard.tsx",
                                lineNumber: 198,
                                columnNumber: 25
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__["ExternalLink"], {
                                className: "w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ArticleCard.tsx",
                                lineNumber: 206,
                                columnNumber: 21
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ArticleCard.tsx",
                        lineNumber: 195,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ArticleCard.tsx",
                lineNumber: 185,
                columnNumber: 13
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ArticleCard.tsx",
        lineNumber: 128,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0));
};
const __TURBOPACK__default__export__ = ArticleCard;
}),
"[project]/src/config/layoutConfig.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LAYOUT_CONFIG",
    ()=>LAYOUT_CONFIG
]);
const LAYOUT_CONFIG = {
    grid: {
        totalColumns: 10,
        cellHeight: 10,
        gap: 4
    },
    // Content Weight Factors for Volume Calculation
    // Volume = (Score * scoreWeight)
    volumeFactors: {
        scoreWeight: 3.0,
        textWeight: 0.0
    },
    // Grid Constraints
    constraints: {
        minWidth: 3,
        maxWidth: 8,
        minHeight: 2
    },
    // Shape Efficiency: Adjusts height based on text wrapping efficiency
    // Narrow cards wrap more (Inefficient) -> Need more height (Divide by < 1.0)
    // Wide cards wrap less (Efficient) -> Need less height (Divide by > 1.0)
    shapeEfficiency: {
        narrowThreshold: 3,
        narrowFactor: 0.9,
        wideThreshold: 6,
        wideFactor: 1.1,
        standardFactor: 1.0
    },
    // Physics Constants for Exact Text Fit
    physics: {
        colWidthPx: 116,
        lineHeightPx: 24,
        charWidthPx: 11,
        paddingPx: 40,
        headerHeightPx: 100
    },
    // Content display rules (Line Clamping)
    corrections: {
        lineClamp: [
            {
                minRatio: 2.0,
                minRows: 0,
                lines: 8
            },
            {
                minRatio: 1.4,
                minRows: 3,
                lines: 6
            },
            {
                minRatio: 1.0,
                minRows: 0,
                lines: 5
            },
            {
                minRatio: 0.0,
                minRows: 4,
                lines: 5
            },
            {
                minRatio: 0.0,
                minRows: 0,
                lines: 3
            }
        ]
    }
};
}),
"[project]/src/utils/layoutOptimizer.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LayoutOptimizer",
    ()=>LayoutOptimizer,
    "getLayoutOptimizer",
    ()=>getLayoutOptimizer,
    "optimizeArticleOrder",
    ()=>optimizeArticleOrder
]);
/**
 * Layout Optimizer - Gap-Filling Algorithm
 * 
 * Simulates CSS Grid layout, detects empty spaces (gaps),
 * and recommends high ZS-score articles to fill those gaps.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$layoutConfig$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/layoutConfig.ts [app-ssr] (ecmascript)");
;
// Deterministic hash for consistent width selection
const getHash = (str)=>{
    if (!str) return 0;
    let hash = 0;
    for(let i = 0; i < str.length; i++){
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};
// Calculate article size using the same physics logic as ArticleDisplay
const calculateArticleSize = (article)=>{
    const { constraints, physics, grid } = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$layoutConfig$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LAYOUT_CONFIG"];
    const textLength = (article.summary || '').length;
    const score = article.impact_score || 0;
    const minW = constraints.minWidth;
    const maxW = constraints.maxWidth;
    // Random width based on ID hash
    const hash = getHash(article.id || '');
    const widthRange = maxW - minW + 1;
    let cols = minW + hash % widthRange;
    // High impact bias
    if (score >= 7.0) {
        cols = Math.max(cols, 6);
    }
    cols = Math.min(cols, maxW);
    // Physics calculation
    const availableWidthPx = cols * physics.colWidthPx - physics.paddingPx - (cols - 1) * grid.gap;
    const charsPerLine = availableWidthPx / physics.charWidthPx;
    const estimatedLines = Math.ceil(textLength / charsPerLine);
    const requiredHeightPx = physics.headerHeightPx + estimatedLines * physics.lineHeightPx + physics.paddingPx;
    // Grid quantization (10px steps)
    const gapPx = 16;
    const trackPx = grid.cellHeight;
    let rows = Math.ceil((requiredHeightPx + gapPx) / (trackPx + gapPx));
    // Safety Margin: Add 2 extra rows to prevent text cutoff
    rows = rows + 2;
    // Minimal floor
    const MIN_ROWS = 5;
    rows = Math.max(rows, MIN_ROWS);
    rows = Math.min(rows, 80);
    return {
        cols,
        rows
    };
};
class LayoutOptimizer {
    gridCols;
    gridRows;
    grid;
    placements;
    nextRow;
    constructor(gridCols = 10, initialRows = 100){
        this.gridCols = gridCols;
        this.gridRows = initialRows;
        this.grid = this.createEmptyGrid(gridCols, initialRows);
        this.placements = [];
        this.nextRow = 0;
    }
    createEmptyGrid(cols, rows) {
        return Array.from({
            length: rows
        }, ()=>Array.from({
                length: cols
            }, ()=>({
                    occupied: false
                })));
    }
    expandGridIfNeeded(requiredRows) {
        while(this.gridRows < requiredRows){
            this.grid.push(Array.from({
                length: this.gridCols
            }, ()=>({
                    occupied: false
                })));
            this.gridRows++;
        }
    }
    // Find first available position for an article (left-to-right, top-to-bottom)
    findPosition(cols, rows, minRow = 0) {
        for(let r = minRow; r < this.gridRows; r++){
            for(let c = 0; c <= this.gridCols - cols; c++){
                if (this.canPlace(c, r, cols, rows)) {
                    return {
                        col: c,
                        row: r
                    };
                }
            }
            // Expand grid if we've searched too far
            if (r >= this.gridRows - rows - 1) {
                this.expandGridIfNeeded(this.gridRows + 10);
            }
        }
        // Fallback: append at end
        const newRow = Math.max(this.gridRows, minRow);
        this.expandGridIfNeeded(newRow + rows);
        return {
            col: 0,
            row: newRow
        };
    }
    canPlace(col, row, cols, rows) {
        this.expandGridIfNeeded(row + rows);
        for(let r = row; r < row + rows; r++){
            for(let c = col; c < col + cols; c++){
                if (c >= this.gridCols) return false;
                if (this.grid[r][c].occupied) return false;
            }
        }
        return true;
    }
    markOccupied(col, row, cols, rows, articleId) {
        this.expandGridIfNeeded(row + rows);
        for(let r = row; r < row + rows; r++){
            for(let c = col; c < col + cols; c++){
                this.grid[r][c] = {
                    occupied: true,
                    articleId
                };
            }
        }
        this.nextRow = Math.max(this.nextRow, row + rows);
    }
    // Place an article in the grid
    placeArticle(article, minRow = 0) {
        const pos = this.findPosition(article.cols, article.rows, minRow);
        if (!pos) return null;
        this.markOccupied(pos.col, pos.row, article.cols, article.rows, article.id);
        const placement = {
            article,
            ...pos
        };
        this.placements.push(placement);
        return placement;
    }
    // Detect gaps (empty rectangular regions)
    detectGaps(minArea = 6) {
        const gaps = [];
        const visited = new Set();
        for(let r = 0; r < this.nextRow; r++){
            for(let c = 0; c < this.gridCols; c++){
                const key = `${c},${r}`;
                if (visited.has(key) || this.grid[r][c].occupied) continue;
                // Find largest rectangle starting from this cell
                const gap = this.findLargestGap(c, r, visited);
                if (gap && gap.area >= minArea) {
                    gaps.push(gap);
                }
            }
        }
        return gaps.sort((a, b)=>b.area - a.area); // Largest first
    }
    findLargestGap(startCol, startRow, visited) {
        // Find max width
        let maxWidth = 0;
        for(let c = startCol; c < this.gridCols; c++){
            if (this.grid[startRow][c].occupied) break;
            maxWidth++;
        }
        // Find max height maintaining width
        let maxHeight = 0;
        let currentWidth = maxWidth;
        for(let r = startRow; r < this.nextRow; r++){
            let rowWidth = 0;
            for(let c = startCol; c < startCol + currentWidth; c++){
                if (this.grid[r][c].occupied) break;
                rowWidth++;
            }
            if (rowWidth === 0) break;
            currentWidth = Math.min(currentWidth, rowWidth);
            maxHeight++;
        }
        // Mark visited
        for(let r = startRow; r < startRow + maxHeight; r++){
            for(let c = startCol; c < startCol + currentWidth; c++){
                visited.add(`${c},${r}`);
            }
        }
        return {
            col: startCol,
            row: startRow,
            width: currentWidth,
            height: maxHeight,
            area: currentWidth * maxHeight
        };
    }
    // Find best article to fill a gap (ZS score priority)
    findFillerForGap(gap, candidates) {
        // Filter articles that fit in the gap
        const fittingArticles = candidates.filter((a)=>a.cols <= gap.width && a.rows <= gap.height);
        if (fittingArticles.length === 0) return null;
        // Sort by ZS score (lower is better), then by how well it fills the gap
        fittingArticles.sort((a, b)=>{
            // Primary: ZS score (ascending - lower is better quality)
            const zsDiff = a.zeroEchoScore - b.zeroEchoScore;
            if (Math.abs(zsDiff) > 0.5) return zsDiff;
            // Secondary: Fill efficiency (prefer articles that fill more of the gap)
            const fillA = a.cols * a.rows / gap.area;
            const fillB = b.cols * b.rows / gap.area;
            return fillB - fillA;
        });
        return fittingArticles[0] || null;
    }
    // Main optimization function
    optimizeLayout(articles) {
        // Reset grid completely
        this.gridRows = 100;
        this.grid = this.createEmptyGrid(this.gridCols, this.gridRows);
        this.placements = [];
        this.nextRow = 0;
        // Calculate sizes for all articles
        // IMPORTANT: Use url as ID since articles may not have a dedicated 'id' field
        const articlesWithSize = articles.map((a, index)=>({
                ...a,
                id: a.id || a.url || `article-${index}`,
                ...calculateArticleSize(a),
                zeroEchoScore: a.zero_echo_score || 0,
                impactScore: a.impact_score || 0
            }));
        // Sort by Combined Score (primary placement order)
        // Award winners will be placed first in Phase 0, then remaining by this order
        const sortedArticles = [
            ...articlesWithSize
        ].sort((a, b)=>{
            const combinedA = 10 - a.zeroEchoScore + a.impactScore;
            const combinedB = 10 - b.zeroEchoScore + b.impactScore;
            return combinedB - combinedA;
        });
        const placed = new Set();
        const finalOrder = [];
        // ===== AWARD SYSTEM =====
        // 1. Today's Headline: Best Combined Score (10 - ZS) + IS
        // 2. Zero Echo Award: Lowest ZS (tiebreaker: highest IS)
        // 3. Hot Topic: Highest IS
        // NOTE: All articles are eligible for awards (tags are optional)
        // 모든 기사가 어워드 후보 (태그 유무 관계없이)
        const awardCandidates = articlesWithSize;
        // Find award winners (only from candidates with tags)
        const byCombo = [
            ...awardCandidates
        ].sort((a, b)=>{
            const combinedA = 10 - a.zeroEchoScore + a.impactScore;
            const combinedB = 10 - b.zeroEchoScore + b.impactScore;
            return combinedB - combinedA;
        });
        const byZS = [
            ...awardCandidates
        ].sort((a, b)=>{
            const zsDiff = a.zeroEchoScore - b.zeroEchoScore; // Lower is better
            if (Math.abs(zsDiff) < 0.01) {
                return b.impactScore - a.impactScore; // Tiebreaker: higher IS
            }
            return zsDiff;
        });
        const byIS = [
            ...awardCandidates
        ].sort((a, b)=>b.impactScore - a.impactScore);
        // Assign awards (an article can win multiple)
        const awardMap = new Map();
        const addAward = (articleId, award)=>{
            if (!awardMap.has(articleId)) {
                awardMap.set(articleId, []);
            }
            awardMap.get(articleId).push(award);
        };
        // Assign primary awards
        if (byCombo.length > 0) addAward(byCombo[0].id, "Today's Headline");
        if (byZS.length > 0) addAward(byZS[0].id, "Zero Echo Award");
        if (byIS.length > 0) addAward(byIS[0].id, "Hot Topic");
        // Build Top 3 list (unique articles with actual awards ONLY - no runner-ups)
        const top3Ids = [];
        const usedForTop3 = new Set();
        // Get actual award winners (1st place only)
        const headlineWinnerId = byCombo.length > 0 ? byCombo[0].id : null;
        const zeroEchoWinnerId = byZS.length > 0 ? byZS[0].id : null;
        const hotTopicWinnerId = byIS.length > 0 ? byIS[0].id : null;
        // Slot 1: Today's Headline (always first)
        if (headlineWinnerId && !usedForTop3.has(headlineWinnerId)) {
            top3Ids.push(headlineWinnerId);
            usedForTop3.add(headlineWinnerId);
        }
        // Slot 2: Zero Echo Award (only if different from Headline)
        if (zeroEchoWinnerId && !usedForTop3.has(zeroEchoWinnerId)) {
            top3Ids.push(zeroEchoWinnerId);
            usedForTop3.add(zeroEchoWinnerId);
        }
        // Slot 3: Hot Topic (only if different from above)
        if (hotTopicWinnerId && !usedForTop3.has(hotTopicWinnerId)) {
            top3Ids.push(hotTopicWinnerId);
            usedForTop3.add(hotTopicWinnerId);
        }
        // Get article objects for logging
        const headlineWinner = headlineWinnerId ? articlesWithSize.find((a)=>a.id === headlineWinnerId) : null;
        const zeroEchoWinner = zeroEchoWinnerId ? articlesWithSize.find((a)=>a.id === zeroEchoWinnerId) : null;
        const hotTopicWinner = hotTopicWinnerId ? articlesWithSize.find((a)=>a.id === hotTopicWinnerId) : null;
        console.log(`[Awards] Today's Headline: ${headlineWinner?.id?.substring(0, 30)}`);
        console.log(`[Awards] Zero Echo Award: ${zeroEchoWinner?.id?.substring(0, 30)}`);
        console.log(`[Awards] Hot Topic: ${hotTopicWinner?.id?.substring(0, 30)}`);
        // Phase 0: Place Top 3 Award Winners
        let lastPlacedRow = 0;
        for(let i = 0; i < top3Ids.length; i++){
            const article = articlesWithSize.find((a)=>a.id === top3Ids[i]);
            if (!article) continue;
            // Attach awards to article
            article.awards = awardMap.get(article.id) || [];
            // First article (Headline) gets full width
            if (i === 0) {
                article.cols = 10;
            }
            const p = this.placeArticle(article, lastPlacedRow);
            if (p) {
                placed.add(article.id);
                finalOrder.push(article);
                if (i === 0) {
                    lastPlacedRow = p.row + p.article.rows;
                } else {
                    lastPlacedRow = p.row;
                }
            }
        }
        console.log(`[Phase 0] After Top 3: finalOrder=${finalOrder.length}, placed=${placed.size}`);
        // Phase 1: Place remaining primary articles (greedy)
        const primaryCount = Math.ceil(sortedArticles.length * 0.7); // 70% are primary
        for(let i = 0; i < sortedArticles.length; i++){
            const article = sortedArticles[i];
            if (placed.has(article.id)) continue;
            const p = this.placeArticle(article);
            if (p) {
                placed.add(article.id);
                finalOrder.push(article);
            }
        }
        // Phase 2: Detect gaps and fill with remaining articles (ZS priority)
        const remainingArticles = sortedArticles.filter((a)=>!placed.has(a.id));
        // Multiple passes to fill gaps
        for(let pass = 0; pass < 3; pass++){
            const gaps = this.detectGaps(6);
            for (const gap of gaps){
                const candidates = remainingArticles.filter((a)=>!placed.has(a.id));
                const filler = this.findFillerForGap(gap, candidates);
                if (filler) {
                    // Place at gap position
                    if (this.canPlace(gap.col, gap.row, filler.cols, filler.rows)) {
                        this.markOccupied(gap.col, gap.row, filler.cols, filler.rows, filler.id);
                        placed.add(filler.id);
                        finalOrder.push(filler);
                    }
                }
            }
        }
        // Phase 3: Append any remaining articles
        for (const article of remainingArticles){
            if (!placed.has(article.id)) {
                this.placeArticle(article);
                placed.add(article.id);
                finalOrder.push(article);
            }
        }
        console.log(`[LayoutOptimizer] Input: ${articles.length}, Output: ${finalOrder.length}`);
        return finalOrder;
    }
    // Get debug info about current grid state
    getGridStats() {
        let occupiedCells = 0;
        const totalCells = this.nextRow * this.gridCols;
        for(let r = 0; r < this.nextRow; r++){
            for(let c = 0; c < this.gridCols; c++){
                if (this.grid[r][c].occupied) occupiedCells++;
            }
        }
        return {
            occupiedCells,
            totalCells,
            fillRate: totalCells > 0 ? occupiedCells / totalCells : 0
        };
    }
}
// Singleton instance for convenience
let optimizerInstance = null;
const getLayoutOptimizer = (cols = 10)=>{
    if (!optimizerInstance) {
        optimizerInstance = new LayoutOptimizer(cols);
    }
    return optimizerInstance;
};
const optimizeArticleOrder = (articles)=>{
    const optimizer = new LayoutOptimizer(10);
    return optimizer.optimizeLayout(articles);
};
}),
"[project]/src/components/ArticleDisplay.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ArticleDisplay
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ArticleCard$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ArticleCard.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/calendar.js [app-ssr] (ecmascript) <export default as Calendar>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$layoutConfig$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/layoutConfig.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$layoutOptimizer$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/utils/layoutOptimizer.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
// Deterministic hash to keep layout stable between renders/hydrations
const getHash = (str)=>{
    if (!str) return 0;
    let hash = 0;
    for(let i = 0; i < str.length; i++){
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};
// Physics-Based Layout Calculator (High-Res 10px Grid + Random Width)
// NO MINIMUM HEIGHT CONSTRAINTS - Cards shrink to fit content exactly
const getSizeFromScore = (score, id, summary = '', title = '')=>{
    const { constraints, physics, grid } = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$layoutConfig$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LAYOUT_CONFIG"];
    const textLength = summary.length;
    const minW = constraints.minWidth;
    const maxW = constraints.maxWidth;
    // 1. Determine WIDTH (Random + Score Bias for Variety)
    const hash = getHash(id);
    const widthRange = maxW - minW + 1;
    let cols = minW + hash % widthRange;
    // Bias: High Impact articles (Score > 7) get wider cards
    if (score >= 7.0) {
        cols = Math.max(cols, 6);
    }
    cols = Math.min(cols, maxW);
    // 2. Physics Calculation - Exact Pixel Height Needed
    const availableWidthPx = cols * physics.colWidthPx - physics.paddingPx - (cols - 1) * grid.gap;
    const charsPerLine = availableWidthPx / physics.charWidthPx;
    const estimatedLines = Math.ceil(textLength / charsPerLine);
    // RequiredHeight = Header(Title+Meta) + TextBody + Padding
    const requiredHeightPx = physics.headerHeightPx + estimatedLines * physics.lineHeightPx + physics.paddingPx;
    // 3. High-Res Grid Quantization (10px steps)
    // Formula: Height = Rows*10 + (Rows-1)*16 = 26*Rows - 16
    // So: Rows = (Height + 16) / 26
    const gapPx = 16;
    const trackPx = grid.cellHeight; // 10
    let rows = Math.ceil((requiredHeightPx + gapPx) / (trackPx + gapPx));
    // MINIMAL floor only - just prevent degenerate tiny cards
    // 5 rows = ~100px = enough for title only
    const MIN_ROWS = 5;
    rows = Math.max(rows, MIN_ROWS);
    // Max cap for very long articles
    rows = Math.min(rows, 80);
    // Column class mappings for Tailwind
    const colMap = {
        3: "md:col-span-3",
        4: "md:col-span-4",
        5: "md:col-span-5",
        6: "md:col-span-6",
        7: "md:col-span-7",
        8: "md:col-span-8",
        9: "md:col-span-9",
        10: "md:col-span-10"
    };
    const colClass = colMap[cols] || "md:col-span-4";
    return {
        className: colClass,
        cols,
        rows
    };
};
function ArticleDisplay({ articles, loading, error, currentDate }) {
    // Optimization Logic:
    // If articles already have layout data (cols, rows) from server-side baking, use them directly.
    // Otherwise, generate layout client-side (fallback).
    const optimizedArticles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!articles || articles.length === 0) return [];
        // Check if first article already has layout info (fast check)
        // If so, assume entire list is pre-baked (view_model.json)
        if (articles[0].cols && articles[0].rows) {
            return articles;
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$layoutOptimizer$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["optimizeArticleOrder"])(articles);
    }, [
        articles
    ]);
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex justify-center items-center h-64",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
            }, void 0, false, {
                fileName: "[project]/src/components/ArticleDisplay.tsx",
                lineNumber: 106,
                columnNumber: 17
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/ArticleDisplay.tsx",
            lineNumber: 105,
            columnNumber: 13
        }, this);
    }
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "max-w-2xl mx-auto bg-destructive/10 text-destructive p-6 rounded-lg text-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "font-bold mb-2",
                    children: "Error Loading News"
                }, void 0, false, {
                    fileName: "[project]/src/components/ArticleDisplay.tsx",
                    lineNumber: 114,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: error
                }, void 0, false, {
                    fileName: "[project]/src/components/ArticleDisplay.tsx",
                    lineNumber: 115,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ArticleDisplay.tsx",
            lineNumber: 113,
            columnNumber: 13
        }, this);
    }
    if (optimizedArticles.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-col items-center justify-center h-64 text-muted-foreground",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__["Calendar"], {
                    className: "w-12 h-12 mb-4 opacity-50"
                }, void 0, false, {
                    fileName: "[project]/src/components/ArticleDisplay.tsx",
                    lineNumber: 123,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xl font-serif italic",
                    children: "No news published on this date."
                }, void 0, false, {
                    fileName: "[project]/src/components/ArticleDisplay.tsx",
                    lineNumber: 124,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ArticleDisplay.tsx",
            lineNumber: 122,
            columnNumber: 13
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "grid grid-cols-2 md:grid-cols-10 gap-4 auto-rows-[10px] grid-flow-dense",
            children: optimizedArticles.map((article, index)=>{
                const key = article.id || `article-${index}`;
                // Headline article - special handling
                if (index === 0) {
                    // Use pre-calculated size from optimizer if available, otherwise calculate
                    const cols = article.cols || 6;
                    const rows = article.rows ? Math.max(article.rows, 15) : 15;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].Fragment, {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "hidden md:block md:col-start-1 md:col-span-2 md:row-start-1 pointer-events-none",
                                style: {
                                    gridRowEnd: `span ${rows}`
                                }
                            }, void 0, false, {
                                fileName: "[project]/src/components/ArticleDisplay.tsx",
                                lineNumber: 144,
                                columnNumber: 33
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "md:col-start-3 md:col-span-6 md:row-start-1 flex flex-col",
                                style: {
                                    gridRowEnd: `span ${rows}`
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ArticleCard$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    article: article,
                                    className: "h-full font-sans",
                                    hideSummary: false,
                                    cols: 6,
                                    rows: rows,
                                    currentDate: currentDate
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ArticleDisplay.tsx",
                                    lineNumber: 146,
                                    columnNumber: 37
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/ArticleDisplay.tsx",
                                lineNumber: 145,
                                columnNumber: 33
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "hidden md:block md:col-start-9 md:col-span-2 md:row-start-1 pointer-events-none",
                                style: {
                                    gridRowEnd: `span ${rows}`
                                }
                            }, void 0, false, {
                                fileName: "[project]/src/components/ArticleDisplay.tsx",
                                lineNumber: 155,
                                columnNumber: 33
                            }, this)
                        ]
                    }, key, true, {
                        fileName: "[project]/src/components/ArticleDisplay.tsx",
                        lineNumber: 143,
                        columnNumber: 29
                    }, this);
                }
                // Use pre-calculated sizes from optimizer directly (no recalculation!)
                // The optimizer already calculated optimal sizes for gap-filling
                const cols = article.cols || 4;
                const rows = article.rows || 10;
                // Column class mapping
                const colMap = {
                    3: "md:col-span-3",
                    4: "md:col-span-4",
                    5: "md:col-span-5",
                    6: "md:col-span-6",
                    7: "md:col-span-7",
                    8: "md:col-span-8",
                    9: "md:col-span-9",
                    10: "md:col-span-10"
                };
                const colClass = colMap[cols] || "md:col-span-4";
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `${colClass} flex flex-col`,
                    style: {
                        gridRowEnd: `span ${rows}`
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ArticleCard$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                        article: article,
                        className: "h-full font-sans",
                        hideSummary: false,
                        cols: cols,
                        rows: rows,
                        currentDate: currentDate
                    }, void 0, false, {
                        fileName: "[project]/src/components/ArticleDisplay.tsx",
                        lineNumber: 184,
                        columnNumber: 29
                    }, this)
                }, key, false, {
                    fileName: "[project]/src/components/ArticleDisplay.tsx",
                    lineNumber: 179,
                    columnNumber: 25
                }, this);
            })
        }, void 0, false, {
            fileName: "[project]/src/components/ArticleDisplay.tsx",
            lineNumber: 132,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ArticleDisplay.tsx",
        lineNumber: 130,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/ThemeToggle.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ThemeToggle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/moon.js [app-ssr] (ecmascript) <export default as Moon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sun.js [app-ssr] (ecmascript) <export default as Sun>");
'use client';
;
;
;
function ThemeToggle() {
    const [isDark, setIsDark] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setMounted(true);
        // 로컬 스토리지에서 테마 설정 불러오기
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || !savedTheme && prefersDark) {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        }
    }, []);
    const toggleTheme = ()=>{
        const newIsDark = !isDark;
        setIsDark(newIsDark);
        if (newIsDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };
    // SSR 깜빡임 방지
    if (!mounted) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            className: "p-2 rounded-full bg-muted/50 w-9 h-9",
            "aria-label": "테마 전환",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "sr-only",
                children: "테마 로딩중"
            }, void 0, false, {
                fileName: "[project]/src/components/ThemeToggle.tsx",
                lineNumber: 39,
                columnNumber: 17
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/ThemeToggle.tsx",
            lineNumber: 38,
            columnNumber: 13
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: toggleTheme,
        className: "p-2 rounded-full bg-muted/50 hover:bg-muted transition-all duration-300 group",
        "aria-label": isDark ? '라이트 모드로 전환' : '다크 모드로 전환',
        title: isDark ? '라이트 모드' : '다크 모드',
        children: isDark ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__["Sun"], {
            className: "w-5 h-5 text-yellow-400 group-hover:rotate-90 transition-transform duration-300"
        }, void 0, false, {
            fileName: "[project]/src/components/ThemeToggle.tsx",
            lineNumber: 52,
            columnNumber: 17
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__["Moon"], {
            className: "w-5 h-5 text-slate-600 group-hover:-rotate-12 transition-transform duration-300"
        }, void 0, false, {
            fileName: "[project]/src/components/ThemeToggle.tsx",
            lineNumber: 54,
            columnNumber: 17
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ThemeToggle.tsx",
        lineNumber: 45,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/CategoryNav.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CategoryNav
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
'use client';
;
;
const categories = [
    {
        id: 'ai',
        label: 'AI',
        href: '/?category=ai'
    }
];
function CategoryNav() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: "w-full",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "max-w-7xl mx-auto px-4 md:px-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "flex items-center justify-center gap-6 md:gap-10 overflow-x-auto py-2 no-scrollbar",
                children: categories.map((category)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "shrink-0",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            href: category.href,
                            className: "text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors font-sans",
                            children: category.label
                        }, void 0, false, {
                            fileName: "[project]/src/components/CategoryNav.tsx",
                            lineNumber: 17,
                            columnNumber: 29
                        }, this)
                    }, category.id, false, {
                        fileName: "[project]/src/components/CategoryNav.tsx",
                        lineNumber: 16,
                        columnNumber: 25
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/CategoryNav.tsx",
                lineNumber: 14,
                columnNumber: 17
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/CategoryNav.tsx",
            lineNumber: 13,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/CategoryNav.tsx",
        lineNumber: 12,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/Header.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Header
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ThemeToggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ThemeToggle.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$CategoryNav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/CategoryNav.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
function Header({ currentDate, editionName }) {
    // 날짜 포맷팅 함수
    const formatDate = (dateStr)=>{
        const [year, month, day] = dateStr.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        const weekdays = [
            '일요일',
            '월요일',
            '화요일',
            '수요일',
            '목요일',
            '금요일',
            '토요일'
        ];
        const weekday = weekdays[localDate.getDay()];
        return `${year}년 ${month}월 ${day}일 ${weekday}`;
    };
    // 회차 표시 (edition_name이 "1호" 형태면 "제 1호"로 변환)
    const formatEdition = (name)=>{
        if (name.endsWith('호')) {
            const num = name.replace('호', '');
            return `제 ${num}호`;
        }
        return name;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
        className: "sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b border-border/40 shadow-sm transition-all duration-300 ease-in-out",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                href: "/",
                className: "absolute left-4 top-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                    src: "/logo.png",
                    alt: "ZED",
                    width: 160,
                    height: 160,
                    className: "object-contain",
                    style: {
                        width: 'auto',
                        height: 'auto',
                        maxHeight: '100px'
                    },
                    priority: true
                }, void 0, false, {
                    fileName: "[project]/src/components/Header.tsx",
                    lineNumber: 39,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 38,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-4 top-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ThemeToggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                    fileName: "[project]/src/components/Header.tsx",
                    lineNumber: 52,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 51,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col items-center max-w-7xl mx-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "font-black tracking-tighter text-foreground font-sans leading-none flex items-center gap-1 md:gap-2 justify-center text-4xl md:text-6xl",
                        children: [
                            "ZeroEcho",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-teal-500 inline-flex self-end mb-1 md:mb-2"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Header.tsx",
                                lineNumber: 58,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-light italic text-muted-foreground tracking-normal font-serif text-2xl md:text-4xl",
                                children: "Daily"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Header.tsx",
                                lineNumber: 59,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 56,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col items-center mt-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm font-bold tracking-[0.1em] text-muted-foreground font-sans",
                                children: [
                                    editionName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-teal-600 dark:text-teal-400",
                                        children: formatEdition(editionName)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/Header.tsx",
                                        lineNumber: 64,
                                        columnNumber: 41
                                    }, this),
                                    editionName && currentDate && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "mx-2",
                                        children: "•"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/Header.tsx",
                                        lineNumber: 65,
                                        columnNumber: 56
                                    }, this),
                                    currentDate ? formatDate(currentDate) : 'Loading...'
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/Header.tsx",
                                lineNumber: 63,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-sans relative group/slogan cursor-help inline-flex items-center gap-1",
                                children: [
                                    "Pure Signal, Zero Echo",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-teal-500/60 hover:text-teal-500 transition-colors",
                                        children: "?"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/Header.tsx",
                                        lineNumber: 70,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "absolute left-1/2 -translate-x-1/2 top-full mt-2 px-4 py-3 bg-white/95 dark:bg-zinc-900/95 text-foreground text-[11px] font-normal normal-case tracking-normal rounded-xl shadow-2xl border border-border w-64 opacity-0 invisible group-hover/slogan:opacity-100 group-hover/slogan:visible transition-all duration-200 z-[100] text-center leading-relaxed",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-bold text-teal-600 dark:text-teal-400 block mb-1",
                                                children: "What's ZS (Zero Score)?"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/Header.tsx",
                                                lineNumber: 73,
                                                columnNumber: 29
                                            }, this),
                                            "기사의 노이즈 억제 점수입니다.",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                                fileName: "[project]/src/components/Header.tsx",
                                                lineNumber: 74,
                                                columnNumber: 46
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-emerald-500 font-semibold",
                                                children: "낮을수록"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/Header.tsx",
                                                lineNumber: 75,
                                                columnNumber: 29
                                            }, this),
                                            " 기존 미디어에서 반복되지 않은",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                                fileName: "[project]/src/components/Header.tsx",
                                                lineNumber: 75,
                                                columnNumber: 106
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-teal-600 dark:text-teal-400 font-semibold",
                                                children: "신선하고 독창적인 정보"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/Header.tsx",
                                                lineNumber: 76,
                                                columnNumber: 29
                                            }, this),
                                            "예요 ✨",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white dark:border-b-zinc-900"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/Header.tsx",
                                                lineNumber: 77,
                                                columnNumber: 29
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/Header.tsx",
                                        lineNumber: 72,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/Header.tsx",
                                lineNumber: 68,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 62,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-3 pt-2 border-t border-border/40",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$CategoryNav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                            fileName: "[project]/src/components/Header.tsx",
                            lineNumber: 84,
                            columnNumber: 21
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 83,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 55,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Header.tsx",
        lineNumber: 34,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/ContactModal.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ContactModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/send.js [app-ssr] (ecmascript) <export default as Send>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-ssr] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-ssr] (ecmascript) <export default as CheckCircle2>");
'use client';
;
;
;
function ContactModal({ isOpen, onClose }) {
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('idle');
    // Reset state when modal opens
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isOpen) {
            setMessage('');
            setStatus('idle');
        }
    }, [
        isOpen
    ]);
    const handleSubmit = async (e)=>{
        e.preventDefault();
        if (!message.trim()) return;
        setStatus('loading');
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message
                })
            });
            if (response.ok) {
                setStatus('success');
                setTimeout(()=>{
                    onClose();
                }, 2000);
            } else {
                setStatus('error');
            }
        } catch (error) {
            setStatus('error');
        }
    };
    if (!isOpen) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between p-4 border-b border-border",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "font-bold text-lg font-serif",
                            children: "Send us a message"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ContactModal.tsx",
                            lineNumber: 55,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "text-muted-foreground hover:text-foreground transition-colors",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "w-5 h-5"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ContactModal.tsx",
                                lineNumber: 60,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/ContactModal.tsx",
                            lineNumber: 56,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ContactModal.tsx",
                    lineNumber: 54,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "p-4",
                    children: status === 'success' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col items-center justify-center py-8 text-center gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                    className: "w-6 h-6"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ContactModal.tsx",
                                    lineNumber: 69,
                                    columnNumber: 33
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/ContactModal.tsx",
                                lineNumber: 68,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                className: "font-bold text-lg",
                                children: "Message Sent!"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ContactModal.tsx",
                                lineNumber: 71,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-muted-foreground text-sm",
                                children: "Thank you for your feedback."
                            }, void 0, false, {
                                fileName: "[project]/src/components/ContactModal.tsx",
                                lineNumber: 72,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ContactModal.tsx",
                        lineNumber: 67,
                        columnNumber: 25
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: handleSubmit,
                        className: "flex flex-col gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        htmlFor: "message",
                                        className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                                        children: "Your Message"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/ContactModal.tsx",
                                        lineNumber: 77,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                        id: "message",
                                        value: message,
                                        onChange: (e)=>setMessage(e.target.value),
                                        placeholder: "Tell us what you think...",
                                        className: "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
                                        disabled: status === 'loading'
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/ContactModal.tsx",
                                        lineNumber: 80,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/ContactModal.tsx",
                                lineNumber: 76,
                                columnNumber: 29
                            }, this),
                            status === 'error' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs text-destructive",
                                children: "Failed to send message. Please try again."
                            }, void 0, false, {
                                fileName: "[project]/src/components/ContactModal.tsx",
                                lineNumber: 91,
                                columnNumber: 33
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-end gap-2 pt-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: onClose,
                                        className: "px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
                                        disabled: status === 'loading',
                                        children: "Cancel"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/ContactModal.tsx",
                                        lineNumber: 95,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "submit",
                                        disabled: !message.trim() || status === 'loading',
                                        className: "px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2",
                                        children: status === 'loading' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                    className: "w-4 h-4 animate-spin"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/ContactModal.tsx",
                                                    lineNumber: 109,
                                                    columnNumber: 43
                                                }, this),
                                                " Sending..."
                                            ]
                                        }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"], {
                                                    className: "w-4 h-4"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/ContactModal.tsx",
                                                    lineNumber: 111,
                                                    columnNumber: 43
                                                }, this),
                                                " Send Message"
                                            ]
                                        }, void 0, true)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/ContactModal.tsx",
                                        lineNumber: 103,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/ContactModal.tsx",
                                lineNumber: 94,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ContactModal.tsx",
                        lineNumber: 75,
                        columnNumber: 25
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/ContactModal.tsx",
                    lineNumber: 65,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ContactModal.tsx",
            lineNumber: 52,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ContactModal.tsx",
        lineNumber: 51,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/config/legalDocuments.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"legal\":{\"termsOfService\":{\"id\":\"terms\",\"title\":\"서비스 이용약관\",\"titleEn\":\"Terms of Service\",\"publisher\":\"ZeroEchoDaily.com\",\"lastUpdated\":\"2025-12-10\",\"sections\":[{\"number\":1,\"title\":\"목적\",\"content\":\"본 약관은 ZeroEcho Daily(이하 \\\"회사\\\")가 제공하는 뉴스 요약 및 평가 서비스(이하 \\\"서비스\\\") 이용에 관한 조건을 규정한다. 사용자가 서비스를 이용함으로써 본 약관에 동의한 것으로 간주한다.\"},{\"number\":2,\"title\":\"서비스의 성격 (AI 기반 정보)\",\"content\":\"본 서비스는 인공지능 분석 기술(MLL Engine)을 활용하여 기사 요약 및 평가 정보를 제공한다.\",\"subsections\":[{\"subtitle\":\"비보증\",\"content\":\"AI가 생성한 정보는 오류·누락·오해가 포함될 수 있으며, 회사는 정확성·완전성·무결성을 보증하지 않는다.\"},{\"subtitle\":\"참고 목적\",\"content\":\"서비스의 요약 및 점수는 참고 자료이며, 사실 확인은 반드시 원문을 통해 사용자가 직접 수행해야 한다.\"}]},{\"number\":3,\"title\":\"지적재산권 및 콘텐츠 이용\",\"subsections\":[{\"subtitle\":\"회사 콘텐츠\",\"content\":\"회사가 생성한 요약문·평가 지표·태그 등의 저작권은 회사에 귀속된다.\"},{\"subtitle\":\"원문 콘텐츠\",\"content\":\"원문 뉴스의 저작권은 해당 언론사 또는 원저작자에게 귀속된다. 회사는 단순 링크 제공 및 저작권법 제28조의 '정당한 인용' 범위 내에서 요약 정보를 제공한다.\"},{\"subtitle\":\"이용 제한\",\"content\":\"사용자는 서비스 콘텐츠를 영리 목적으로 무단 복제·배포·크롤링하거나 제3자에게 제공할 수 없다.\"}]},{\"number\":4,\"title\":\"면책 조항\",\"subsections\":[{\"content\":\"회사는 서비스 정보에 의존하여 발생한 투자·법률·의료·기타 손해에 대해 책임을 지지 않는다.\"},{\"content\":\"회사는 천재지변, 시스템 오류, 운영상 필요로 인한 서비스 일시 중단·변경에 대해 책임을 지지 않는다.\"}]},{\"number\":5,\"title\":\"저작권 보호 및 게시 중단 요청\",\"content\":\"원저작권자는 자신의 저작물이 서비스에 노출되는 것을 원하지 않을 경우, 서비스 내 'Send us a message' 기능을 통해 중단을 요청할 수 있다. 회사는 요청을 확인한 후 합리적인 범위에서 해당 콘텐츠를 제외하거나 수정한다.\"},{\"number\":6,\"title\":\"약관의 변경\",\"content\":\"회사는 필요 시 본 약관을 수정할 수 있으며, 변경 내용은 사이트 공지를 통해 적용된다. 중요한 변경 사항이 있는 경우 별도 안내할 수 있다.\"}]},\"privacyPolicy\":{\"id\":\"privacy\",\"title\":\"개인정보처리방침\",\"titleEn\":\"Privacy Policy\",\"publisher\":\"ZeroEchoDaily.com\",\"lastUpdated\":\"2025-12-10\",\"sections\":[{\"number\":1,\"title\":\"개요\",\"content\":\"ZeroEcho Daily(이하 \\\"ZED\\\")는 사용자의 개인정보 보호를 중요하게 여기며, 대한민국 개인정보보호법 등 관련 법령을 준수한다. ZED는 회원 가입 또는 계정 생성을 요구하지 않으며, 직접적인 개인 식별 정보는 수집하지 않는다.\"},{\"number\":2,\"title\":\"수집하는 정보의 항목\",\"content\":\"서비스 운영 및 보안 강화를 위해 아래의 기술적 정보가 자동으로 수집될 수 있다. 이러한 정보는 단독으로 특정 개인을 식별하지 않으며, 식별 목적으로 사용하지 않는다.\",\"subsections\":[{\"content\":\"접속 로그(IP 주소, 접속 일시, 서비스 이용 기록)\"},{\"content\":\"기기 정보(운영체제, 브라우저 종류 및 버전, 화면 해상도)\"},{\"subtitle\":\"쿠키(Cookies)\",\"content\":\"서비스 이용 편의 제공을 위한 기본 쿠키만 사용하며, 광고 목적의 쿠키는 사용하지 않음\"}]},{\"number\":3,\"title\":\"정보의 수집 목적\",\"content\":\"수집된 기술적 정보는 아래 목적에 한해 활용된다.\",\"subsections\":[{\"content\":\"서비스 안정성 유지 및 트래픽 분석\"},{\"content\":\"비정상적 접근 및 보안 위협 탐지\"},{\"content\":\"사용자 환경에 최적화된 웹페이지 제공\"}]},{\"number\":4,\"title\":\"제3자 서비스 이용\",\"content\":\"ZED는 안정적인 서비스 제공을 위해 다음의 외부 서비스를 사용할 수 있다. 이들 서비스 제공자는 각자의 개인정보처리방침에 따라 데이터를 처리한다.\",\"subsections\":[{\"content\":\"Google Firebase: 호스팅 및 기본 데이터 관리\"},{\"content\":\"Vercel Analytics(선택적): 비식별 통계 분석\"}]},{\"number\":5,\"title\":\"쿠키 관리\",\"content\":\"사용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있다. 단, 일부 기능이 제한될 수 있다.\"},{\"number\":6,\"title\":\"이용자 권리\",\"content\":\"ZED는 개인 식별 정보를 수집하지 않으므로, 열람·정정·삭제 요청은 기술적 로그 범위 내에서만 처리될 수 있다. 기타 문의는 서비스 내 'Send us a message'를 통해 접수할 수 있다.\"},{\"number\":7,\"title\":\"개인정보처리방침의 변경\",\"content\":\"본 방침은 서비스 운영 환경 변화에 따라 수정될 수 있으며, 변경 사항은 본 문서에 즉시 반영된다.\"}]},\"legalDisclaimer\":{\"id\":\"disclaimer\",\"title\":\"법적 고지 및 면책 조항\",\"titleEn\":\"Legal Disclaimer\",\"publisher\":\"ZeroEchoDaily.com\",\"lastUpdated\":\"2025-12-10\",\"sections\":[{\"number\":1,\"title\":\"서비스 개요\",\"content\":\"ZeroEcho Daily는 누구나 별도 회원가입 없이 이용할 수 있는 뉴스 요약 및 기사 평가 서비스입니다. ZeroEcho Daily는 정보 제공 목적의 서비스로, 회원제 기능이나 계정 관리 기능을 제공하지 않습니다. 사용자는 제공된 뉴스를 참고 자료로 활용할 수 있으며, 이 서비스는 무료로 제공됩니다.\"},{\"number\":2,\"title\":\"책임의 한계\",\"content\":\"ZeroEcho Daily가 제공하는 모든 콘텐츠는 참고용으로 \\\"있는 그대로\\\" 제공됩니다. 콘텐츠의 정확성, 완전성, 최신성 등은 보증되지 않으며, 사용자의 목적에 대한 적합성을 따로 확인할 책임이 사용자에게 있습니다. ZeroEcho Daily와 발행인 ZeroEchoDaily.com은 서비스 이용으로 인해 발생한 어떠한 직접적·간접적 손해에 대해서도 책임을 지지 않습니다.\"},{\"number\":3,\"title\":\"저작권 및 콘텐츠 이용\",\"content\":\"제공되는 뉴스 요약 및 평가 내용은 원저작자의 저작권을 존중하여 사용됩니다. 한국 저작권법 제28조에 따라 보도·비평·교육·연구 등의 목적으로 공표된 저작물은 정당한 범위 내에서 인용할 수 있습니다. 따라서 ZeroEcho Daily는 뉴스 기사의 전문을 복제하지 않고 핵심 내용을 요약하며, 출처를 명시합니다. 그러나 기사 전체의 단순한 복제나 최소한의 변경만으로는 저작권 침해에 해당될 수 있음을 유의해야 합니다.\",\"subsections\":[{\"content\":\"ZeroEcho Daily는 가능한 경우 기사 제목과 요약문, 원문 링크를 함께 제공하며, 이는 선행 판례에서 비영리 목적의 인용으로 인정된 방식입니다.\"},{\"content\":\"모든 콘텐츠는 저작권법의 보호를 받으며, 무단 복제·배포·전재는 금지됩니다.\"},{\"content\":\"원저작권자의 요청이나 저작권 침해 신고가 접수될 경우, ZeroEcho Daily는 해당 콘텐츠를 신속히 게시 중단 또는 삭제합니다.\"}]},{\"number\":4,\"title\":\"외부 링크\",\"content\":\"ZeroEcho Daily는 추가적인 정보 제공을 위해 제3자 웹사이트로 연결되는 링크를 포함할 수 있습니다. 링크된 사이트의 콘텐츠와 서비스는 ZeroEcho Daily의 통제 대상이 아니며, 해당 사이트 운영자가 그 책임을 집니다. 따라서 ZeroEcho Daily는 외부 링크에 포함된 내용이나 서비스의 정확성, 안정성 등에 대해 어떠한 보증이나 책임도 지지 않습니다.\"},{\"number\":5,\"title\":\"광고 및 제휴\",\"content\":\"ZeroEcho Daily는 광고 혹은 제휴 콘텐츠를 포함할 수 있습니다. 모든 광고성 콘텐츠는 독자에게 명확히 표시되며, 상업적 이해관계가 있을 경우 이를 고지합니다. 광고나 제휴 링크로 인한 금전적 대가가 있을 경우 독자에게 알리는 등 투명성을 유지합니다. 광고 및 제휴 콘텐츠는 일반 편집 콘텐츠와 구분되어 운영되며, 사용자의 콘텐츠 소비에 영향을 미치지 않습니다.\"},{\"number\":6,\"title\":\"전문가 조언이 아님\",\"content\":\"ZeroEcho Daily의 모든 뉴스 요약 및 평가는 일반 정보 제공을 목적으로 합니다. 법률·재정·의료·기술 등 특정 분야의 전문적 조언이나 상담을 제공하는 것이 아닙니다. 제공된 정보를 토대로 한 결정 또는 행동은 전적으로 사용자 책임입니다. 전문적인 조언이 필요한 경우 해당 분야의 전문가에게 별도로 상담을 받아야 합니다.\"},{\"number\":7,\"title\":\"AI 관련 유의사항\",\"content\":\"ZeroEcho Daily는 인공지능(AI) 기술을 활용하여 콘텐츠를 생성하거나 보조할 수 있습니다. AI는 학습 데이터에 기반해 정보를 생성하지만, 때로는 실제 사실과 다르거나 존재하지 않는 내용을 사실처럼 제시하는 \\\"환각(Hallucination)\\\" 현상이 발생할 수 있습니다. 따라서 AI가 생성한 요약은 참고용으로만 활용해야 하며, 중요한 정보는 추가 검증 및 교차 확인을 거쳐야 합니다. ZeroEcho Daily는 AI로 인한 오류 가능성을 사전에 안내하며, AI 결과에 대한 신뢰도는 사용자 스스로 판단해야 합니다.\"},{\"number\":8,\"title\":\"저작자 요청 처리\",\"content\":\"원저작자가 자신들의 저작물이 ZeroEcho Daily에 의해 사용된 것에 대해 이의를 제기하는 경우, 서비스 내 'Send us a message' 기능을 통해 요청할 수 있습니다. 접수된 요청은 신속하게 검토되며, 합리적인 범위에서 필요한 조치를 취합니다. 통상 요청 접수일로부터 30일 이내에 검토 결과를 안내하며, 법적 요구사항 및 서비스 운영 상황에 따라 게시 중단·삭제 등 적절한 조치를 취할 수 있습니다. 이 과정에서 발생할 수 있는 책임의 여부는 해당 법률 판단에 따르며, ZeroEcho Daily는 처리 의무를 이행하기 위해 노력할 뿐 추가적인 책임을 부담하지 않습니다.\"}],\"footer\":\"※ 이 고지는 필요에 따라 사전 예고 없이 수정될 수 있으며, 최신 내용은 본 문서의 최종 수정일을 참고하시기 바랍니다.\"}}}"));}),
"[project]/src/components/LegalModal.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LegalModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-ssr] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-ssr] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scale$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Scale$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/scale.js [app-ssr] (ecmascript) <export default as Scale>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-left.js [app-ssr] (ecmascript) <export default as ChevronLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$legalDocuments$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/config/legalDocuments.json (json)");
'use client';
;
;
;
;
const documentIcons = {
    terms: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
    privacy: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"],
    disclaimer: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scale$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Scale$3e$__["Scale"]
};
const documentKeys = {
    terms: 'termsOfService',
    privacy: 'privacyPolicy',
    disclaimer: 'legalDisclaimer'
};
function LegalModal({ isOpen, onClose, initialDocument }) {
    const [selectedDocument, setSelectedDocument] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialDocument || null);
    // Reset state when modal opens
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isOpen) {
            setSelectedDocument(initialDocument || null);
        }
    }, [
        isOpen,
        initialDocument
    ]);
    if (!isOpen) return null;
    const documents = [
        {
            type: 'terms',
            doc: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$legalDocuments$2e$json__$28$json$29$__["default"].legal.termsOfService
        },
        {
            type: 'privacy',
            doc: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$legalDocuments$2e$json__$28$json$29$__["default"].legal.privacyPolicy
        },
        {
            type: 'disclaimer',
            doc: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$legalDocuments$2e$json__$28$json$29$__["default"].legal.legalDisclaimer
        }
    ];
    const currentDoc = selectedDocument ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$legalDocuments$2e$json__$28$json$29$__["default"].legal[documentKeys[selectedDocument]] : null;
    const renderDocumentList = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-4 space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-muted-foreground mb-4",
                    children: "ZeroEcho Daily 서비스 이용과 관련된 법적 문서입니다."
                }, void 0, false, {
                    fileName: "[project]/src/components/LegalModal.tsx",
                    lineNumber: 72,
                    columnNumber: 13
                }, this),
                documents.map(({ type, doc })=>{
                    const Icon = documentIcons[type];
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setSelectedDocument(type),
                        className: "w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left group",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white transition-colors",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                    className: "w-5 h-5"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/LegalModal.tsx",
                                    lineNumber: 84,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/LegalModal.tsx",
                                lineNumber: 83,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                        className: "font-bold text-sm",
                                        children: doc.title
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/LegalModal.tsx",
                                        lineNumber: 87,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-muted-foreground",
                                        children: doc.titleEn
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/LegalModal.tsx",
                                        lineNumber: 88,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/LegalModal.tsx",
                                lineNumber: 86,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-muted-foreground",
                                children: doc.lastUpdated
                            }, void 0, false, {
                                fileName: "[project]/src/components/LegalModal.tsx",
                                lineNumber: 90,
                                columnNumber: 25
                            }, this)
                        ]
                    }, type, true, {
                        fileName: "[project]/src/components/LegalModal.tsx",
                        lineNumber: 78,
                        columnNumber: 21
                    }, this);
                })
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/LegalModal.tsx",
            lineNumber: 71,
            columnNumber: 9
        }, this);
    const renderDocumentContent = ()=>{
        if (!currentDoc) return null;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-col h-full max-h-[70vh]",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "p-4 border-b border-border bg-accent/30",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setSelectedDocument(null),
                            className: "flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                                    className: "w-4 h-4"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/LegalModal.tsx",
                                    lineNumber: 110,
                                    columnNumber: 25
                                }, this),
                                "목록으로"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/LegalModal.tsx",
                            lineNumber: 106,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "font-bold text-lg",
                            children: currentDoc.title
                        }, void 0, false, {
                            fileName: "[project]/src/components/LegalModal.tsx",
                            lineNumber: 113,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-muted-foreground mt-1",
                            children: [
                                "발행인: ",
                                currentDoc.publisher,
                                " | 최종 수정일: ",
                                currentDoc.lastUpdated
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/LegalModal.tsx",
                            lineNumber: 114,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/LegalModal.tsx",
                    lineNumber: 105,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 overflow-y-auto p-4 space-y-6",
                    children: [
                        currentDoc.sections.map((section, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: [
                                    section.number && section.title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                        className: "font-bold text-sm text-teal-600 dark:text-teal-400",
                                        children: [
                                            section.number,
                                            ". ",
                                            section.title
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/LegalModal.tsx",
                                        lineNumber: 124,
                                        columnNumber: 33
                                    }, this),
                                    section.content && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-foreground/90 leading-relaxed",
                                        children: section.content
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/LegalModal.tsx",
                                        lineNumber: 129,
                                        columnNumber: 33
                                    }, this),
                                    section.subsections && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "space-y-2 pl-4",
                                        children: section.subsections.map((sub, subIdx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "text-sm text-foreground/80",
                                                children: [
                                                    sub.subtitle && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "font-semibold",
                                                        children: [
                                                            sub.subtitle,
                                                            ": "
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/LegalModal.tsx",
                                                        lineNumber: 138,
                                                        columnNumber: 49
                                                    }, this),
                                                    sub.content
                                                ]
                                            }, subIdx, true, {
                                                fileName: "[project]/src/components/LegalModal.tsx",
                                                lineNumber: 136,
                                                columnNumber: 41
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/LegalModal.tsx",
                                        lineNumber: 134,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, idx, true, {
                                fileName: "[project]/src/components/LegalModal.tsx",
                                lineNumber: 122,
                                columnNumber: 25
                            }, this)),
                        currentDoc.footer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "pt-4 border-t border-border",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs text-muted-foreground italic",
                                children: currentDoc.footer
                            }, void 0, false, {
                                fileName: "[project]/src/components/LegalModal.tsx",
                                lineNumber: 150,
                                columnNumber: 29
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/LegalModal.tsx",
                            lineNumber: 149,
                            columnNumber: 25
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/LegalModal.tsx",
                    lineNumber: 120,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/LegalModal.tsx",
            lineNumber: 103,
            columnNumber: 13
        }, this);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between p-4 border-b border-border",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "font-bold text-lg font-serif",
                            children: selectedDocument ? '법적 문서' : 'Legal Documents'
                        }, void 0, false, {
                            fileName: "[project]/src/components/LegalModal.tsx",
                            lineNumber: 165,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "text-muted-foreground hover:text-foreground transition-colors",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "w-5 h-5"
                            }, void 0, false, {
                                fileName: "[project]/src/components/LegalModal.tsx",
                                lineNumber: 172,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/LegalModal.tsx",
                            lineNumber: 168,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/LegalModal.tsx",
                    lineNumber: 164,
                    columnNumber: 17
                }, this),
                selectedDocument ? renderDocumentContent() : renderDocumentList()
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/LegalModal.tsx",
            lineNumber: 162,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/LegalModal.tsx",
        lineNumber: 161,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/Footer.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Footer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$dom$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-dom.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/mail.js [app-ssr] (ecmascript) <export default as Mail>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ContactModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ContactModal.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$LegalModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/LegalModal.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
function Footer() {
    const [isContactModalOpen, setIsContactModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isLegalModalOpen, setIsLegalModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [initialLegalDocument, setInitialLegalDocument] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(undefined);
    const openLegalModal = (docType)=>{
        setInitialLegalDocument(docType);
        setIsLegalModalOpen(true);
    };
    // 모달을 body 레벨에 렌더링하기 위한 Portal 컴포넌트
    const renderModals = ()=>{
        if ("TURBOPACK compile-time truthy", 1) return null;
        //TURBOPACK unreachable
        ;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
                className: "w-full border-t border-border mt-20 bg-card/50",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-7xl mx-auto px-4 md:px-8 py-12",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-1 md:grid-cols-3 gap-12",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "font-black text-2xl tracking-tighter font-serif",
                                            children: [
                                                "ZeroEcho",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-teal-500",
                                                    children: "."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/Footer.tsx",
                                                    lineNumber: 52,
                                                    columnNumber: 41
                                                }, this),
                                                "Daily"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/Footer.tsx",
                                            lineNumber: 51,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-muted-foreground text-sm leading-relaxed max-w-xs font-sans",
                                            children: "Curated high-importance news from around the world, delivered without the echo."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Footer.tsx",
                                            lineNumber: 54,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Footer.tsx",
                                    lineNumber: 50,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-4 items-start",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                            className: "font-bold uppercase tracking-widest text-sm font-sans",
                                            children: "Connect"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Footer.tsx",
                                            lineNumber: 61,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setIsContactModalOpen(true),
                                            className: "px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-full transition-all shadow-sm hover:shadow-md flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__["Mail"], {
                                                    className: "w-4 h-4"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/Footer.tsx",
                                                    lineNumber: 66,
                                                    columnNumber: 33
                                                }, this),
                                                " Send us a message"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/Footer.tsx",
                                            lineNumber: 62,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Footer.tsx",
                                    lineNumber: 60,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-4 md:text-right",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                            className: "font-bold uppercase tracking-widest text-sm font-sans",
                                            children: "Legal"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Footer.tsx",
                                            lineNumber: 72,
                                            columnNumber: 29
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col gap-2 md:items-end",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>openLegalModal('disclaimer'),
                                                    className: "text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-sm text-left md:text-right",
                                                    children: "Legal Notice"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/Footer.tsx",
                                                    lineNumber: 74,
                                                    columnNumber: 33
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>openLegalModal('privacy'),
                                                    className: "text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-sm text-left md:text-right",
                                                    children: "Privacy Policy"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/Footer.tsx",
                                                    lineNumber: 80,
                                                    columnNumber: 33
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>openLegalModal('terms'),
                                                    className: "text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-sm text-left md:text-right",
                                                    children: "Terms of Service"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/Footer.tsx",
                                                    lineNumber: 86,
                                                    columnNumber: 33
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/Footer.tsx",
                                            lineNumber: 73,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Footer.tsx",
                                    lineNumber: 71,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Footer.tsx",
                            lineNumber: 48,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-12 pt-8 border-t border-border/50 text-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-muted-foreground",
                                    children: [
                                        "© ",
                                        new Date().getFullYear(),
                                        " ZeroEchoDaily.com. All rights reserved."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Footer.tsx",
                                    lineNumber: 98,
                                    columnNumber: 25
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-muted-foreground mt-1",
                                    children: "ZeroEcho.Daily is published by ZeroEchoDaily.com."
                                }, void 0, false, {
                                    fileName: "[project]/src/components/Footer.tsx",
                                    lineNumber: 101,
                                    columnNumber: 25
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/Footer.tsx",
                            lineNumber: 97,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/Footer.tsx",
                    lineNumber: 47,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/Footer.tsx",
                lineNumber: 46,
                columnNumber: 13
            }, this),
            renderModals()
        ]
    }, void 0, true);
}
}),
"[project]/src/components/TrendingKeywords.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>TrendingKeywords
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trending-up.js [app-ssr] (ecmascript) <export default as TrendingUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$hash$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Hash$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/hash.js [app-ssr] (ecmascript) <export default as Hash>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
// Calculate tag frequencies from articles
const calculateTagFrequencies = (articles)=>{
    const tagCounts = {};
    articles.forEach((article)=>{
        article.tags?.forEach((tag)=>{
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    return Object.entries(tagCounts).map(([tag, count])=>({
            tag,
            count
        })).sort((a, b)=>b.count - a.count);
};
// Tag display name mapping (actual tags from data)
const getTagDisplayName = (tag)=>{
    const displayNames = {
        'GEN_AI': 'Generative AI',
        'LLM': 'LLM',
        'BIZ_STRATEGY': 'Business',
        'REGULATION': 'Regulation',
        'AGENTS': 'AI Agents',
        'AI_CHIP': 'AI Chip',
        'WORK_IMPACT': 'Work Impact',
        'AI_ETHICS': 'AI Ethics',
        'DAILY_UPDATE': 'Daily Update',
        'RESEARCH': 'Research',
        'ROBOTICS': 'Robotics',
        'AUTONOMOUS': 'Autonomous',
        'VISION': 'Vision AI',
        'SPEECH': 'Speech AI',
        'EDGE_AI': 'Edge AI',
        'ML_OPS': 'MLOps'
    };
    return displayNames[tag] || tag.replace(/_/g, ' ');
};
// Rank badge colors
const getRankStyle = (rank)=>{
    switch(rank){
        case 1:
            return 'text-amber-500 font-black';
        case 2:
            return 'text-zinc-400 font-bold';
        case 3:
            return 'text-orange-700 font-bold';
        default:
            return 'text-zinc-500 font-medium';
    }
};
function TrendingKeywords({ articles, maxItems = 5 }) {
    const trendingTags = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].useMemo(()=>{
        return calculateTagFrequencies(articles).slice(0, maxItems);
    }, [
        articles,
        maxItems
    ]);
    // 태그가 없어도 컨테이너는 표시
    if (trendingTags.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2 mb-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"], {
                            className: "w-4 h-4 text-teal-500"
                        }, void 0, false, {
                            fileName: "[project]/src/components/TrendingKeywords.tsx",
                            lineNumber: 75,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "font-bold text-sm uppercase tracking-wider text-foreground",
                            children: "오늘의 트렌드"
                        }, void 0, false, {
                            fileName: "[project]/src/components/TrendingKeywords.tsx",
                            lineNumber: 76,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/TrendingKeywords.tsx",
                    lineNumber: 74,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xs text-muted-foreground text-center py-4",
                    children: "태그 데이터 준비 중..."
                }, void 0, false, {
                    fileName: "[project]/src/components/TrendingKeywords.tsx",
                    lineNumber: 80,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/TrendingKeywords.tsx",
            lineNumber: 73,
            columnNumber: 13
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 mb-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"], {
                        className: "w-4 h-4 text-teal-500"
                    }, void 0, false, {
                        fileName: "[project]/src/components/TrendingKeywords.tsx",
                        lineNumber: 90,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "font-bold text-sm uppercase tracking-wider text-foreground",
                        children: "오늘의 트렌드"
                    }, void 0, false, {
                        fileName: "[project]/src/components/TrendingKeywords.tsx",
                        lineNumber: 91,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/TrendingKeywords.tsx",
                lineNumber: 89,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-2",
                children: trendingTags.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors cursor-default",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: cn("text-sm w-5", getRankStyle(index + 1)),
                                        children: index + 1
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/TrendingKeywords.tsx",
                                        lineNumber: 103,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$hash$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Hash$3e$__["Hash"], {
                                        className: "w-3 h-3 text-muted-foreground"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/TrendingKeywords.tsx",
                                        lineNumber: 106,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-sm font-medium text-foreground break-words",
                                        children: item.tag
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/TrendingKeywords.tsx",
                                        lineNumber: 107,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/TrendingKeywords.tsx",
                                lineNumber: 102,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs text-muted-foreground bg-secondary/70 px-2 py-0.5 rounded-full",
                                children: [
                                    item.count,
                                    "건"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/TrendingKeywords.tsx",
                                lineNumber: 111,
                                columnNumber: 25
                            }, this)
                        ]
                    }, item.tag, true, {
                        fileName: "[project]/src/components/TrendingKeywords.tsx",
                        lineNumber: 98,
                        columnNumber: 21
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/TrendingKeywords.tsx",
                lineNumber: 96,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/TrendingKeywords.tsx",
        lineNumber: 88,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/IssueSelector.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>IssueSelector
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/calendar.js [app-ssr] (ecmascript) <export default as Calendar>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [app-ssr] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-ssr] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
// 날짜 포맷 유틸리티 ("12월 21일" 형식)
const formatDateKo = (dateStr)=>{
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${month}월 ${day}일`;
};
const INITIAL_ITEMS = 10; // 초기 표시 개수
const LOAD_MORE_COUNT = 10; // 추가 로드 개수
function IssueSelector({ issues, currentIssueId, onIssueSelect }) {
    const [isOpen, setIsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [visibleCount, setVisibleCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(INITIAL_ITEMS);
    const [isLoadingMore, setIsLoadingMore] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const dropdownRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const listRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const currentIssue = issues.find((i)=>i.id === currentIssueId);
    const displayIssues = issues.slice(0, visibleCount);
    const hasMore = visibleCount < issues.length;
    // 드롭다운 열릴 때 초기화
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isOpen) {
            setVisibleCount(INITIAL_ITEMS);
        }
    }, [
        isOpen
    ]);
    // 외부 클릭 시 드롭다운 닫기
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleClickOutside = (event)=>{
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return ()=>document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    // 스크롤 이벤트 핸들러 (무한 스크롤)
    const handleScroll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (!listRef.current || isLoadingMore || !hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        const scrollThreshold = 50; // 하단 50px 전에 로드 시작
        if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
            setIsLoadingMore(true);
            // 약간의 딜레이로 부드러운 로딩 효과
            setTimeout(()=>{
                setVisibleCount((prev)=>Math.min(prev + LOAD_MORE_COUNT, issues.length));
                setIsLoadingMore(false);
            }, 200);
        }
    }, [
        isLoadingMore,
        hasMore,
        issues.length
    ]);
    if (issues.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-card rounded-xl border border-border p-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__["Calendar"], {
                            className: "w-4 h-4 text-teal-500"
                        }, void 0, false, {
                            fileName: "[project]/src/components/IssueSelector.tsx",
                            lineNumber: 86,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-sm font-bold text-foreground",
                            children: "회차 선택"
                        }, void 0, false, {
                            fileName: "[project]/src/components/IssueSelector.tsx",
                            lineNumber: 87,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/IssueSelector.tsx",
                    lineNumber: 85,
                    columnNumber: 17
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xs text-muted-foreground text-center py-2 mt-2",
                    children: "발행된 회차가 없습니다."
                }, void 0, false, {
                    fileName: "[project]/src/components/IssueSelector.tsx",
                    lineNumber: 89,
                    columnNumber: 17
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/IssueSelector.tsx",
            lineNumber: 84,
            columnNumber: 13
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: dropdownRef,
        className: "relative bg-card rounded-xl border border-border p-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>setIsOpen(!isOpen),
                className: "w-full flex items-center justify-between gap-2 hover:bg-secondary/50 rounded-lg p-2 -m-2 transition-colors",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__["Calendar"], {
                                className: "w-4 h-4 text-teal-500"
                            }, void 0, false, {
                                fileName: "[project]/src/components/IssueSelector.tsx",
                                lineNumber: 104,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col items-start",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-sm font-bold text-foreground",
                                        children: currentIssue ? formatDateKo(currentIssue.date) : '회차 선택'
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/IssueSelector.tsx",
                                        lineNumber: 106,
                                        columnNumber: 25
                                    }, this),
                                    currentIssue && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[10px] text-muted-foreground",
                                        children: currentIssue.edition_name
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/IssueSelector.tsx",
                                        lineNumber: 110,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/IssueSelector.tsx",
                                lineNumber: 105,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/IssueSelector.tsx",
                        lineNumber: 103,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                        className: cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")
                    }, void 0, false, {
                        fileName: "[project]/src/components/IssueSelector.tsx",
                        lineNumber: 116,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/IssueSelector.tsx",
                lineNumber: 99,
                columnNumber: 13
            }, this),
            isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: listRef,
                onScroll: handleScroll,
                className: "absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto",
                children: [
                    issues.length > 0 && issues[0].id !== currentIssueId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>{
                            onIssueSelect(issues[0].id);
                            setIsOpen(false);
                        },
                        className: "w-full flex items-center justify-between py-2.5 px-3 transition-colors text-left rounded-t-lg bg-gradient-to-r from-teal-50 to-transparent dark:from-teal-950/50 dark:to-transparent hover:from-teal-100 dark:hover:from-teal-950/70 border-b border-border/50",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-base",
                                    children: "⚡"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/IssueSelector.tsx",
                                    lineNumber: 139,
                                    columnNumber: 33
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-sm font-bold text-teal-600 dark:text-teal-400",
                                            children: "최신호로 이동"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/IssueSelector.tsx",
                                            lineNumber: 141,
                                            columnNumber: 37
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: [
                                                formatDateKo(issues[0].date),
                                                " • ",
                                                issues[0].edition_name
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/IssueSelector.tsx",
                                            lineNumber: 144,
                                            columnNumber: 37
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/IssueSelector.tsx",
                                    lineNumber: 140,
                                    columnNumber: 33
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/IssueSelector.tsx",
                            lineNumber: 138,
                            columnNumber: 29
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/IssueSelector.tsx",
                        lineNumber: 131,
                        columnNumber: 25
                    }, this),
                    displayIssues.map((issue)=>{
                        const isActive = issue.id === currentIssueId;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>{
                                onIssueSelect(issue.id);
                                setIsOpen(false);
                            },
                            className: cn("w-full flex items-center justify-between py-2.5 px-3 transition-colors text-left", "first:rounded-t-lg", !hasMore && "last:rounded-b-lg", isActive ? "bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400" : "hover:bg-secondary/50 text-foreground"),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: cn("text-sm", isActive ? "font-bold" : "font-medium"),
                                            children: formatDateKo(issue.date)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/IssueSelector.tsx",
                                            lineNumber: 171,
                                            columnNumber: 37
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[10px] text-muted-foreground",
                                            children: [
                                                issue.edition_name,
                                                " • ",
                                                issue.article_count,
                                                "건"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/IssueSelector.tsx",
                                            lineNumber: 177,
                                            columnNumber: 37
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/IssueSelector.tsx",
                                    lineNumber: 170,
                                    columnNumber: 33
                                }, this),
                                isActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "w-2 h-2 rounded-full bg-primary"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/IssueSelector.tsx",
                                    lineNumber: 182,
                                    columnNumber: 37
                                }, this)
                            ]
                        }, issue.id, true, {
                            fileName: "[project]/src/components/IssueSelector.tsx",
                            lineNumber: 155,
                            columnNumber: 29
                        }, this);
                    }),
                    hasMore && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-center py-3 text-muted-foreground",
                        children: isLoadingMore ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                            className: "w-4 h-4 animate-spin"
                        }, void 0, false, {
                            fileName: "[project]/src/components/IssueSelector.tsx",
                            lineNumber: 192,
                            columnNumber: 33
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-xs",
                            children: "↓ 스크롤하여 더 보기"
                        }, void 0, false, {
                            fileName: "[project]/src/components/IssueSelector.tsx",
                            lineNumber: 194,
                            columnNumber: 33
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/IssueSelector.tsx",
                        lineNumber: 190,
                        columnNumber: 25
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/IssueSelector.tsx",
                lineNumber: 124,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/IssueSelector.tsx",
        lineNumber: 97,
        columnNumber: 9
    }, this);
}
}),
"[project]/src/components/PageFrame.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PageFrame
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Header.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Footer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Footer.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$TrendingKeywords$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/TrendingKeywords.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$IssueSelector$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/IssueSelector.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-left.js [app-ssr] (ecmascript) <export default as ChevronLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-right.js [app-ssr] (ecmascript) <export default as ChevronRight>");
;
;
;
;
;
;
function PageFrame({ children, currentDate, editionName, prevDate, prevEditionName, prevIssueId, nextDate, nextEditionName, nextIssueId, onDateChange, articles = [], issues = [], currentIssueId = null, onIssueSelect }) {
    // 날짜 포맷 유틸리티 ("12월 21일" 형식)
    const formatDateKo = (dateStr)=>{
        const [year, month, day] = dateStr.split('-').map(Number);
        return `${month}월 ${day}일`;
    };
    // 회차 포맷 ("12월 21일 1호" 형식)
    const formatEditionLabel = (dateStr, edition)=>{
        const datePart = formatDateKo(dateStr);
        if (edition) {
            return `${datePart} ${edition}`;
        }
        return datePart;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen bg-background text-foreground",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                currentDate: currentDate,
                editionName: editionName
            }, void 0, false, {
                fileName: "[project]/src/components/PageFrame.tsx",
                lineNumber: 62,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] min-h-[calc(100vh-200px)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "hidden lg:flex flex-col items-center pt-8 px-2 sticky top-[220px] self-start h-fit",
                        children: [
                            prevDate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>onDateChange(prevDate),
                                className: "flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                                        className: "w-10 h-10"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/PageFrame.tsx",
                                        lineNumber: 75,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-bold tracking-wide text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity",
                                        children: formatEditionLabel(prevDate, prevEditionName)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/PageFrame.tsx",
                                        lineNumber: 76,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 71,
                                columnNumber: 25
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-[72px]"
                            }, void 0, false, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 81,
                                columnNumber: 25
                            }, this),
                            issues.length > 0 && onIssueSelect && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-full px-2 mt-8",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$IssueSelector$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    issues: issues,
                                    currentIssueId: currentIssueId,
                                    onIssueSelect: onIssueSelect
                                }, void 0, false, {
                                    fileName: "[project]/src/components/PageFrame.tsx",
                                    lineNumber: 87,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 86,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/PageFrame.tsx",
                        lineNumber: 68,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col w-full max-w-7xl mx-auto px-4 md:px-8",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "lg:hidden flex justify-between items-center py-4 border-b border-border/50 mb-6",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>prevDate && onDateChange(prevDate),
                                        disabled: !prevDate,
                                        className: "flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-30",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                                                className: "w-4 h-4"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/PageFrame.tsx",
                                                lineNumber: 105,
                                                columnNumber: 29
                                            }, this),
                                            prevDate ? formatDateKo(prevDate) : '이전'
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/PageFrame.tsx",
                                        lineNumber: 100,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-bold text-teal-600 dark:text-teal-400",
                                        children: currentDate ? formatEditionLabel(currentDate, editionName) : ''
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/PageFrame.tsx",
                                        lineNumber: 108,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>nextDate && onDateChange(nextDate),
                                        disabled: !nextDate,
                                        className: "flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-30",
                                        children: [
                                            nextDate ? formatDateKo(nextDate) : '다음',
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                                                className: "w-4 h-4"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/PageFrame.tsx",
                                                lineNumber: 117,
                                                columnNumber: 29
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/PageFrame.tsx",
                                        lineNumber: 111,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 99,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                                className: "flex-1 py-6",
                                children: children
                            }, void 0, false, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 123,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/PageFrame.tsx",
                        lineNumber: 97,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "hidden lg:flex flex-col items-center pt-8 px-2 sticky top-[220px] self-start h-fit",
                        children: [
                            nextDate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>onDateChange(nextIssueId || nextDate),
                                className: "flex flex-col items-center gap-2 p-4 text-foreground transition-all rounded-lg group opacity-40 hover:opacity-100 hover:bg-card hover:shadow-lg",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                                        className: "w-10 h-10"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/PageFrame.tsx",
                                        lineNumber: 136,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-bold tracking-wide text-center leading-tight opacity-0 group-hover:opacity-100 transition-opacity",
                                        children: formatEditionLabel(nextDate, nextEditionName)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/PageFrame.tsx",
                                        lineNumber: 137,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 132,
                                columnNumber: 25
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-[72px]"
                            }, void 0, false, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 142,
                                columnNumber: 25
                            }, this),
                            articles.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-full px-2 mt-8",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$TrendingKeywords$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    articles: articles,
                                    maxItems: 8
                                }, void 0, false, {
                                    fileName: "[project]/src/components/PageFrame.tsx",
                                    lineNumber: 148,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/PageFrame.tsx",
                                lineNumber: 147,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/PageFrame.tsx",
                        lineNumber: 129,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/PageFrame.tsx",
                lineNumber: 65,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Footer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/src/components/PageFrame.tsx",
                lineNumber: 155,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/PageFrame.tsx",
        lineNumber: 60,
        columnNumber: 9
    }, this);
}
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

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
"[project]/src/components/HomePageClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>HomePageClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ArticleDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ArticleDisplay.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$PageFrame$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/PageFrame.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
function HomePageClient({ articles, issues = [] }) {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    // 회차별 그룹핑 로직 + 그룹별 어워드 재계산
    const { groupedByIssue, sortedIssueIds } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const grouped = {};
        // 기사를 publish_id(회차)별로 그룹핑
        articles.forEach((article)=>{
            const issueId = article.publish_id || 'unknown';
            if (!grouped[issueId]) {
                const matchingIssue = issues.find((i)=>i.id === issueId) || null;
                grouped[issueId] = {
                    issue: matchingIssue,
                    articles: []
                };
            }
            grouped[issueId].articles.push(article);
        });
        // 각 그룹별로 어워드 재계산
        Object.keys(grouped).forEach((issueId)=>{
            const groupArticles = grouped[issueId].articles;
            // 기존 어워드 초기화
            groupArticles.forEach((a)=>{
                a.awards = [];
            });
            // Combined Score 기준 정렬 (Today's Headline)
            const byCombo = [
                ...groupArticles
            ].sort((a, b)=>{
                const zeA = a.zero_echo_score ?? a.zeroEchoScore ?? 10;
                const zeB = b.zero_echo_score ?? b.zeroEchoScore ?? 10;
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                const combinedA = 10 - zeA + isA;
                const combinedB = 10 - zeB + isB;
                return combinedB - combinedA;
            });
            // ZS 기준 정렬 (Zero Echo Award - 낮을수록 좋음)
            const byZS = [
                ...groupArticles
            ].sort((a, b)=>{
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
            const byIS = [
                ...groupArticles
            ].sort((a, b)=>{
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
            // 어워드 순으로 정렬
            grouped[issueId].articles = [
                ...groupArticles
            ].sort((a, b)=>{
                const aAwards = a.awards?.length ?? 0;
                const bAwards = b.awards?.length ?? 0;
                if (bAwards !== aAwards) return bAwards - aAwards;
                const zeA = a.zero_echo_score ?? a.zeroEchoScore ?? 10;
                const zeB = b.zero_echo_score ?? b.zeroEchoScore ?? 10;
                const isA = a.impact_score ?? a.impactScore ?? 0;
                const isB = b.impact_score ?? b.impactScore ?? 0;
                const combinedA = 10 - zeA + isA;
                const combinedB = 10 - zeB + isB;
                return combinedB - combinedA;
            });
        });
        // 회차를 released_at 또는 published_at 기준으로 정렬 (최신순)
        const sorted = Object.keys(grouped).sort((a, b)=>{
            const issueA = grouped[a].issue;
            const issueB = grouped[b].issue;
            const dateA = issueA?.released_at || issueA?.published_at || '';
            const dateB = issueB?.released_at || issueB?.published_at || '';
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        return {
            groupedByIssue: grouped,
            sortedIssueIds: sorted
        };
    }, [
        articles,
        issues
    ]);
    // 현재 선택된 회차 인덱스 (가장 최신 회차가 기본)
    const [currentIssueIndex, setCurrentIssueIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [isDropdownOpen, setIsDropdownOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
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
    const handleIssueChange = (issueId)=>{
        const newIndex = sortedIssueIds.indexOf(issueId);
        if (newIndex !== -1) {
            setCurrentIssueIndex(newIndex);
            setIsDropdownOpen(false);
        }
    };
    // 날짜 기반 변경 (PageFrame 호환용)
    const handleDateChange = (target)=>{
        // target이 issue id인지 확인하고 처리
        if (groupedByIssue[target]) {
            handleIssueChange(target);
        }
    };
    const handleRefresh = ()=>{
        router.refresh();
        window.location.reload();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$PageFrame$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
        currentDate: currentIssue?.date || null,
        editionName: currentIssue?.edition_name || null,
        prevDate: prevIssue?.date || null,
        prevEditionName: prevIssue?.edition_name || null,
        nextDate: nextIssue?.date || null,
        nextEditionName: nextIssue?.edition_name || null,
        onDateChange: (target)=>{
            // date로 매칭된 issue 찾기
            const matchingId = sortedIssueIds.find((id)=>{
                const issue = groupedByIssue[id]?.issue;
                return issue?.date === target;
            });
            if (matchingId) handleIssueChange(matchingId);
        },
        articles: currentArticles,
        issues: sortedIssueIds.map((id)=>{
            const issue = groupedByIssue[id]?.issue;
            return issue ? {
                id: issue.id,
                date: issue.date,
                edition_name: issue.edition_name,
                article_count: issue.article_count
            } : null;
        }).filter((issue)=>issue !== null),
        currentIssueId: currentIssueId,
        onIssueSelect: handleIssueChange,
        children: currentIssueId && currentArticles.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ArticleDisplay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
            articles: currentArticles,
            loading: false,
            error: null
        }, void 0, false, {
            fileName: "[project]/src/components/HomePageClient.tsx",
            lineNumber: 200,
            columnNumber: 17
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-center py-20 text-muted-foreground",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xl",
                    children: "표시할 기사가 없습니다."
                }, void 0, false, {
                    fileName: "[project]/src/components/HomePageClient.tsx",
                    lineNumber: 203,
                    columnNumber: 21
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm mt-2",
                    children: "발행된 회차가 아직 없습니다."
                }, void 0, false, {
                    fileName: "[project]/src/components/HomePageClient.tsx",
                    lineNumber: 204,
                    columnNumber: 21
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/HomePageClient.tsx",
            lineNumber: 202,
            columnNumber: 17
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/HomePageClient.tsx",
        lineNumber: 168,
        columnNumber: 9
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__353865da._.js.map