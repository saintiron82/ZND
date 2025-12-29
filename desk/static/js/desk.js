/**
 * ZND Desk - JavaScript
 */

// =============================================================================
// State
// =============================================================================

let selectedArticles = new Set();
let selectionModeState = null; // null or state string (e.g. 'collected')

let articles = [];
let kanbanData = {}; // Cache for Board Data

// =============================================================================
// Common Functions
// [MOVED] → desk-common.js
// =============================================================================

/**



/**
 * Shared function to render article card HTML
 * Used by both Board and Publisher pages
 * @param {object} article - Article data with article_id, title, source_id, impact_score, zero_echo_score, summary
 * @param {object} options - { selectable, selected, showCategory, showSummary, enlarged, onClickHandler }
 * @returns {string} - Card HTML string
 */
function renderArticleCard(article, options = {}) {
    const { selectable = false, selected = false, showCategory = false, showSummary = false, enlarged = false, onClickHandler = null } = options;
    const articleId = article.article_id || article.id;
    const title = article.title || '(No Title)';
    const source = article.source_id || 'unknown';
    const isRaw = article.impact_score ?? null;
    const zsRaw = article.zero_echo_score ?? null;
    const is = isRaw !== null ? isRaw.toFixed(1) : '-';
    const zs = zsRaw !== null ? zsRaw.toFixed(1) : '-';
    const summary = article.summary || '';
    const state = article.state || '';

    // 폐기 기사는 사유 표시, 그 외는 카테고리 표시
    let category = article.category || '';
    if (state === 'REJECTED' || state === 'rejected') {
        const reason = article.rejected_reason || 'unknown';
        const reasonMap = {
            'cutline': '✂️ 커트라인',
            'duplicate': '🔄 중복',
            'manual': '👤 수동 폐기',
            'unknown': '⛔ 폐기됨'
        };
        category = reasonMap[reason] || `⛔ ${reason}`;
    }

    const selectedClass = selected ? 'selected' : '';
    const enlargedClass = enlarged ? 'card-enlarged' : '';
    const checkboxHtml = selectable
        ? `<input type="checkbox" class="card-checkbox" value="${articleId}" ${selected ? 'checked' : ''} onclick="event.stopPropagation()">`
        : '';
    const categoryHtml = showCategory && category
        ? `<span class="card-category">${category}</span>`
        : '';
    const summaryHtml = showSummary && summary
        ? `<div class="card-summary">${summary}</div>`
        : '';

    // Use custom handler or default showArticleRaw
    const clickHandler = onClickHandler || `showArticleRaw('${articleId}')`;

    return `
        <div class="kanban-card ${selectedClass} ${enlargedClass}" draggable="true" data-id="${articleId}" data-is="${isRaw ?? 0}" data-zs="${zsRaw ?? 10}" onclick="${clickHandler}">
            ${selectable ? `<div class="card-header-row">
                <label class="card-checkbox-label" onclick="event.stopPropagation()">
                    ${checkboxHtml}
                    <span class="checkbox-text">선택</span>
                </label>
                ${categoryHtml}
            </div>` : ''}
            <div class="card-title">${title}</div>
            ${summaryHtml}
            <div class="card-meta">
                <span>${source}</span>
                ${!selectable && showCategory ? categoryHtml : ''}
                <div class="card-scores">
                    <span class="score-is" data-value="${isRaw ?? 0}">IS: ${is}</span>
                    <span class="score-zs" data-value="${zsRaw ?? 10}">ZS: ${zs}</span>
                </div>
            </div>
        </div>
    `;
}

// =============================================================================
// Analyzer Page
// [MOVED] → desk-analyzer.js
// =============================================================================

// =============================================================================
// Publisher Page
// [MOVED] → desk-publisher.js
// =============================================================================

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

// Make global
window.columnAction = columnAction;
window.toggleColumnMenu = toggleColumnMenu;

function toggleColumnMenu(state) {
    const menu = document.getElementById(`menu-${state}`);
    const btn = document.querySelector(`.kanban-column[data-state="${state}"] .btn-column-menu`);

    // Close other menus
    document.querySelectorAll('.column-menu').forEach(el => {
        if (el.id !== `menu-${state}`) el.classList.add('hidden');
    });

    if (menu) {
        menu.classList.toggle('hidden');
    }
}

async function columnAction(state, action) {
    console.log('columnAction called:', state, action);
    let confirmMsg = '이 작업을 수행하시겠습니까?';
    if (action === 'reject-all') confirmMsg = `[${state}] 상태의 모든 기사를 폐기하시겠습니까?`;
    if (action === 'restore-all') confirmMsg = `[${state}] 상태의 모든 기사를 복원하시겠습니까?`;
    if (action === 'empty-trash') confirmMsg = `휴지통을 비우시겠습니까? (영구 삭제)`;
    if (action === 'recalculate-scores') confirmMsg = `[${state}] 기사들의 점수를 재계산하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    showLoading();
    try {
        const result = await fetchAPI('/api/board/column-action', {
            method: 'POST',
            body: JSON.stringify({ state, action })
        });

        if (result.success) {
            alert(result.message);
            toggleColumnMenu(state); // Close menu
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

// =============================================================================
// Unlinked Article Recovery Functions
// [MOVED] → desk-recovery.js
// =============================================================================
// =============================================================================
// =============================================================================
// Column Menu Functions
// [MOVED] → desk-ui-columns.js
// =============================================================================

// =============================================================================
// Settings Popup
// =============================================================================

function initSettingsPopup() {
    // 설정 버튼 클릭 시 팝업 열기
    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
        openSettingsPopup();
    });
}

async function openSettingsPopup() {
    // 팝업 HTML 동적 생성
    let popup = document.getElementById('settings-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'settings-popup';
        popup.className = 'modal';
        popup.innerHTML = `
            <div class="modal-content settings-modal">
                <div class="modal-header">
                    <h2>📅 스케줄</h2>
                    <button id="btn-close-settings" class="btn-close">×</button>
                </div>
                
                <!-- 즉시 수집 섹션 -->
                <section class="settings-section">
                    <h3>🚀 즉시 수집</h3>
                    <div class="instant-collect">
                        <button id="btn-collect-now" class="btn btn-primary btn-lg">📡 지금 즉시 수집하기</button>
                        <span id="collect-status" class="collect-status"></span>
                    </div>
                </section>
                
                <!-- 스케줄 섹션 -->
                <section class="settings-section">
                    <h3>⏰ 예약 스케줄</h3>
                    <div id="schedule-list" class="schedule-list"></div>
                    <button id="btn-add-schedule" class="btn btn-sm">+ 스케줄 추가</button>
                </section>
                
                <!-- Discord 섹션 -->
                <section class="settings-section">
                    <h3>💬 Discord 알림</h3>
                    <div class="discord-status">
                        <span>상태: </span>
                        <span id="discord-status" class="status-badge">확인 중...</span>
                        <button id="btn-test-discord" class="btn btn-sm">📤 테스트 전송</button>
                    </div>
                </section>
                
                <!-- Firebase 사용량 -->
                <section class="settings-section">
                    <h3>🔥 Firebase 사용량</h3>
                    <div class="stats-row">
                        <span>읽기: <strong id="stat-reads">-</strong></span>
                        <span>쓰기: <strong id="stat-writes">-</strong></span>
                        <span>삭제: <strong id="stat-deletes">-</strong></span>
                        <button id="btn-reset-stats" class="btn btn-sm">리셋</button>
                    </div>
                </section>
            </div>
        `;
        document.body.appendChild(popup);

        // 팝업 스타일 추가
        addSettingsStyles();

        // 이벤트 설정
        setupSettingsEvents();
    }

    popup.classList.remove('hidden');
    await loadSettingsData();
}

async function loadSettingsData() {
    // 스케줄 로드
    try {
        const result = await fetchAPI('/api/settings/schedules');
        if (result.success) {
            renderScheduleList(result.schedules);
        }
    } catch (e) {
        console.error('Failed to load schedules:', e);
    }

    // Discord 상태 로드
    try {
        const result = await fetchAPI('/api/settings/discord');
        const statusEl = document.getElementById('discord-status');
        if (result.success && result.webhook_url) {
            statusEl.textContent = '✅ 설정됨';
            statusEl.classList.add('status-ok');
        } else {
            statusEl.textContent = '❌ 미설정';
            statusEl.classList.add('status-error');
        }
    } catch (e) {
        const statusEl = document.getElementById('discord-status');
        statusEl.textContent = '⚠️ 확인 실패';
    }

    // Firebase 사용량 로드
    try {
        const result = await fetchAPI('/api/settings/firebase-stats');
        if (result.success) {
            document.getElementById('stat-reads').textContent = result.stats.reads;
            document.getElementById('stat-writes').textContent = result.stats.writes;
            document.getElementById('stat-deletes').textContent = result.stats.deletes;
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

function renderScheduleList(schedules) {
    const container = document.getElementById('schedule-list');
    if (!container) return;

    container.innerHTML = schedules.map(s => `
        <div class="schedule-item" data-id="${s.id}">
            <label class="toggle">
                <input type="checkbox" class="schedule-toggle" ${s.enabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <span class="schedule-name">${s.name}</span>
            <code class="schedule-cron">${s.cron}</code>
            <button class="btn btn-sm btn-delete" onclick="deleteSchedule('${s.id}')">🗑️</button>
        </div>
    `).join('');

    // Toggle events
    container.querySelectorAll('.schedule-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const item = e.target.closest('.schedule-item');
            const id = item.dataset.id;
            await fetchAPI(`/api/settings/schedules/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ enabled: e.target.checked })
            });
        });
    });
}

