/**
 * Analytics Service
 * Firestore에 통계 데이터를 기록하는 서비스
 * - 기사별 클릭 카운터
 * - 호별 뷰잉 카운터
 */

import { db } from './firebase';
import { doc, setDoc, increment, getDoc } from 'firebase/firestore';

// 환경: dev 또는 release
const ZND_ENV = process.env.NEXT_PUBLIC_ZND_ENV || 'release';

/**
 * 현재 월을 YYYY_MM 형식으로 반환
 */
function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}_${month}`;
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * stats 문서 참조 가져오기
 * 구조: {env}/data/stats/{docId}
 */
function getStatsDocRef(docId: string) {
    return doc(db, ZND_ENV, 'data', 'stats', docId);
}

/**
 * 기사 클릭 수 증가
 * @param articleId - 클릭된 기사 ID
 */
export async function incrementArticleClick(articleId: string): Promise<void> {
    if (!articleId) return;

    try {
        const month = getCurrentMonth();
        const docRef = getStatsDocRef(`clicks_${month}`);

        // 해당 article_id 필드를 increment
        await setDoc(docRef, {
            [articleId]: increment(1)
        }, { merge: true });

        console.log(`📊 [Analytics] Article click recorded: ${articleId}`);
    } catch (error) {
        console.error('❌ [Analytics] Failed to record article click:', error);
    }
}

/**
 * 호별 뷰 수 증가
 * @param editionCode - 조회된 호 코드 (예: "250102_1")
 */
export async function incrementEditionView(editionCode: string): Promise<void> {
    if (!editionCode) return;

    try {
        const month = getCurrentMonth();
        const today = getTodayDate();
        const docRef = getStatsDocRef(`views_${month}`);

        // edition별 total과 daily 모두 증가
        await setDoc(docRef, {
            [editionCode]: {
                total: increment(1),
                daily: {
                    [today]: increment(1)
                }
            }
        }, { merge: true });

        console.log(`📊 [Analytics] Edition view recorded: ${editionCode}`);
    } catch (error) {
        console.error('❌ [Analytics] Failed to record edition view:', error);
    }
}

/**
 * 기사 클릭 수 조회
 * @param articleId - 기사 ID
 * @param month - 월 (YYYY_MM 형식, 기본값: 현재 월)
 */
export async function getArticleClicks(articleId: string, month?: string): Promise<number> {
    try {
        const targetMonth = month || getCurrentMonth();
        const docRef = getStatsDocRef(`clicks_${targetMonth}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return data[articleId] || 0;
        }
        return 0;
    } catch (error) {
        console.error('❌ [Analytics] Failed to get article clicks:', error);
        return 0;
    }
}

/**
 * 호별 뷰 수 조회
 * @param editionCode - 호 코드
 * @param month - 월 (YYYY_MM 형식, 기본값: 현재 월)
 */
export async function getEditionViews(editionCode: string, month?: string): Promise<{ total: number; daily: Record<string, number> }> {
    try {
        const targetMonth = month || getCurrentMonth();
        const docRef = getStatsDocRef(`views_${targetMonth}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return data[editionCode] || { total: 0, daily: {} };
        }
        return { total: 0, daily: {} };
    } catch (error) {
        console.error('❌ [Analytics] Failed to get edition views:', error);
        return { total: 0, daily: {} };
    }
}
