/**
 * ZND Desk - Board (Kanban) Logic
 * 칸반 보드 페이지 로직
 */

// =============================================================================
// Board Page (Kanban)
// =============================================================================

// Time Range Filter State
let currentTimeRangeHours = parseInt(localStorage.getItem('boardTimeRangeHours')) || 24; // Default: 24 hours

async function initBoardPage() {
    // Restore saved time range and update UI
    const savedHours = parseInt(localStorage.getItem('boardTimeRangeHours')) || 24;
    currentTimeRangeHours = savedHours;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.hours) === savedHours) {
            btn.classList.add('active');
        }
    });

    // Set datetime in custom picker
    const customInput = document.getElementById('custom-start-time');
    if (customInput && savedHours > 0) {
        const startTime = new Date(Date.now() - savedHours * 60 * 60 * 1000);
        customInput.value = startTime.toISOString().slice(0, 16);
    }

    await loadBoardData();
    setupBoardEvents();
}

async function loadBoardData() {
    showLoading();
    try {
        // Build URL with time filter
        let url = '/api/board/overview';
        if (currentTimeRangeHours > 0) {
            const sinceTime = new Date(Date.now() - currentTimeRangeHours * 60 * 60 * 1000);
            url += `?since=${sinceTime.toISOString()}`;
        }

        const result = await fetchAPI(url);

        if (result.success) {
            kanbanData = result.overview; // Store global for batch access
            renderKanbanBoard(result.overview);
        } else {
            showError(result.error);
        }
    } catch (e) {
        showError(e.message);
    } finally {
        hideLoading();
    }
}

function setTimeRange(hours) {
    currentTimeRangeHours = hours;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.hours) === hours) {
            btn.classList.add('active');
        }
    });

    // Update custom input to show calculated time
    const customInput = document.getElementById('custom-start-time');
    if (customInput) {
        if (hours > 0) {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            customInput.value = startTime.toISOString().slice(0, 16);
        } else {
            customInput.value = '';  // 전체 선택시 비움
        }
    }

    // Save to localStorage
    localStorage.setItem('boardTimeRangeHours', hours.toString());

    // Reload data
    loadBoardData();
}

function setCustomTimeRange() {
    const input = document.getElementById('custom-start-time');
    if (!input || !input.value) return;

    const startTime = new Date(input.value);
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    currentTimeRangeHours = diffHours;

    // Clear preset active states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Reload data
    loadBoardData();
}

function renderKanbanBoard(overview) {
    const states = [
        ArticleState.COLLECTED,
        ArticleState.ANALYZED,
        ArticleState.CLASSIFIED,
        ArticleState.PUBLISHED,
        ArticleState.REJECTED
    ];

    states.forEach(state => {
        const data = overview[state] || { count: 0, articles: [] };
        const stateLower = state.toLowerCase();

        // Update count
        const countEl = document.getElementById(`count-${stateLower}`);
        if (countEl) countEl.textContent = data.count;

        // Render cards using shared function
        const cardsEl = document.getElementById(`cards-${stateLower}`);
        const isSelectionMode = selectionModeState === state;

        if (cardsEl) {
            cardsEl.innerHTML = data.articles.map(article =>
                renderArticleCard(article, {
                    selectable: isSelectionMode,
                    selected: selectedArticles.has(article.article_id),
                    onClickHandler: isSelectionMode ?
                        `toggleArticleSelection('${article.article_id}')` :
                        null
                })
            ).join('');
        }

        // Update Header Controls
        updateColumnHeader(state, isSelectionMode);
    });
}

function updateColumnHeader(state, isSelectionMode) {
    const stateLower = state.toLowerCase();
    const menuBtn = document.querySelector(`.kanban-column[data-state="${stateLower}"] .btn-column-menu`);
    const headerTitle = document.querySelector(`.kanban-column[data-state="${stateLower}"] h3`);

    // Add or Update Selection Controls Container
    let controls = document.getElementById(`controls-${stateLower}`);
    if (!controls) {
        controls = document.createElement('div');
        controls.id = `controls-${stateLower}`;
        controls.className = 'selection-controls hidden';
        // Insert after H3
        headerTitle?.parentNode.insertBefore(controls, headerTitle.nextSibling);
    }

    if (isSelectionMode) {
        controls.classList.remove('hidden');
        menuBtn?.classList.add('hidden');
        headerTitle?.classList.add('hidden');

        const count = selectedArticles.size;

        // Define available target states based on current state
        let options = '';
        if (state === ArticleState.PUBLISHED) {
            options = `
                <option value="${ArticleState.CLASSIFIED}">분류됨</option>
                <option value="${ArticleState.ANALYZED}">분석완료</option>
                <option value="${ArticleState.COLLECTED}">수집됨</option>
            `;
        } else if (state === ArticleState.CLASSIFIED) {
            options = `
                <option value="${ArticleState.ANALYZED}">분석완료</option>
                <option value="${ArticleState.COLLECTED}">수집됨</option>
            `;
        } else if (state === ArticleState.ANALYZED) {
            options = `
                <option value="${ArticleState.COLLECTED}">수집됨</option>
            `;
        } else if (state === ArticleState.REJECTED) {
            options = `
                <option value="${ArticleState.ANALYZED}">분석완료 (복원)</option>
                <option value="${ArticleState.COLLECTED}">수집됨</option>
            `;
        }

        controls.innerHTML = `
            <div style="display: flex; gap: 4px; align-items: center; margin-right: 8px;">
                <button class="btn-xs" onclick="toggleSelectAll('${state}', true)">전체선택</button>
            </div>
            <span class="selection-count" style="margin-right: 4px;">${count}개</span>
            <select id="target-state-${stateLower}" class="input-sm" style="width: auto; padding: 2px;">
                ${options}
            </select>
            <button class="btn-xs btn-primary" onclick="sendBackSelected('${state}')">이동</button>
            <button class="btn-xs" onclick="toggleSelectionMode('${state}')">취소</button>
        `;
    } else {
        controls.classList.add('hidden');
        menuBtn?.classList.remove('hidden');
        headerTitle?.classList.remove('hidden');
    }

    // Add 'Select Mode' to menu if not exists
    const menu = document.getElementById(`menu-${stateLower}`);
    if (menu && !menu.querySelector('.btn-select-mode')) {
        const btn = document.createElement('button');
        btn.className = 'btn-select-mode';
        btn.innerHTML = '✨ 선택 모드 (이동)';
        btn.onclick = () => {
            toggleSelectionMode(state);
            toggleColumnMenu(stateLower); // Close menu
        };
        menu.appendChild(btn);
    }
}