function setupSettingsEvents() {
    // 닫기
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
        document.getElementById('settings-popup')?.classList.add('hidden');
    });

    // 배경 클릭으로 닫기
    document.getElementById('settings-popup')?.addEventListener('click', (e) => {
        if (e.target.id === 'settings-popup') {
            e.target.classList.add('hidden');
        }
    });

    // 즉시 수집하기
    document.getElementById('btn-collect-now')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-collect-now');
        const statusEl = document.getElementById('collect-status');

        btn.disabled = true;
        btn.textContent = '⏳ 수집 중...';
        statusEl.textContent = '';

        try {
            const result = await fetchAPI('/api/collector/run', { method: 'POST' });
            if (result.success) {
                statusEl.textContent = `✅ 완료! ${result.collected || 0}개 수집 + ${result.extracted || 0}개 추출`;
                statusEl.className = 'collect-status status-ok';
            } else {
                statusEl.textContent = `❌ 실패: ${result.error || result.message || '알 수 없는 오류'}`;
                statusEl.className = 'collect-status status-error';
            }
        } catch (e) {
            statusEl.textContent = `❌ 오류: ${e.message || '네트워크 오류'}`;
            statusEl.className = 'collect-status status-error';
        } finally {
            btn.disabled = false;
            btn.textContent = '📡 지금 즉시 수집하기';
        }
    });

    // 스케줄 추가
    document.getElementById('btn-add-schedule')?.addEventListener('click', async () => {
        const name = prompt('스케줄 이름:');
        const cron = prompt('Cron 표현식 (예: 30 6 * * *):');
        if (name && cron) {
            await fetchAPI('/api/settings/schedules', {
                method: 'POST',
                body: JSON.stringify({ name, cron })
            });
            await loadSettingsData();
        }
    });

    // Discord 테스트
    document.getElementById('btn-test-discord')?.addEventListener('click', async () => {
        const result = await fetchAPI('/api/settings/discord/test', { method: 'POST' });
        alert(result.success ? '✅ 전송 성공!' : '❌ 전송 실패: ' + result.error);
    });

    // 통계 리셋
    document.getElementById('btn-reset-stats')?.addEventListener('click', async () => {
        await fetchAPI('/api/settings/firebase-stats/reset', { method: 'POST' });
        await loadSettingsData();
    });
}

async function deleteSchedule(id) {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return;
    await fetchAPI(`/api/settings/schedules/${id}`, { method: 'DELETE' });
    await loadSettingsData();
}

function addSettingsStyles() {
    if (document.getElementById('settings-styles')) return;

    const style = document.createElement('style');
    style.id = 'settings-styles';
    style.textContent = `
        .settings-modal {
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        .btn-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--text-secondary);
        }
        .settings-section {
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: var(--bg-card);
            border-radius: 6px;
        }
        .settings-section h3 {
            margin-bottom: 0.75rem;
            font-size: 1rem;
        }
        .schedule-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            background: var(--bg-primary);
            border-radius: 4px;
            margin-bottom: 0.5rem;
        }
        .schedule-cron {
            font-size: 0.8rem;
            background: var(--bg-secondary);
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            margin-left: auto;
        }
        .toggle {
            position: relative;
            width: 40px;
            height: 20px;
            flex-shrink: 0;
        }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle .slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--border-color);
            border-radius: 20px;
            transition: 0.3s;
        }
        .toggle .slider:before {
            position: absolute;
            content: "";
            height: 16px; width: 16px;
            left: 2px; bottom: 2px;
            background: white;
            border-radius: 50%;
            transition: 0.3s;
        }
        .toggle input:checked + .slider { background: var(--accent-success); }
        .toggle input:checked + .slider:before { transform: translateX(20px); }
        .stats-row {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        .btn-sm {
            padding: 0.3rem 0.6rem;
            font-size: 0.8rem;
        }
        .form-group {
            margin-bottom: 0.75rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.3rem;
            font-size: 0.9rem;
        }
        .form-group .input {
            width: 100%;
        }
        .discord-status {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.85rem;
        }
        .status-ok { color: var(--accent-success); }
        .status-error { color: var(--accent-danger); }
        .instant-collect {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
        }
        .btn-lg {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
        }
        .collect-status {
            font-size: 0.9rem;
        }
    `;
    document.head.appendChild(style);
}

// 모든 페이지에서 설정 팝업 초기화
document.addEventListener('DOMContentLoaded', () => {
    initSettingsPopup();
});

/**
 * 6. Immediate Collection
 * "즉시 수집" 버튼 핸들러 - 독립 프로그래스바 표시
 */
