/**
 * ZND Desk - Common Utilities
 * 모든 페이지에서 공통으로 사용되는 유틸리티 함수 모음
 */

// =============================================================================
// UI Helpers
// =============================================================================

function showLoading() {
    document.getElementById('loading')?.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading')?.classList.add('hidden');
}

function showError(message) {
    alert('오류: ' + message);
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
}

// =============================================================================
// Data Formatters
// =============================================================================

function formatScore(score) {
    if (score === null || score === undefined) return '-';
    const num = parseFloat(score);
    if (num >= 7) return `<span class="score-high">${num.toFixed(1)}</span>`;
    if (num >= 4) return `<span class="score-mid">${num.toFixed(1)}</span>`;
    return `<span class="score-low">${num.toFixed(1)}</span>`;
}

function getStateBadge(state) {
    // ArticleState는 constants.js에 정의되어 있다고 가정
    const labels = {
        [ArticleState.COLLECTED]: '수집됨',
        [ArticleState.ANALYZING]: '분석중',
        [ArticleState.ANALYZED]: '분석완료',
        [ArticleState.REJECTED]: '폐기됨',
        [ArticleState.CLASSIFIED]: '분류됨',
        [ArticleState.PUBLISHED]: '발행됨',
        [ArticleState.RELEASED]: '공개됨'
    };
    return `<span class="state-badge state-${state}">${labels[state] || state}</span>`;
}

// =============================================================================
// API Helpers
// =============================================================================

async function fetchAPI(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    return response.json();
}

// =============================================================================
// Export to Global Scope
// =============================================================================
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showError = showError;
window.closeModal = closeModal;
window.formatScore = formatScore;
window.getStateBadge = getStateBadge;
window.fetchAPI = fetchAPI;