function toggleSelectAll(state, forceSelect) {
    const data = kanbanData[state];
    if (!data) return;

    if (forceSelect) {
        // If all already selected, consider deselecting? 
        // Or just specialized 'Select All' button implies selecting all.
        // Let's check current selection count.
        const currentInCol = data.articles.filter(a => selectedArticles.has(a.article_id)).length;
        const totalInCol = data.articles.length;

        if (currentInCol === totalInCol) {
            // Deselect all in this column
            data.articles.forEach(a => selectedArticles.delete(a.article_id));
        } else {
            // Select all
            data.articles.forEach(a => selectedArticles.add(a.article_id));
        }
    }
    renderKanbanBoard(kanbanData);
}

function toggleArticleSelection(articleId) {
    if (selectedArticles.has(articleId)) {
        selectedArticles.delete(articleId);
    } else {
        selectedArticles.add(articleId);
    }
    // Re-render to update count
    if (selectionModeState) {
        // Just update count text instead of full re-render to key dropdown state? 
        // No, full re-render is safer for now, but will reset dropdown. 
        // Let's try to just update the count element if possible.
        const stateLower = selectionModeState.toLowerCase();
        const countSpan = document.querySelector(`#controls-${stateLower} .selection-count`);
        if (countSpan) {
            countSpan.textContent = selectedArticles.size;
        }

        // Also update card style
        const card = document.querySelector(`.kanban-card[data-id="${articleId}"]`);
        const checkbox = card?.querySelector('.card-checkbox');
        if (card) {
            if (selectedArticles.has(articleId)) {
                card.classList.add('selected');
                if (checkbox) checkbox.checked = true;
            } else {
                card.classList.remove('selected');
                if (checkbox) checkbox.checked = false;
            }
        }
    }
}

function toggleSelectionMode(state) {
    if (selectionModeState === state) {
        // Turn off
        selectionModeState = null;
        selectedArticles.clear();
    } else {
        // Turn on (switch column)
        selectionModeState = state;
        selectedArticles.clear();
    }
    renderKanbanBoard(kanbanData);
}

async function sendBackSelected(state) {
    if (selectedArticles.size === 0) {
        alert('기사를 선택해주세요.');
        return;
    }

    const stateLower = state.toLowerCase();
    const targetSelect = document.getElementById(`target-state-${stateLower}`);
    const targetState = targetSelect ? targetSelect.value : null;

    if (!targetState) {
        alert('이동할 단계를 선택해주세요.');
        return;
    }

    // Label mapping for confirmation
    const labels = {
        [ArticleState.COLLECTED]: '수집됨',
        [ArticleState.ANALYZED]: '분석완료',
        [ArticleState.CLASSIFIED]: '분류됨',
        [ArticleState.PUBLISHED]: '발행됨',
        [ArticleState.REJECTED]: '폐기됨'
    };
    const targetLabel = labels[targetState] || targetState;

    if (!confirm(`${selectedArticles.size}개 기사를 [${targetLabel}] 단계로 이동하시겠습니까?`)) {
        return;
    }

    showLoading();
    try {
        const result = await fetchAPI('/api/board/send-back', {
            method: 'POST',
            body: JSON.stringify({
                article_ids: Array.from(selectedArticles),
                current_state: state,
                target_state: targetState
            })
        });

        if (result.success) {
            alert(`${result.processed}개 이동 완료`);
            selectionModeState = null;
            selectedArticles.clear();
            await loadBoardData();
        } else {
            showError(result.error);
        }
    } finally {
        hideLoading();
    }
}

function setupBoardEvents() {
    // Drag and Drop (basic)
    document.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
        });

        card.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });
    });

    document.querySelectorAll('.kanban-column').forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            const articleId = e.dataTransfer.getData('text/plain');
            const toState = column.dataset.state;

            showLoading();
            try {
                const result = await fetchAPI('/api/board/move', {
                    method: 'POST',
                    body: JSON.stringify({ article_id: articleId, to_state: toState })
                });
                if (result.success) {
                    await loadBoardData();
                } else {
                    showError(result.error);
                }
            } finally {
                hideLoading();
            }
        });
    });

    // Close column menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.column-menu-wrapper')) {
            document.querySelectorAll('.column-menu').forEach(m => m.classList.add('hidden'));
        }
    });
}

// Export to Global Scope
window.initBoardPage = initBoardPage;
window.loadBoardData = loadBoardData;
window.setTimeRange = setTimeRange;
window.setCustomTimeRange = setCustomTimeRange;
window.renderKanbanBoard = renderKanbanBoard;
window.toggleSelectAll = toggleSelectAll;
window.toggleArticleSelection = toggleArticleSelection;
window.toggleSelectionMode = toggleSelectionMode;
window.sendBackSelected = sendBackSelected;
