/**
 * ZND Desk - Board (Kanban) Logic
 * 칸반 보드 페이지 로직
 */

// =============================================================================
// Board Page (Kanban)
// =============================================================================

// Time Range Filter State
let currentTimeRangeHours = parseInt(localStorage.getItem('boardTimeRangeHours')) || 24; // Default: 24 hours

// Auto Refresh State
let autoRefreshInterval = null;
const AUTO_REFRESH_MS = 15000; // 15초

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
        // 로컬 시간으로 포맷 (datetime-local 형식: YYYY-MM-DDTHH:MM)
        const localTime = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16);
        customInput.value = localTime;
    }

    await loadBoardData();
    await loadInconsistentColumn(); // 초기 로딩 시에만 무결성 검사 실행
    setupBoardEvents();

    // 자동 갱신 비활성화 (Firestore 비용 절감)
    // startAutoRefresh();
}

async function syncAndReload() {
    showLoading();
    try {
        console.log('🔄 [Sync] DB 동기화 및 새로고침 시작...');

        // 1. 캐시 동기화 (Registry Sync)
        const syncResult = await fetchAPI('/api/board/sync', { method: 'POST' });
        if (syncResult.success) {
            console.log(`✅ [Sync] 캐시 동기화 완료: ${syncResult.new_count}개 추가됨`);
        }

        // 2. 보드 데이터 다시 로드
        await loadBoardData(true);

        // 3. 무결성(Inconsistent) 컬럼 다시 로드 (무거운 작업)
        await loadInconsistentColumn();

        console.log('✅ [Sync] 전체 동기화 완료');

        // 4. 마지막 업데이트 시간 표시 (Optional)
        const statsEl = document.getElementById('stats');
        if (statsEl) {
            const now = new Date().toLocaleTimeString();
            statsEl.textContent = `마지막 동기화: ${now}`;
        }

    } catch (e) {
        showError('동기화 실패: ' + e.message);
    } finally {
        hideLoading();
    }
}

async function loadBoardData(silent = false) {
    // silent=true: 자동 새로고침 시 로딩 표시 생략
    if (!silent) {
        showLoading();
    }
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

        // Load inconsistent articles separately -> [OPTIMIZATION] Removed from auto-refresh loop
        // await loadInconsistentColumn();
    } catch (e) {
        showError(e.message);
    } finally {
        hideLoading();
    }
}

