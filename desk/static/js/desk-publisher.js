/**
 * ZND Desk - Publisher Page Logic
 * 발행 페이지 전용 함수들
 */

// 전역 변수 참조 (desk.js의 State 섹션에서 정의됨)
// let selectedArticles - Set 객체
// let articles - Array

async function initPublisherPage() {
    await loadPublisherArticles();
    await initPublisherInputs();
    setupPublisherEvents();
}

async function initPublisherInputs() {
    try {
        const result = await fetchAPI('/api/publisher/next-edition');
        if (result.success) {
            const codeInput = document.getElementById('edition-code');
            const nameInput = document.getElementById('edition-name');
            if (codeInput && !codeInput.value) codeInput.value = result.next_edition_code;
            if (nameInput && !nameInput.value) nameInput.value = result.next_edition_name;
        }
    } catch (e) {
        console.error('Failed to init publisher inputs:', e);
    }
}

async function loadPublisherArticles() {
    showLoading();
    try {
        const state = document.getElementById('filter-state')?.value || '';
        const url = `/api/publisher/list${state ? `?state=${state}` : ''}`;
        const result = await fetchAPI(url);

        if (result.success) {
            articles = result.articles;
            renderPublisherTable(articles);
        } else {
            showError(result.error);
        }
    } catch (e) {
        showError(e.message);
    } finally {
        hideLoading();
    }
}

function renderPublisherTable(articles) {
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
            <td class="col-category">${article.category || '-'}</td>
            <td class="col-state">${getStateBadge(article.state)}</td>
        </tr>
    `).join('');

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

function setupPublisherEvents() {
    // Select All
    document.getElementById('check-all')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.article-check').forEach(cb => {
            cb.checked = checked;
            if (checked) selectedArticles.add(cb.value);
            else selectedArticles.delete(cb.value);
        });
    });

    // Classify
    document.getElementById('btn-classify')?.addEventListener('click', () => {
        if (selectedArticles.size === 0) {
            alert('기사를 선택해주세요.');
            return;
        }
        document.getElementById('category-modal')?.classList.remove('hidden');
    });

    // Category buttons
    document.querySelectorAll('.category-buttons .btn[data-category]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const category = btn.dataset.category;
            showLoading();
            try {
                const result = await fetchAPI('/api/publisher/classify', {
                    method: 'POST',
                    body: JSON.stringify({
                        article_ids: Array.from(selectedArticles),
                        category
                    })
                });
                if (result.success) {
                    document.getElementById('category-modal')?.classList.add('hidden');
                    await loadPublisherArticles();
                    selectedArticles.clear();
                }
            } finally {
                hideLoading();
            }
        });
    });

    // Modal close
    document.getElementById('btn-modal-close')?.addEventListener('click', () => {
        document.getElementById('category-modal')?.classList.add('hidden');
    });

    // Publish
    document.getElementById('btn-publish')?.addEventListener('click', async () => {
        if (selectedArticles.size === 0) {
            alert('기사를 선택해주세요.');
            return;
        }
        const editionCode = document.getElementById('edition-code')?.value;
        const editionName = document.getElementById('edition-name')?.value;

        showLoading();
        try {
            const result = await fetchAPI('/api/publisher/publish', {
                method: 'POST',
                body: JSON.stringify({
                    article_ids: Array.from(selectedArticles),
                    edition_code: editionCode,
                    edition_name: editionName
                })
            });
            if (result.success) {
                alert(`${result.edition_name} 발행 완료!`);
                await loadPublisherArticles();
                selectedArticles.clear();
            }
        } finally {
            hideLoading();
        }
    });

    // Filter & Refresh
    document.getElementById('filter-state')?.addEventListener('change', loadPublisherArticles);
    document.getElementById('btn-refresh')?.addEventListener('click', loadPublisherArticles);
}

// Export to Global Scope
window.initPublisherPage = initPublisherPage;
window.loadPublisherArticles = loadPublisherArticles;
