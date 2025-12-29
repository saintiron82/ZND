/**
 * ZND Desk - Analyzer Page Logic
 * 분석 페이지 전용 함수들
 */

// 전역 변수 참조 (desk.js의 State 섹션에서 정의됨)
// let selectedArticles - Set 객체
// let articles - Array

async function initAnalyzerPage() {
    await loadAnalyzerArticles();
    setupAnalyzerEvents();
}

async function loadAnalyzerArticles() {
    showLoading();
    try {
        const state = document.getElementById('filter-state')?.value || '';
        const url = `/api/analyzer/list${state ? `?state=${state}` : ''}`;
        const result = await fetchAPI(url);

        if (result.success) {
            articles = result.articles;
            renderAnalyzerTable(articles);
        } else {
            showError(result.error);
        }
    } catch (e) {
        showError(e.message);
    } finally {
        hideLoading();
    }
}

function renderAnalyzerTable(articles) {
    const tbody = document.getElementById('articles-body');
    if (!tbody) return;

    tbody.innerHTML = articles.map(article => `
        <tr data-id="${article.article_id}">
            <td class="col-check">
                <input type="checkbox" class="article-check" value="${article.article_id}">
            </td>
            <td class="col-title">
                <a href="${article.url}" target="_blank">${article.title || '(제목 없음)'}</a>
            </td>
            <td class="col-score">${formatScore(article.impact_score)}</td>
            <td class="col-score">${formatScore(article.zero_echo_score)}</td>
            <td class="col-state">${getStateBadge(article.state)}</td>
            <td class="col-source">${article.source_id}</td>
        </tr>
    `).join('');

    // Checkbox events
    tbody.querySelectorAll('.article-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedArticles.add(e.target.value);
            } else {
                selectedArticles.delete(e.target.value);
            }
        });
    });
}

function setupAnalyzerEvents() {
    // Select All
    document.getElementById('check-all')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.article-check').forEach(cb => {
            cb.checked = checked;
            if (checked) {
                selectedArticles.add(cb.value);
            } else {
                selectedArticles.delete(cb.value);
            }
        });
    });

    // Analyze
    document.getElementById('btn-analyze')?.addEventListener('click', async () => {
        if (selectedArticles.size === 0) {
            alert('기사를 선택해주세요.');
            return;
        }
        showLoading();
        try {
            const result = await fetchAPI('/api/analyzer/analyze', {
                method: 'POST',
                body: JSON.stringify({ article_ids: Array.from(selectedArticles) })
            });
            if (result.success) {
                await loadAnalyzerArticles();
                selectedArticles.clear();
            } else {
                showError(result.error);
            }
        } finally {
            hideLoading();
        }
    });

    // Reject
    document.getElementById('btn-reject')?.addEventListener('click', async () => {
        if (selectedArticles.size === 0) {
            alert('기사를 선택해주세요.');
            return;
        }
        if (!confirm(`${selectedArticles.size}개 기사를 폐기하시겠습니까?`)) return;

        showLoading();
        try {
            const result = await fetchAPI('/api/analyzer/reject', {
                method: 'POST',
                body: JSON.stringify({ article_ids: Array.from(selectedArticles) })
            });
            if (result.success) {
                await loadAnalyzerArticles();
                selectedArticles.clear();
            } else {
                showError(result.error);
            }
        } finally {
            hideLoading();
        }
    });

    // Filter change
    document.getElementById('filter-state')?.addEventListener('change', loadAnalyzerArticles);

    // Refresh
    document.getElementById('btn-refresh')?.addEventListener('click', loadAnalyzerArticles);
}

// Export to Global Scope
window.initAnalyzerPage = initAnalyzerPage;
window.loadAnalyzerArticles = loadAnalyzerArticles;