async function loadInconsistentColumn() {
    try {
        const result = await fetchAPI('/api/board/inconsistent-articles');

        if (result.success) {
            const count = result.count || 0;
            const articles = result.articles || [];

            // Update count
            const countEl = document.getElementById('count-inconsistent');
            if (countEl) countEl.textContent = count;

            // Render cards
            const cardsEl = document.getElementById('cards-inconsistent');
            if (cardsEl) {
                cardsEl.innerHTML = articles.map(article => {
                    const articleId = article.article_id || article.id;
                    // Add issue reason badge to card
                    const issueHtml = article.issue_reason
                        ? `<div class="card-issue-badge" style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-top: 4px;">${article.issue_reason}</div>
                           <div style="font-size: 10px; color: #2ecc71; margin-top: 2px;">→ ${article.recoverable_to}</div>`
                        : '';
                    return `
                        <div class="kanban-card" data-id="${articleId}" onclick="viewArticle('${articleId}')">
                            <div class="card-title">${article.title || article.title_ko || '제목 없음'}</div>
                            <div class="card-meta">${article.source || ''}</div>
                            ${issueHtml}
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (e) {
        console.warn('[Inconsistent] Load failed:', e);
    }
}

async function recoverAllInconsistent() {
    if (!confirm('모든 불일치 데이터를 자동 복구하시겠습니까?\n각 기사는 실제 데이터에 맞는 상태로 조정됩니다.')) {
        return;
    }

    showLoading();
    try {
        const result = await fetchAPI('/api/board/recover-inconsistent', {
            method: 'POST',
            body: JSON.stringify({ recover_all: true })
        });

        if (result.success) {
            alert(`✅ ${result.recovered_count}개 복구 완료, ${result.failed_count}개 실패`);
            await loadBoardData();
        } else {
            showError(result.error);
        }
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
            // 로컬 시간으로 포맷
            const localTime = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            customInput.value = localTime;
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
            cardsEl.innerHTML = data.articles.map(article => {
                const articleId = article.article_id || article.id;
                return renderArticleCard(article, {
                    selectable: isSelectionMode,
                    selected: selectedArticles.has(articleId),
                    onClickHandler: isSelectionMode ?
                        `toggleArticleSelection('${articleId}')` :
                        null
                });
            }).join('');
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
                <option value="${ArticleState.CLASSIFIED}">분류됨</option>
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
    console.log('[toggleSelectAll] state:', state, 'data:', data);
    if (!data || !data.articles) {
        console.warn('[toggleSelectAll] No data found for state:', state);
        return;
    }

    // Debug: Show first article structure
    if (data.articles.length > 0) {
        console.log('[toggleSelectAll] First article sample:', JSON.stringify(data.articles[0], null, 2));
    }

    if (forceSelect) {
        // Get article ID (support both article_id and id)
        const getArticleId = (a) => a.article_id || a.id;

        const currentInCol = data.articles.filter(a => selectedArticles.has(getArticleId(a))).length;
        const totalInCol = data.articles.length;

        console.log('[toggleSelectAll] currentInCol:', currentInCol, 'totalInCol:', totalInCol);

        if (currentInCol === totalInCol) {
            // Deselect all in this column
            data.articles.forEach(a => selectedArticles.delete(getArticleId(a)));
        } else {
            // Select all
            data.articles.forEach(a => {
                const id = getArticleId(a);
                if (id) selectedArticles.add(id);
            });
        }

        console.log('[toggleSelectAll] selectedArticles after:', Array.from(selectedArticles));
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

    // Mobile Accordion Init
    initMobileAccordion();
}

function initMobileAccordion() {
    // Only apply if we are in a context where columns exist.
    // Logic: Attach click to headers to toggle 'expanded' class on column.

    const columns = document.querySelectorAll('.kanban-column');
    if (columns.length === 0) return;

    // Default: Expand first column if on mobile
    if (window.innerWidth <= 768) {
        columns[0].classList.add('expanded');
    }

    columns.forEach(col => {
        const header = col.querySelector('.column-header');
        if (!header) return;

        header.addEventListener('click', (e) => {
            // Don't toggle if clicking a button inside header (menu, etc)
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

            // Only effective on mobile (check css media query or just toggle class always? 
            // CSS handles display:none for desktop so toggling class is safe always, 
            // but the accordion behavior (closing others) matches mobile expectation).
            if (window.innerWidth > 768) return;

            const wasExpanded = col.classList.contains('expanded');

            // Exclusive Accordion: Close others
            columns.forEach(c => c.classList.remove('expanded'));

            if (!wasExpanded) {
                col.classList.add('expanded');
                // Smooth scroll to header
                setTimeout(() => {
                    header.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                    // Adjust for sticky header
                    window.scrollBy(0, -120);
                }, 100);
            }
        });
    });
}

// =============================================================================
// Auto Refresh (15초 폴링)
// =============================================================================

function startAutoRefresh() {
    // 기존 인터벌 정리
    stopAutoRefresh();

    autoRefreshInterval = setInterval(async () => {
        console.log('🔄 [AutoRefresh] 칸반보드 갱신 중...');
        try {
            await loadBoardData(true); // silent=true: 로딩 표시 없이 갱신
        } catch (e) {
            console.warn('[AutoRefresh] 갱신 실패:', e);
        }
    }, AUTO_REFRESH_MS);

    console.log(`✅ [AutoRefresh] 시작됨 (${AUTO_REFRESH_MS / 1000}초 간격)`);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏹️ [AutoRefresh] 중지됨');
    }
}

// 페이지 이탈 시 자동 정리
window.addEventListener('beforeunload', stopAutoRefresh);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        // 페이지 다시 보이면 즉시 갱신 (폴링은 재시작 안 함)
        // loadBoardData(); // [OPTIMIZATION] 탭 전환 시 자동 갱신도 비활성화 (비용 절감)
        // startAutoRefresh();
    }
});

// 다른 탭에서 분석 저장 시 즉시 갱신 (Cross-Tab Communication)
window.addEventListener('storage', (e) => {
    if (e.key === 'board_refresh_trigger') {
        console.log('🔔 [CrossTab] 다른 탭에서 변경 감지, 칸반보드 갱신!');
        loadBoardData();
    }
});

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
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
window.loadInconsistentColumn = loadInconsistentColumn;
window.recoverAllInconsistent = recoverAllInconsistent;
window.syncAndReload = syncAndReload;

