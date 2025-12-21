
import { useState, useEffect, useRef } from 'react';

interface DatePollingResult {
    availableDates: string[];
    latestDate: string | null;
    hasNewDate: boolean;
}

export function useDatePolling(currentLatestDate: string | null, intervalMs: number = 60000) {
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [serverLatestDate, setServerLatestDate] = useState<string | null>(null);
    const [hasNewDate, setHasNewDate] = useState(false);

    // 초기 로딩 후 최초 실행 방지 및 비교 기준 저장.
    const initialLatestRef = useRef(currentLatestDate);

    useEffect(() => {
        // currentLatestDate가 변경되면(예: 페이지 이동으로 최신 날짜를 보게 되면)
        // 새 날짜 알림 상태를 리셋하고 기준점을 업데이트
        if (currentLatestDate) {
            initialLatestRef.current = currentLatestDate;
            setHasNewDate(false);
        }
    }, [currentLatestDate]);

    useEffect(() => {
        const fetchDates = async () => {
            try {
                const res = await fetch('/api/dates');
                if (!res.ok) return;

                const data = await res.json();

                if (data.dates && Array.isArray(data.dates)) {
                    setAvailableDates(data.dates);

                    const newLatest = data.latest;
                    setServerLatestDate(newLatest);

                    // 서버의 최신 날짜가 내 기준 날짜보다 더 미래라면?
                    if (newLatest && initialLatestRef.current) {
                        const newDate = new Date(newLatest);
                        const currentDate = new Date(initialLatestRef.current);

                        if (newDate > currentDate) {
                            setHasNewDate(true);
                            console.log(`[DatePolling] New date found: ${newLatest} (Current: ${initialLatestRef.current})`);
                        }
                    }
                }
            } catch (error) {
                console.error('[DatePolling] Failed to fetch dates:', error);
            }
        };

        // 초기 실행
        fetchDates();

        // 주기적 실행
        const intervalId = setInterval(fetchDates, intervalMs);

        return () => clearInterval(intervalId);
    }, [intervalMs]);

    return { availableDates, serverLatestDate, hasNewDate };
}