async function collectNow() {
    const btn = document.getElementById('btn-collect');
    if (!btn) return;

    if (!confirm('지금 즉시 뉴스 수집을 시작하시겠습니까? (약 1분 소요)')) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ 수집중...';
    btn.disabled = true;

    // Show floating progress bar
    showCollectionProgress();

    try {
        const res = await fetch('/api/collector/run', { method: 'POST' });
        const data = await res.json();

        hideCollectionProgress();

        if (data.success) {
            // Show success message briefly
            showCollectionResult(`✅ 수집 완료! (수집: ${data.collected}건, 추출: ${data.extracted}건)`);

            // Auto-refresh list after 1 second
            setTimeout(() => {
                if (typeof loadArticles === 'function') {
                    loadArticles(); // Board
                } else if (typeof PublisherV2 !== 'undefined' && PublisherV2.loadDraftArticles) {
                    PublisherV2.loadDraftArticles(); // Publisher
                } else if (window.location.pathname === '/board' || window.location.pathname === '/analyzer') {
                    window.location.reload();
                }
            }, 1000);
        } else {
            showCollectionResult('❌ 수집 실패: ' + data.error, true);
        }
    } catch (e) {
        hideCollectionProgress();
        showCollectionResult('❌ 네트워크 오류: ' + e.message, true);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * 수집 프로그래스 모달 표시 (블로킹 팝업)
 */
function showCollectionProgress(step = 'collect') {
    // Remove existing if any
    hideCollectionProgress();

    const steps = {
        'collect': { icon: '📥', title: '뉴스 수집 중...', desc: '대상 사이트에서 기사를 가져오고 있습니다' },
        'analyze': { icon: '🤖', title: 'AI 분석 중...', desc: '기사 내용을 분석하고 있습니다' },
        'save': { icon: '💾', title: '저장 중...', desc: '데이터를 저장하고 있습니다' },
    };

    const current = steps[step] || steps['collect'];

    const overlay = document.createElement('div');
    overlay.id = 'collection-progress-overlay';
    overlay.innerHTML = `
        <div class="collection-modal-backdrop"></div>
        <div class="collection-modal-box">
            <div class="modal-icon">${current.icon}</div>
            <div class="modal-title">${current.title}</div>
            <div class="modal-progress-bar">
                <div class="modal-progress-fill"></div>
            </div>
            <div class="modal-desc">${current.desc}</div>
            <div class="modal-steps">
                <span class="${step === 'collect' ? 'active' : ''}">📥 수집</span>
                <span class="arrow">→</span>
                <span class="${step === 'analyze' ? 'active' : ''}">🤖 분석</span>
                <span class="arrow">→</span>
                <span class="${step === 'save' ? 'active' : ''}">💾 저장</span>
            </div>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.id = 'collection-progress-style';
    style.textContent = `
        #collection-progress-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .collection-modal-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
        }
        .collection-modal-box {
            position: relative;
            background: var(--bg-secondary, #1a1a2e);
            border: 2px solid var(--accent-primary, #00d4ff);
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            box-shadow: 0 8px 40px rgba(0, 212, 255, 0.4);
            animation: modalFadeIn 0.3s ease;
        }
        @keyframes modalFadeIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .modal-icon {
            font-size: 48px;
            margin-bottom: 16px;
            animation: bounce 1s ease infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .modal-title {
            font-size: 24px;
            font-weight: bold;
            color: var(--text-primary, #fff);
            margin-bottom: 20px;
        }
        .modal-progress-bar {
            width: 300px;
            height: 8px;
            background: var(--bg-tertiary, #252545);
            border-radius: 4px;
            overflow: hidden;
            margin: 0 auto 16px;
        }
        .modal-progress-fill {
            width: 30%;
            height: 100%;
            background: linear-gradient(90deg, var(--accent-primary, #00d4ff), var(--accent-secondary, #ff6b6b));
            border-radius: 4px;
            animation: progressPulse 1.5s ease-in-out infinite;
        }
        @keyframes progressPulse {
            0% { width: 20%; }
            50% { width: 80%; }
            100% { width: 20%; }
        }
        .modal-desc {
            font-size: 14px;
            color: var(--text-secondary, #888);
            margin-bottom: 24px;
        }
        .modal-steps {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 12px;
            color: var(--text-tertiary, #666);
        }
        .modal-steps span.active {
            color: var(--accent-primary, #00d4ff);
            font-weight: bold;
        }
        .modal-steps .arrow {
            color: var(--text-tertiary, #666);
        }
        .collection-result-modal {
            position: relative;
            background: var(--bg-secondary, #1a1a2e);
            border: 2px solid var(--accent-success, #00ff88);
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            box-shadow: 0 8px 40px rgba(0, 255, 136, 0.4);
            animation: modalFadeIn 0.3s ease;
        }
        .collection-result-modal.error {
            border-color: var(--accent-error, #ff4444);
            box-shadow: 0 8px 40px rgba(255, 68, 68, 0.4);
        }
        .result-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .result-title {
            font-size: 20px;
            font-weight: bold;
            color: var(--text-primary, #fff);
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);
}

/**
 * 수집 단계 업데이트
 */
function updateCollectionStep(step) {
    showCollectionProgress(step);
}

/**
 * 수집 프로그래스바 숨김
 */
function hideCollectionProgress() {
    const overlay = document.getElementById('collection-progress-overlay');
    const style = document.getElementById('collection-progress-style');
    if (overlay) overlay.remove();
    if (style) style.remove();
}

/**
 * 수집 결과 표시 (3초 후 자동 숨김)
 */
function showCollectionResult(message, isError = false) {
    hideCollectionProgress();

    const icon = isError ? '❌' : '✅';

    const overlay = document.createElement('div');
    overlay.id = 'collection-progress-overlay';
    overlay.innerHTML = `
        <div class="collection-modal-backdrop"></div>
        <div class="collection-result-modal ${isError ? 'error' : ''}">
            <div class="result-icon">${icon}</div>
            <div class="result-title">${message}</div>
        </div>
    `;

    // Reuse styles from progress modal (already in head if shown before)
    if (!document.getElementById('collection-progress-style')) {
        const style = document.createElement('style');
        style.id = 'collection-progress-style';
        style.textContent = `
            #collection-progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .collection-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
            }
            .collection-result-modal {
                position: relative;
                background: var(--bg-secondary, #1a1a2e);
                border: 2px solid var(--accent-success, #00ff88);
                border-radius: 16px;
                padding: 40px 60px;
                text-align: center;
                box-shadow: 0 8px 40px rgba(0, 255, 136, 0.4);
                animation: modalFadeIn 0.3s ease;
            }
            @keyframes modalFadeIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .collection-result-modal.error {
                border-color: var(--accent-error, #ff4444);
                box-shadow: 0 8px 40px rgba(255, 68, 68, 0.4);
            }
            .result-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            .result-title {
                font-size: 18px;
                font-weight: bold;
                color: var(--text-primary, #fff);
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    // Auto-hide after 2 seconds
    setTimeout(() => {
        hideCollectionProgress();
    }, 2000);
}

/**
 * 7. Raw Viewer
 */
async function showArticleRaw(articleId) {
    if (!articleId) return;

    showLoading();
    try {
        const res = await fetchAPI(`/api/article/${articleId}/raw`);
        if (res.success) {
            const article = res.article;
            const container = document.getElementById('raw-content');
            container.innerHTML = ''; // Clear previous

            // Set ID for reject button
            const rejectBtn = document.getElementById('btn-raw-reject');
            if (rejectBtn) rejectBtn.dataset.id = articleId;

            // Set ID for classify button
            const classifyBtn = document.getElementById('btn-raw-classify');
            if (classifyBtn) {
                classifyBtn.onclick = () => openClassifyModal(article);
            }



            // Set URL for open button
            const openBtn = document.getElementById('btn-raw-open');
            if (openBtn) {
                const url = article._original?.url;
                openBtn.dataset.url = url || '';
                openBtn.disabled = !url;
            }

            // Display Time Info + Rejection Status
            const timeInfoEl = document.getElementById('raw-time-info');
            if (timeInfoEl) {
                const originalTime = article._original?.published_at ? new Date(article._original.published_at).toLocaleString('ko-KR') : '정보 없음';
                const crawledTime = article._original?.crawled_at ? new Date(article._original.crawled_at).toLocaleString('ko-KR') :
                    (article._header?.created_at ? new Date(article._header.created_at).toLocaleString('ko-KR') : '정보 없음');
                const updatedTime = article._header?.updated_at ? new Date(article._header.updated_at).toLocaleString('ko-KR') : '정보 없음';

                // 폐기 상태 표시
                let rejectionHtml = '';
                if (article._header?.state === 'REJECTED') {
                    const reason = article._rejection?.reason || 'unknown';
                    const reasonMap = {
                        'cutline': '✂️ 커트라인',
                        'duplicate': '🔄 중복',
                        'manual': '👤 수동 폐기',
                        'unknown': '⛔ 폐기됨'
                    };
                    const rejectedAt = article._rejection?.rejected_at ? new Date(article._rejection.rejected_at).toLocaleString('ko-KR') : '';
                    rejectionHtml = `
                    <div style="background: #ff4444; padding: 8px; border-radius: 4px; margin-top: 10px;">
                        <strong>🗑️ 폐기 사유:</strong> ${reasonMap[reason] || `⛔ ${reason}`}
                        ${rejectedAt ? `<span style="margin-left: 15px; opacity: 0.8;">📅 ${rejectedAt}</span>` : ''}
                    </div>`;
                }

                timeInfoEl.innerHTML = `
                    <div>
                        <strong style="color: #4cd137;">📅 기사 원본:</strong> <span>${originalTime}</span>
                    </div>
                    <div>
                        <strong style="color: #00a8ff;">🕷️ 수집:</strong> <span>${crawledTime}</span>
                    </div>
                    <div>
                        <strong style="color: #fbc531;">⚡ 최근 변경:</strong> <span>${updatedTime}</span>
                    </div>
                    ${rejectionHtml}
                `;
            }

            // [NEW] Score Breakdown Visualization
            const scoreHtml = renderScoreBreakdown(article);
            if (scoreHtml) {
                container.innerHTML += scoreHtml;
            }

            const sections = [
                { key: '_header', label: '1. Header (Meta)', cls: 'section-header' },
                { key: '_original', label: '2. Original (Source)', cls: 'section-original' },
                { key: '_analysis', label: '3. Analysis (AI)', cls: 'section-analysis' },
                { key: '_classification', label: '4. Classification (Desk)', cls: 'section-classification' },
                { key: '_rejection', label: '5. Rejection (폐기)', cls: 'section-rejection' },
                { key: '_publication', label: '6. Publication (Output)', cls: 'section-publication' }
            ];

            // Render defined sections first
            sections.forEach(sec => {
                if (article[sec.key]) {
                    const html = `
                        <div class="json-section ${sec.cls}">
                            <span class="json-key">${sec.label}</span>
                            <div class="json-value">${JSON.stringify(article[sec.key], null, 2)}</div>
                        </div>
                    `;
                    container.innerHTML += html;
                }
            });

            // Render others
            const usedKeys = new Set(sections.map(s => s.key));
            Object.keys(article).forEach(key => {
                if (!usedKeys.has(key)) {
                    const html = `
                        <div class="json-section">
                            <span class="json-key">${key}</span>
                            <div class="json-value">${JSON.stringify(article[key], null, 2)}</div>
                        </div>
                    `;
                    container.innerHTML += html;
                }
            });

            document.getElementById('raw-viewer-modal').classList.remove('hidden');
        } else {
            alert('기사 정보를 불러오지 못했습니다: ' + res.error);
        }
    } catch (e) {
        alert('오류 발생: ' + e.message);
    } finally {
        hideLoading();
    }
}

// Close Raw Viewer
document.getElementById('btn-raw-close')?.addEventListener('click', () => {
    document.getElementById('raw-viewer-modal').classList.add('hidden');
});

document.getElementById('btn-raw-reject')?.addEventListener('click', async (e) => {
    const articleId = e.target.dataset.id;
    if (!articleId) return;

    if (!confirm('이 기사를 정말 폐기(Trash)하시겠습니까?')) return;

    showLoading();
    try {
        const result = await fetchAPI('/api/board/move', {
            method: 'POST',
            body: JSON.stringify({
                article_id: articleId,
                to_state: ArticleState.REJECTED
            })
        });

        if (result.success) {
            alert('폐기되었습니다.');
            document.getElementById('raw-viewer-modal').classList.add('hidden');
            loadBoardData(); // Reload board
        } else {
            alert('폐기 실패: ' + result.error);
        }
    } catch (e) {
        alert('오류: ' + e.message);
    } finally {
        hideLoading();
    }
});

document.getElementById('btn-raw-open')?.addEventListener('click', (e) => {
    const url = e.target.dataset.url;
    if (url) {
        window.open(url, '_blank');
    } else {
        alert('이 기사에는 원본 URL 정보가 없습니다.');
    }
});

// Reset Publication (발행 초기화) - 잘못된 발행 상태 복구
document.getElementById('btn-raw-reset-pub')?.addEventListener('click', async () => {
    const rejectBtn = document.getElementById('btn-raw-reject');
    const articleId = rejectBtn?.dataset?.id;
    if (!articleId) return;

    if (!confirm('이 기사의 발행 정보를 초기화하고 CLASSIFIED 상태로 되돌리시겠습니까?\n\n(잘못된 발행 상태를 복구할 때 사용합니다)')) return;

    showLoading();
    try {
        const result = await fetchAPI(`/api/article/${articleId}/reset-publication`, {
            method: 'POST'
        });

        if (result.success) {
            alert('발행 정보가 초기화되었습니다. 다시 발행할 수 있습니다.');
            document.getElementById('raw-viewer-modal').classList.add('hidden');
            if (typeof loadBoardData === 'function') loadBoardData();
            if (typeof PublisherV2 !== 'undefined' && PublisherV2.loadDraftArticles) PublisherV2.loadDraftArticles();
        } else {
            alert('초기화 실패: ' + result.error);
        }
    } catch (e) {
        alert('오류: ' + e.message);
    } finally {
        hideLoading();
    }
});

document.getElementById('raw-viewer-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'raw-viewer-modal') {
        e.target.classList.add('hidden');
    }
});

/**
 * 8. Classification
 */
let currentClassifyingArticleId = null;
let currentBatchCandidates = [];


/**
 * Fetch previous edition article counts (for context display)
 */
async function fetchPreviousEditionCounts() {
    try {
        const res = await fetchAPI('/api/publisher/editions?limit=3');
        if (res.success && res.editions && res.editions.length > 0) {
            return {
                prev1: res.editions[0]?.article_count || 0,
                prev2: res.editions[1]?.article_count || 0,
                prev1_code: res.editions[0]?.edition_code || res.editions[0]?.id || null,
                prev2_code: res.editions[1]?.edition_code || res.editions[1]?.id || null,
                prev1_name: res.editions[0]?.edition_name || res.editions[0]?.name || '이전 1회차',
                prev2_name: res.editions[1]?.edition_name || res.editions[1]?.name || '이전 2회차'
            };
        }
    } catch (e) {
        console.warn('Failed to fetch previous editions:', e);
    }
    return { prev1: 0, prev2: 0, prev1_code: null, prev2_code: null };
}

/**
 * Toggle edition context inclusion in prompt
 * Uses same approach as the existing Context button (regenerates full prompt)
 */
async function toggleEditionContext(editionKey) {
    const toggleEl = document.getElementById(`toggle-${editionKey}`);
    if (!toggleEl) return;

    const included = window._classifyEditionIncluded || {};
    const editionData = window._classifyEditionData || {};

    // Initialize storage for context articles
    if (!window._classifyContextArticles) {
        window._classifyContextArticles = { prev1: [], prev2: [] };
    }

    // Toggle state
    included[editionKey] = !included[editionKey];
    window._classifyEditionIncluded = included;

    // Update UI
    if (included[editionKey]) {
        // Show loading state
        toggleEl.style.opacity = '0.8';
        toggleEl.querySelector('div:last-child').textContent = '⏳ 로딩...';

        // Fetch articles
        const editionCode = editionKey === 'prev1' ? editionData.prev1_code : editionData.prev2_code;

        if (editionCode) {
            try {
                console.log('[toggleEditionContext] Fetching articles for:', editionCode);
                const res = await fetchAPI(`/api/publisher/edition/${editionCode}`);
                console.log('[toggleEditionContext] API response:', res);

                if (res.success && res.articles && res.articles.length > 0) {
                    // Mark as context and store
                    const contextArticles = res.articles.map(a => ({ ...a, _is_context: true }));
                    window._classifyContextArticles[editionKey] = contextArticles;

                    // Update UI to show success
                    toggleEl.style.opacity = '1';
                    toggleEl.style.border = '2px solid #00ff88';
                    toggleEl.querySelector('div:last-child').textContent = '✅ 포함됨';
                    toggleEl.querySelector('div:last-child').style.color = '#00ff88';

                    // Regenerate prompt with context
                    regeneratePromptWithContext();
                    console.log('[toggleEditionContext] Context added:', editionKey, contextArticles.length, 'articles');
                } else {
                    // No articles found
                    included[editionKey] = false;
                    window._classifyEditionIncluded = included;
                    toggleEl.style.opacity = '0.6';
                    toggleEl.querySelector('div:last-child').textContent = '❌ 기사 없음';
                    toggleEl.querySelector('div:last-child').style.color = '#ff4444';
                }
            } catch (e) {
                console.error('[toggleEditionContext] Failed:', e);
                included[editionKey] = false;
                window._classifyEditionIncluded = included;
                toggleEl.style.opacity = '0.6';
                toggleEl.querySelector('div:last-child').textContent = '❌ 오류';
            }
        }
    } else {
        // Remove context
        window._classifyContextArticles[editionKey] = [];

        toggleEl.style.opacity = '0.6';
        toggleEl.style.border = '2px dashed transparent';
        toggleEl.querySelector('div:last-child').textContent = '➕ 클릭하여 추가';
        toggleEl.querySelector('div:last-child').style.color = '#aaa';

        // Regenerate prompt without this context
        regeneratePromptWithContext();
    }
}

/**
 * Regenerate the full batch prompt with all included context
 */
function regeneratePromptWithContext() {
    const contextArticles = window._classifyContextArticles || { prev1: [], prev2: [] };
    const allContext = [...contextArticles.prev1, ...contextArticles.prev2];

    // Combine: Context first (for LLM reference) + Current batch
    const combined = [...allContext, ...currentBatchCandidates];

    const newPrompt = generateBatchPrompt(combined);
    const promptEl = document.getElementById('classify-prompt');
    if (promptEl) {
        promptEl.value = newPrompt;
    }

    console.log('[regeneratePromptWithContext] Total articles in prompt:', combined.length,
        '(Context:', allContext.length, ', New:', currentBatchCandidates.length, ')');
}

/**
 * Generate context prompt for a previous edition
 */
function generateEditionContextPrompt(articles, editionName) {
    let context = `\n\n=== 참고: ${editionName} 기사 목록 ===\n`;
    articles.forEach((a, i) => {
        const title = a.title_ko || a.title || a._classification?.title_ko || '제목 없음';
        const category = a.category || a._classification?.category || '미분류';
        context += `[${i + 1}] ${title} (${category})\n`;
    });
    context += `=== 참고 끝 ===\n`;
    return context;
}

/**
 * Append context to prompt textarea
 */
function appendToPrompt(text, tag) {
    const promptEl = document.getElementById('classify-prompt');
    if (!promptEl) return;

    // Add tagged content
    const taggedContent = `\n<!-- CONTEXT:${tag} -->${text}<!-- /CONTEXT:${tag} -->`;
    promptEl.value += taggedContent;
}

/**
 * Remove tagged context from prompt
 */
function removeFromPrompt(tag) {
    const promptEl = document.getElementById('classify-prompt');
    if (!promptEl) return;

    // Match the context block including newlines
    const startMarker = `<!-- CONTEXT:${tag} -->`;
    const endMarker = `<!-- /CONTEXT:${tag} -->`;

    const startIdx = promptEl.value.indexOf(startMarker);
    const endIdx = promptEl.value.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
        const before = promptEl.value.substring(0, startIdx);
        const after = promptEl.value.substring(endIdx + endMarker.length);
        // Remove leading newline if present
        promptEl.value = before.replace(/\n$/, '') + after;
        console.log('[removeFromPrompt] Removed context:', tag);
    } else {
        console.log('[removeFromPrompt] Context not found:', tag);
    }
}

// Make global for HTML onclick
window.openClassifyModal = openClassifyModal;

async function openClassifyModal(article) {
    console.log('openClassifyModal called', article);
    if (!kanbanData) kanbanData = {}; // Safety check

    if (article) {
        currentClassifyingArticleId = article.id || article._header?.article_id;
        const original = article._original || {};
        const title = original.title || '제목 없음';

        // Generate Prompt
        const prompt = generatePrompt(original);

        document.getElementById('classify-prompt').value = prompt;
        document.getElementById('classify-title-input').value = title;
    } else {
        // General Tool Mode (Batch Classification for ANALYZED + CLASSIFIED items)
        currentClassifyingArticleId = null;

        // 분석완료(ANALYZED) + 분류완료(CLASSIFIED) 모두 투입 가능
        const analyzedArticles = kanbanData[ArticleState.ANALYZED]?.articles || [];
        const classifiedArticles = kanbanData[ArticleState.CLASSIFIED]?.articles || [];
        const candidates = [...analyzedArticles, ...classifiedArticles];
        currentBatchCandidates = candidates; // Store global

        if (candidates.length > 0) {
            const prompt = generateBatchPrompt(candidates);
            document.getElementById('classify-prompt').value = prompt;
            // Show detailed stats with breakdown and clickable edition toggles
            const prevEditions = await fetchPreviousEditionCounts();

            // Store edition data for toggle functionality
            window._classifyEditionData = prevEditions;
            window._classifyEditionIncluded = { prev1: false, prev2: false };

            const statsEl = document.getElementById('batch-stats-display');
            if (statsEl) statsEl.innerHTML = `
                <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; align-items: center;">
                    <div style="background: #e17055; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px;">
                        <div style="font-size: 24px; font-weight: bold;">${candidates.length}</div>
                        <div style="font-size: 10px;">🆕 신규 분류대상</div>
                    </div>
                    <div style="background: #00b894; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px;">
                        <div style="font-size: 24px; font-weight: bold;">${classifiedArticles.length}</div>
                        <div style="font-size: 10px;">✅ 분류완료 대기</div>
                    </div>
                    <div id="toggle-prev1" onclick="toggleEditionContext('prev1')" 
                         style="background: #636e72; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px; cursor: pointer; opacity: 0.6; border: 2px dashed transparent; transition: all 0.2s;"
                         title="클릭하여 프롬프트에 포함">
                        <div style="font-size: 24px; font-weight: bold;">${prevEditions.prev1 || 0}</div>
                        <div style="font-size: 10px;">📚 이전 1회차</div>
                        <div style="font-size: 9px; margin-top: 4px; color: #aaa;">➕ 클릭하여 추가</div>
                    </div>
                    <div id="toggle-prev2" onclick="toggleEditionContext('prev2')"
                         style="background: #2d3436; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px; cursor: pointer; opacity: 0.6; border: 2px dashed transparent; transition: all 0.2s;"
                         title="클릭하여 프롬프트에 포함">
                        <div style="font-size: 24px; font-weight: bold;">${prevEditions.prev2 || 0}</div>
                        <div style="font-size: 10px;">📚 이전 2회차</div>
                        <div style="font-size: 9px; margin-top: 4px; color: #aaa;">➕ 클릭하여 추가</div>
                    </div>
                </div>
                <p style="text-align: center; color: #888; font-size: 11px; margin-top: 10px;">이전 회차 박스를 클릭하면 프롬프트에 컨텍스트가 추가됩니다</p>
            `;
        } else {
            document.getElementById('classify-prompt').value = '분석완료(ANALYZED) 상태의 기사가 없습니다.';
            const statsEl = document.getElementById('batch-stats-display');
            if (statsEl) statsEl.innerHTML = `<p style="text-align:center; color: #888;">분류 대상 없음</p>`;
        }
    }

    // Common Reset
    const resultEl = document.getElementById('classify-result');
    if (resultEl) resultEl.value = '';

    const categorySelect = document.getElementById('classify-category');
    if (categorySelect) categorySelect.value = '';

    document.getElementById('classification-modal').classList.remove('hidden');
}

function generatePrompt(original) {
    return `SOURCE TITLE: ${original.title}
SOURCE TEXT:
${original.text ? original.text.substring(0, 1500).replace(/\s+/g, ' ') : 'No text content.'} ... (truncated)`;
}

function renderScoreBreakdown(article) {
    const analysis = article._analysis || {};
    let impactEvidence = analysis.impact_evidence || {};
    let zsEvidence = analysis.evidence || {};

    // [Fallback] Parse mll_raw if detailed evidence is missing
    const mllRaw = analysis.mll_raw || {};

    // Fallback Parsing Logic (same as before)
    if (Object.keys(impactEvidence).length === 0 && mllRaw.IS_Analysis) {
        impactEvidence = { calculations: mllRaw.IS_Analysis.Calculations };
    }
    if (Object.keys(zsEvidence).length === 0 && mllRaw.ZES_Raw_Metrics) {
        const rawZes = mllRaw.ZES_Raw_Metrics;
        zsEvidence = {
            breakdown: {
                Signal_Components: rawZes.Signal,
                Noise_Components: rawZes.Noise,
                Utility_Multipliers: rawZes.Utility
            }
        };
    }

    if (Object.keys(impactEvidence).length === 0 && Object.keys(zsEvidence).length === 0) return '';

    let html = `
        <div style="margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
        <h4 style="margin-top:0; margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">📊 점수 산출 로직 (Score Breakdown) - V1.0</h4>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
    `;

    // ---------------------------------------------------------
    // 1. IS Breakdown (V1: IW + IE)
    // ---------------------------------------------------------
    const calculations = impactEvidence.calculations || {};
    const iw = calculations.IW_Analysis || {};
    const ie = calculations.IE_Analysis || {};
    const iwInputs = iw.Inputs || {};
    const ieInputs = ie.Inputs || {};

    // Scores
    const tierScore = parseFloat(iw.Tier_Score !== undefined ? iw.Tier_Score : (iw.Scores?.Tier_Score || 0));
    const gapScore = parseFloat(iw.Gap_Score !== undefined ? iw.Gap_Score : (iw.Scores?.Gap_Score || 0));
    const iwTotal = tierScore + gapScore;

    const scopeScore = parseFloat(ie.IE_Score !== undefined ? ie.IE_Score : (ie.Scores?.Scope_Score || 0)); // Fallback logic is tricky, usually IE_Score is total in raw
    // In raw: "IE_Score": 5. Inputs: Scope_Matrix_Score: 3, Criticality_Total: 2.
    // So usually IE_Score holds the total. Let's try to reconstruct if possible.
    const valScope = parseFloat(ieInputs.Scope_Matrix_Score || ieInputs.Information_Scope || 0);
    const valCrit = parseFloat(ieInputs.Criticality_Total || ieInputs.Criticality || 0);
    const ieTotal = valScope + valCrit;

    // Use values if straightforward
    const displayScope = valScope || scopeScore; // If breakdown available
    const displayCrit = valCrit;

    if (Object.keys(calculations).length > 0) {
        html += `
            <div style="flex: 1; min-width: 300px; background: #2f3640; padding: 10px; border-radius: 6px;">
                <div style="color: #e1b12c; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom:5px;">
                    Impact Score (IS) = IW + IE
                </div>
                
                <!-- IW Section -->
                <div style="margin-bottom: 10px;">
                    <div style="font-size: 0.85em; color: #aaa; margin-bottom: 4px;">Impact Weight (IW) = Tier + Gap</div>
                    <table style="width: 100%; font-size: 0.9em;">
                        <tr><td>Market Tier (${iwInputs.Pe_Tier || '-'})</td><td style="text-align:right;">${tierScore.toFixed(1)}</td></tr>
                        <tr><td>Gap Score (x${iwInputs.Gap_Multiplier || '-'})</td><td style="text-align:right;">+ ${gapScore.toFixed(1)}</td></tr>
                        <tr style="border-top: 1px dashed #555; font-weight: bold;">
                            <td style="color: #ddd;">IW Total</td>
                            <td style="text-align:right;">= ${iwTotal.toFixed(1)}</td>
                        </tr>
                    </table>
                </div>

                <!-- IE Section -->
                <div style="margin-bottom: 10px;">
                    <div style="font-size: 0.85em; color: #aaa; margin-bottom: 4px;">Impact Echo (IE) = Scope + Criticality</div>
                    <table style="width: 100%; font-size: 0.9em;">
                        <tr><td>Scope</td><td style="text-align:right;">${displayScope.toFixed(1)}</td></tr>
                        <tr><td>Criticality</td><td style="text-align:right;">+ ${displayCrit.toFixed(1)}</td></tr>
                        <tr style="border-top: 1px dashed #555; font-weight: bold;">
                            <td style="color: #ddd;">IE Total</td>
                            <td style="text-align:right;">= ${ieTotal.toFixed(1)}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 10px; border-top: 1px solid #777; padding-top: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight:bold; color: #fff;">Final IS</span>
                    <span style="font-weight:bold; color: #e1b12c; font-size: 1.2em;">${analysis.impact_score?.toFixed(1) ?? '-'}</span>
                </div>
            </div>
        `;
    }

    // ---------------------------------------------------------
    // 2. ZES Breakdown (V1: 10 - Weighted)
    // ---------------------------------------------------------
    const breakdown = zsEvidence.breakdown || {};
    const signal = breakdown.Signal || breakdown.Signal_Components || {};
    const noise = breakdown.Noise || breakdown.Noise_Components || {};
    const util = breakdown.Utility || breakdown.Utility_Multipliers || {};

    if (Object.keys(signal).length > 0) {
        // Calculate Averages
        const sAvg = ((parseFloat(signal.T1 || signal.T1_Freshness || 0) + parseFloat(signal.T2 || signal.T2_Global_Factor || 0) + parseFloat(signal.T3 || signal.T3_Detailed_Specifics || 0)) / 3.0);
        const nAvg = ((parseFloat(noise.P1 || noise.P_Series_Sum || 0) + parseFloat(noise.P2 || noise.P_Series_Sum || 0) + parseFloat(noise.P3 || noise.P_Series_Sum || 0)) / 3.0);
        // Note: noise structure uses P1..P3 usually, or if raw shows P_Series_Sum it might be sum?
        // User raw json structure: "Noise": { "P1": 2, "P2": 3, "P3": 2 }
        // Code above handles P1..P3 safely if mapped from mllRaw to Evidence.Network structure?
        // My fallback map: Noise_Components: rawZes.Noise. So valid keys are P1, P2, P3.

        let uAvg = 1.0;
        if (util.V1 !== undefined) {
            uAvg = (parseFloat(util.V1) + parseFloat(util.V2) + parseFloat(util.V3)) / 3.0;
        } else if (util.Combined_Multiplier !== undefined) {
            uAvg = parseFloat(util.Combined_Multiplier);
        }
        uAvg = Math.max(1.0, uAvg);

        html += `
            <div style="flex: 1; min-width: 300px; background: #2f3640; padding: 10px; border-radius: 6px;">
                <div style="color: #00cec9; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom:5px;">
                    Zero Echo Score (ZES)
                </div>
                
                <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
                    <!-- Components -->
                    <tr style="border-bottom: 1px solid #555;"><th style="text-align:left; color:#aaa;">Factor</th><th style="text-align: center; color:#aaa;">Avg</th><th style="text-align:right; color:#ddd;">Inputs</th></tr>
                    
                    <tr>
                        <td>Signal (S)</td>
                        <td style="text-align:center; font-weight:bold; color: #74b9ff;">${sAvg.toFixed(1)}</td>
                        <td style="text-align:right; font-size: 0.8em; color: #aaa;">T: ${(signal.T1 || 0)}, ${(signal.T2 || 0)}, ${(signal.T3 || 0)}</td>
                    </tr>
                    <tr>
                        <td>Noise (N)</td>
                        <td style="text-align:center; font-weight:bold; color: #ff7675;">${nAvg.toFixed(1)}</td>
                        <td style="text-align:right; font-size: 0.8em; color: #aaa;">P: ${(noise.P1 || 0)}, ${(noise.P2 || 0)}, ${(noise.P3 || 0)}</td>
                    </tr>
                    <tr>
                        <td>Utility (U)</td>
                        <td style="text-align:center; font-weight:bold; color: #a29bfe;">${uAvg.toFixed(1)}</td>
                        <td style="text-align:right; font-size: 0.8em; color: #aaa;">V: ${(util.V1 || 0)}, ${(util.V2 || 0)}, ${(util.V3 || 0)}</td>
                    </tr>
                </table>

                <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.85em; font-family: monospace; color: #dfe6e9;">
                    Formula:<br>
                    10 - [ ((S + 10 - N)/2) * (U/10) ]
                </div>
                
                <div style="margin-top: 10px; border-top: 1px solid #777; padding-top: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight:bold; color: #fff;">Final ZES</span>
                    <span style="font-weight:bold; color: #00cec9; font-size: 1.2em;">${analysis.zero_echo_score?.toFixed(1) ?? '-'}</span>
                </div>
            </div>
        `;
    }

    html += `</div></div>`;
    return html;
}

function generateBatchPrompt(articles) {
    let text = ``;

    articles.forEach((art, idx) => {
        const isContext = art._is_context;
        const titleRef = isContext ? `[PRE-CLASSIFIED / REFERENCE] ${art.title}` : `[TARGET] ${art.title}`;

        text += `[Article ${idx + 1}]\n`;
        text += `ID: ${art.article_id || art.id}\n`;
        text += `Title: ${titleRef}\n`;
        text += `Summary: ${art.summary || 'No summary'}\n`;
        const is = art.impact_score ?? 0;
        const zs = art.zero_echo_score ?? 5;
        const basePriority = is + (10 - zs);
        const priority = isContext ? (basePriority + 100).toFixed(1) : basePriority.toFixed(1);
        text += `IS: ${art.impact_score ?? '-'} / ZS: ${art.zero_echo_score ?? '-'} / Priority: ${priority}\n`;
        if (isContext) {
            text += `Category: ${art.category || 'Unknown'}\n`;
            text += `State: PUBLISHED/REFERENCE\n`;
        }
        text += `--------------------------------------------------\n`;
    });

    return text;
}

// Global variable to store last parsed classification result
let lastParsedClassification = null;

/**
 * Parse classification JSON result and compute stats
 * @param {string} text - JSON text from textarea
 * @returns {object|null} - Parsed result with stats, or null if invalid
 */
function parseClassificationResult(text) {
    try {
        const objStart = text.indexOf('{');
        const objEnd = text.lastIndexOf('}');

        if (objStart < 0 || objEnd <= objStart) return null;

        const parsedData = JSON.parse(text.substring(objStart, objEnd + 1));

        if (!parsedData.results || !Array.isArray(parsedData.results) || parsedData.results.length === 0) {
            return null;
        }

        // Get target and context IDs
        const targetIdSet = new Set((currentBatchCandidates || [])
            .filter(a => !a._is_context)
            .map(a => a.article_id || a.id));

        const contextIdSet = new Set((currentBatchCandidates || [])
            .filter(a => a._is_context)
            .map(a => a.article_id || a.id));

        // Collect classified IDs and build tasks
        const classifiedIds = new Set();
        const allTasks = [];
        const targetTasks = [];
        const stats = {};

        parsedData.results.forEach(group => {
            const category = group.category || 'Unknown';
            (group.article_ids || []).forEach(id => {
                classifiedIds.add(id);
                allTasks.push({ article_id: id, category });

                if (targetIdSet.has(id)) {
                    targetTasks.push({ article_id: id, category });
                    stats[category] = (stats[category] || 0) + 1;
                }
            });
        });

        // Find duplicates
        const duplicateIds = [...targetIdSet].filter(id => !classifiedIds.has(id));

        return {
            valid: true,
            targetCount: targetIdSet.size,
            contextCount: contextIdSet.size,
            totalPromptArticles: targetIdSet.size + contextIdSet.size,
            targetClassified: targetTasks.length,
            duplicateCount: duplicateIds.length,
            duplicateIds,
            targetTasks,
            stats
        };
    } catch (e) {
        console.error('[parseClassificationResult] Error:', e);
        return null;
    }
}


// Add Context (Recent History)
document.getElementById('btn-add-context')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-add-context');
    const promptEl = document.getElementById('classify-prompt');

    if (btn.disabled) return;

    const originalText = btn.textContent;
    btn.textContent = '⏳ 불러오는 중...';
    btn.disabled = true;

    try {
        const res = await fetchAPI('/api/board/context/recent?limit=2');
        if (res.success && res.articles.length > 0) {
            // Mark context articles
            const contextArticles = res.articles.map(a => ({ ...a, _is_context: true }));

            // Combine with current batch (Context first for LLM reference)
            const combined = [...contextArticles, ...currentBatchCandidates];

            const newPrompt = generateBatchPrompt(combined);
            promptEl.value = newPrompt;

            // Update stats display with counts
            const statsEl = document.getElementById('batch-stats-display');
            if (statsEl) statsEl.innerHTML = `
                <div style="display: flex; gap: 15px; justify-content: center; align-items: center;">
                    <div style="background: #0984e3; color: white; padding: 12px 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold;">${currentBatchCandidates.length}</div>
                        <div style="font-size: 11px;">🎯 분류 대상</div>
                    </div>
                    <div style="background: #00b894; color: white; padding: 12px 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold;">${contextArticles.length}</div>
                        <div style="font-size: 11px;">📚 참고(2회차)</div>
                    </div>
                </div>
                <p style="text-align: center; color: #00b894; font-size: 11px; margin-top: 10px;">✅ 참고 데이터 포함됨</p>
            `;

            btn.textContent = '✅ 추가됨';

        } else {
            alert('추가할 과거 기사 정보가 없습니다.');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        alert('오류: ' + e.message);
        btn.textContent = originalText;
        btn.disabled = false;
    }
});


// Copy Prompt
document.getElementById('btn-copy-prompt')?.addEventListener('click', () => {
    const prompt = document.getElementById('classify-prompt');
    prompt.select();
    document.execCommand('copy');

    const btn = document.getElementById('btn-copy-prompt');
    const originalText = btn.textContent;
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = originalText, 2000);
});

// Auto-Parse Result on Input & Show Stats (uses shared parseClassificationResult)
document.getElementById('classify-result')?.addEventListener('input', (e) => {
    try {
        const text = e.target.value;

        // Use shared parsing function
        const parsed = parseClassificationResult(text);
        lastParsedClassification = parsed;  // Store for confirm handler

        if (parsed) {
            let html = `<div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
                <div style="background: #636e72; color: white; padding: 10px 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold;">${parsed.totalPromptArticles}</div>
                    <div style="font-size: 11px;">프롬프트 총 기사</div>
                    <div style="font-size: 9px; color: #ddd;">(대상: ${parsed.targetCount} + 참고: ${parsed.contextCount})</div>
                </div>
                <div style="background: #00b894; color: white; padding: 10px 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold;">${parsed.targetClassified}</div>
                    <div style="font-size: 11px;">분류됨</div>
                </div>
                <div style="background: #d63031; color: white; padding: 10px 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold;">${parsed.duplicateCount}</div>
                    <div style="font-size: 11px;">중복 폐기</div>
                </div>
            </div>`;

            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">`;
            for (const [cat, count] of Object.entries(parsed.stats)) {
                html += `<div style="background: #2d3436; padding: 6px; border-radius: 4px; border: 1px solid #636e72; text-align: center; font-size: 12px;">
                    <strong style="color: #74b9ff;">${cat}</strong>: ${count}
                </div>`;
            }
            html += `</div>`;

            document.getElementById('batch-stats-display').innerHTML = html;
            return;
        }

        // Fallback: Old array format
        const jsonStart = text.indexOf('[');
        const jsonEnd = text.lastIndexOf(']');

        let data = [];
        if (jsonStart >= 0 && jsonEnd >= 0) {
            data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
        }

        // Render Stats (old format)
        if (Array.isArray(data) && data.length > 0) {
            const total = data.length;
            const stats = {};
            let duplicates = 0;

            data.forEach(item => {
                const cat = item.category || 'Unknown';
                if (cat === 'REJECTED' || cat === 'DUPLICATE' || item.is_duplicate) {
                    duplicates++;
                } else {
                    stats[cat] = (stats[cat] || 0) + 1;
                }
            });

            let html = `<div style="display: flex; gap: 20px; justify-content: center; margin-bottom: 15px;">
                <div style="background: #00b894; color: white; padding: 10px 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${total}</div>
                    <div style="font-size: 12px;">Total Input</div>
                </div>
                <div style="background: #0984e3; color: white; padding: 10px 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${total - duplicates}</div>
                    <div style="font-size: 12px;">Classified</div>
                </div>
                <div style="background: #d63031; color: white; padding: 10px 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${duplicates}</div>
                    <div style="font-size: 12px;">Rejected/Dup</div>
                </div>
            </div>`;

            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">`;
            for (const [cat, count] of Object.entries(stats)) {
                html += `<div style="background: #2d3436; padding: 8px; border-radius: 4px; border: 1px solid #636e72; text-align: center;">
                    <strong style="color: #74b9ff;">${cat}</strong>: ${count}
                </div>`;
            }
            html += `</div>`;

            document.getElementById('batch-stats-display').innerHTML = html;
        }

    } catch (err) {
        // Ignore parse errors while typing
        // console.error(err);
    }
});

document.getElementById('btn-classify-confirm')?.addEventListener('click', async () => {

    // Parse JSON from textarea
    const text = document.getElementById('classify-result').value;
    let parsedData = null;

    try {
        // Find JSON object or array
        const objStart = text.indexOf('{');
        const objEnd = text.lastIndexOf('}');
        if (objStart >= 0 && objEnd > objStart) {
            parsedData = JSON.parse(text.substring(objStart, objEnd + 1));
        }
    } catch (e) {
        alert('JSON 파싱 오류: ' + e.message);
        return;
    }

    if (!parsedData) {
        alert('처리할 데이터가 없습니다.');
        return;
    }

    // Use shared parsed result if available, otherwise re-parse
    let parsed = lastParsedClassification;
    if (!parsed) {
        parsed = parseClassificationResult(text);
    }

    if (!parsed || !parsed.valid) {
        alert('results 배열이 비어있거나 유효하지 않습니다.');
        return;
    }

    console.log('[Classify] Using parsed result:', parsed);

    const { targetTasks, duplicateIds, targetClassified, duplicateCount } = parsed;

    if (!confirm(`분류: ${targetClassified}건, 중복 폐기: ${duplicateCount}건을 처리하시겠습니까?`)) return;

    showLoading();
    let successCount = 0;
    let processedDuplicateCount = 0;

    try {
        // 1. Process classifications (only target articles)
        const classifyPromises = targetTasks.map(task =>
            fetchAPI('/api/board/classify', {
                method: 'POST',
                body: JSON.stringify({
                    article_id: task.article_id,
                    category: task.category
                })
            })
        );

        // 2. Process duplicates (reject with duplicate flag)
        const duplicatePromises = duplicateIds.length > 0
            ? [fetchAPI('/api/publisher/reject', {
                method: 'POST',
                body: JSON.stringify({
                    article_ids: duplicateIds,
                    reason: 'duplicate'
                })
            })]
            : [];

        const [classifyResults, ...duplicateResults] = await Promise.all([
            Promise.all(classifyPromises),
            ...duplicatePromises
        ]);

        successCount = classifyResults.filter(r => r.success).length;
        processedDuplicateCount = duplicateResults.length > 0 && duplicateResults[0]?.success
            ? duplicateIds.length : 0;

    } catch (e) {
        console.error(e);
        alert('일괄 처리 중 오류 발생: ' + e.message);
    }

    hideLoading();
    alert(`분류 완료: ${successCount}건 / 중복 폐기: ${processedDuplicateCount}건`);
    closeModal('classification-modal');
    loadBoardData(); // Refresh
});

document.getElementById('btn-classify-cancel')?.addEventListener('click', () => {
    document.getElementById('classification-modal').classList.add('hidden');
});

