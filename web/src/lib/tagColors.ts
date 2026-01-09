/**
 * 태그 색상 유틸리티
 * - 해시 함수로 태그 이름 → 고정 색상 매핑
 * - 같은 태그는 항상 같은 색상 유지
 */

// 다양한 색상 팔레트 (20개)
export const TAG_COLORS = [
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#22c55e', // green-500
    '#0ea5e9', // sky-500
    '#f43f5e', // rose-500
    '#a855f7', // purple-500
    '#eab308', // yellow-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
    '#3b82f6', // blue-500
    '#ef4444', // red-500
    '#10b981', // emerald-500
    '#6366f1', // indigo-500
    '#d946ef', // fuchsia-500
    '#f59e0b', // amber-500
    '#0d9488', // teal-600
    '#7c3aed', // violet-600
    '#db2777', // pink-600
];

// Tailwind 클래스 매핑 (배경색 + 텍스트색)
export const TAG_COLOR_CLASSES = [
    { bg: 'bg-teal-500', text: 'text-white' },
    { bg: 'bg-orange-500', text: 'text-white' },
    { bg: 'bg-violet-500', text: 'text-white' },
    { bg: 'bg-pink-500', text: 'text-white' },
    { bg: 'bg-green-500', text: 'text-white' },
    { bg: 'bg-sky-500', text: 'text-white' },
    { bg: 'bg-rose-500', text: 'text-white' },
    { bg: 'bg-purple-500', text: 'text-white' },
    { bg: 'bg-yellow-500', text: 'text-black' },
    { bg: 'bg-cyan-500', text: 'text-white' },
    { bg: 'bg-lime-500', text: 'text-black' },
    { bg: 'bg-blue-500', text: 'text-white' },
    { bg: 'bg-red-500', text: 'text-white' },
    { bg: 'bg-emerald-500', text: 'text-white' },
    { bg: 'bg-indigo-500', text: 'text-white' },
    { bg: 'bg-fuchsia-500', text: 'text-white' },
    { bg: 'bg-amber-500', text: 'text-black' },
    { bg: 'bg-teal-600', text: 'text-white' },
    { bg: 'bg-violet-600', text: 'text-white' },
    { bg: 'bg-pink-600', text: 'text-white' },
];

/**
 * 태그 이름을 해시하여 고정된 인덱스 반환
 */
function hashTagName(tagName: string): number {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        const char = tagName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % TAG_COLORS.length;
}

/**
 * 태그 이름 → HEX 색상 코드 반환 (차트용)
 */
export function getTagColor(tagName: string): string {
    const index = hashTagName(tagName);
    return TAG_COLORS[index];
}

/**
 * 태그 이름 → Tailwind 클래스 반환 (컴포넌트용)
 */
export function getTagColorClass(tagName: string): { bg: string; text: string } {
    const index = hashTagName(tagName);
    return TAG_COLOR_CLASSES[index];
}
