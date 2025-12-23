'use client';

import { useEffect, useRef } from 'react';

/**
 * 방문자 트래킹 컴포넌트
 * 페이지 로드 시 /api/visitor 호출하여 방문 기록
 * 세션당 1회만 호출
 */
export default function VisitorTracker() {
    const hasTracked = useRef(false);

    useEffect(() => {
        // 세션당 1회만 트래킹
        if (hasTracked.current) return;

        const sessionKey = 'zed_visited';
        if (sessionStorage.getItem(sessionKey)) return;

        hasTracked.current = true;
        sessionStorage.setItem(sessionKey, 'true');

        // 방문자 API 호출 (fire and forget)
        fetch('/api/visitor', { method: 'POST' }).catch(() => {
            // 실패해도 무시
        });
    }, []);

    return null; // UI 없음
}
