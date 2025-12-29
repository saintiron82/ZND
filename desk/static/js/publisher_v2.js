/**
 * Publisher V2 Logic
 * - Tab-based interface: Draft (New Publication) vs History (Review)
 * - Strict Separation of Concerns
 */

const PublisherV2 = {
    state: {
        currentTab: 'draft', // 'draft' | 'history'
        selectedEditionCode: null,
        draftArticles: [],
        historyEditions: [],
        historyArticles: [],
        selectedDraftIds: new Set()
    },

    async init() {
        // alert('DEBUG: Publisher V2 Init Start'); // Debugging
        console.log('🚀 Publisher V2 Initializing...');
        this.setupTabs();
        this.setupDraftEvents();
        this.setupHistoryEvents();

        // Load persist settings
        this.loadCutlineSettings();

        // Default load
        await this.loadHistoryEditions(); // Load sidebar data
        await this.loadDraftArticles();
        this.suggestNextEdition();

        // Auto-apply cutline visual filter based on loaded settings
        this.updateCutlinePreview();
    },

    loadCutlineSettings() {
        const storedIS = localStorage.getItem('publisher_cutline_is');
        const storedZS = localStorage.getItem('publisher_cutline_zs');

        if (storedIS !== null) {
            document.getElementById('cutlineIS').value = storedIS;
            document.getElementById('cutlineISValue').textContent = parseFloat(storedIS).toFixed(1);
        }
        if (storedZS !== null) {
            document.getElementById('cutlineZS').value = storedZS;
            document.getElementById('cutlineZSValue').textContent = parseFloat(storedZS).toFixed(1);
        }
    },

    saveCutlineSettings() {
        const isValue = document.getElementById('cutlineIS').value;
        const zsValue = document.getElementById('cutlineZS').value;
        localStorage.setItem('publisher_cutline_is', isValue);
        localStorage.setItem('publisher_cutline_zs', zsValue);
    },

    // =========================================================================
    // UI Helpers
    // =========================================================================

    setupTabs() {
        const tabDraft = document.getElementById('tab-btn-draft');
        const tabHistory = document.getElementById('tab-btn-history');

        tabDraft?.addEventListener('click', () => this.switchTab('draft'));
        tabHistory?.addEventListener('click', () => this.switchTab('history'));
    },

    switchTab(tabName) {
        this.state.currentTab = tabName;

        // UI Toggle
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-btn-${tabName}`).classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`view-${tabName}`).classList.remove('hidden');

        // Load data on switch
        if (tabName === 'history') {
            this.loadHistoryEditions();
        } else {
            this.loadDraftArticles(); // This will use the new split logic
            this.suggestNextEdition(); // Auto-fill suggestion
        }
    },




    suggestNextEdition() {
        // Force calculation always

        // Fetch format & history if needed
        fetchAPI('/api/publisher/editions?limit=1')
            .then(res => {
                if (!res.success) {
                    console.error('API Error:', res);
                    // Fallback calculation
                    this._calcAndSetNext(null, '{N}호');
                    return;
                }

                const format = res.edition_name_format || '{N}호';
                this.state.editionFormat = format; // Store for publish

                // historyEditions가 로드되지 않았으면 res에서 사용
                const latest = (this.state.historyEditions.length > 0)
                    ? this.state.historyEditions[0]
                    : (res.editions && res.editions.length > 0 ? res.editions[0] : null);

                this._calcAndSetNext(latest, format);
            })
            .catch(err => {
                console.error('Fetch Error:', err);
                // Fallback on error
                this._calcAndSetNext(null, '{N}호');
            });
    },

    _calcAndSetNext(latestEdition, format = '{N}호') {
        const today = new Date();
        const yy = String(today.getFullYear()).slice(2); // YYYY -> YY
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');

        // Target Format: YYMMDD_N (e.g. 251227_1)
        const dateStr = `${yy}${mm}${dd}`;

        let nextNum = 1;

        if (latestEdition && (latestEdition.code || latestEdition.edition_code)) {
            const editionCode = latestEdition.code || latestEdition.edition_code;
            const parts = editionCode.split('_');

            // Expected format check (2 parts: YYMMDD, N)
            // e.g. 251227_5
            if (parts.length === 2) {
                const editionDateStr = parts[0];
                if (editionDateStr === dateStr) {
                    nextNum = parseInt(parts[1]) + 1;
                }
            }
        }

        const nextCode = `${dateStr}_${nextNum}`;
        // const nextName = format.replace('{N}', nextNum); // Old logic

        // Update UI logic for Split Format
        const parts = format.split('{N}');
        const prefix = parts[0] || '';
        const suffix = parts[1] || '';

        const prefixEl = document.getElementById('edition-prefix');
        const suffixEl = document.getElementById('edition-suffix');
        const numberInput = document.getElementById('edition-number');
        const codeInput = document.getElementById('edition-code');

        if (prefixEl) prefixEl.textContent = prefix;
        if (suffixEl) suffixEl.textContent = suffix;
        if (numberInput) numberInput.value = nextNum;
        if (codeInput) codeInput.value = nextCode;

        // Add listener to auto-update code when number changes (optional but good for consistency)
        if (numberInput && !numberInput.dataset.listenerAdded) {
            numberInput.dataset.listenerAdded = 'true';
            numberInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (codeInput && val) {
                    // Keep date part, update index
                    const currentCode = codeInput.value;
                    if (currentCode.includes('_')) {
                        const datePart = currentCode.split('_')[0];
                        codeInput.value = `${datePart}_${val}`;
                    }
                }
            });
        }
    },

    showLoading() {
        document.getElementById('loading')?.classList.remove('hidden');
    },

    hideLoading() {
        document.getElementById('loading')?.classList.add('hidden');
    },

    // =========================================================================
    // Draft View (New Publication)
    // =========================================================================

    async loadDraftArticles() {
        this.showLoading();
        try {
            // Only CLASSIFIED (발행 대기) + REJECTED (폐기) - ANALYZED는 Board에서 분류 필요
            const url = `/api/publisher/list?state=classified,rejected`;
            const result = await fetchAPI(url);

            if (result.success) {
                // Categorize articles by state
                const classified = result.articles.filter(a =>
                    a.state === 'CLASSIFIED' || a.state === 'classified'
                );
                const rejected = result.articles.filter(a =>
                    a.state === 'REJECTED' || a.state === 'rejected'
                );

                // Store state counts for stats display
                this.state.statsCounts = {
                    analyzed: 0,  // Not shown in Publisher
                    classified: classified.length,
                    rejected: rejected.length,
                    total: classified.length
                };

                // Draft = CLASSIFIED only (ANALYZED must be classified in Board first)
                this.state.draftArticles = [...classified];
                this.state.rejectedArticles = rejected;

                this.renderDraftCards();
                this.renderRejectedCards();
                this.updateStats();
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load draft articles');
        } finally {
            this.hideLoading();
        }
    },

    updateStats() {
        const statsEl = document.getElementById('stats');
        if (!statsEl) return;

        const counts = this.state.statsCounts || { analyzed: 0, classified: 0, rejected: 0, total: 0 };

        statsEl.innerHTML = `
            <span style="color: var(--accent-warning, #ffa500);">🆕 신규 분류대상: ${counts.analyzed}개</span>
            <span style="margin: 0 8px; color: #555;">|</span>
            <span style="color: var(--accent-success, #00ff88);">✅ 분류완료 대기: ${counts.classified}개</span>
            <span style="margin: 0 8px; color: #555;">|</span>
            <span style="color: var(--accent-error, #ff4444);">🗑️ 폐기: ${counts.rejected}개</span>
        `;
    },

    renderDraftCards() {
        this.renderCardList('draft-cards', this.state.draftArticles);
    },

    renderRejectedCards() {
        const countSpan = document.getElementById('rejected-count');
        if (countSpan) countSpan.textContent = this.state.rejectedArticles.length;

        // Initially render them, user can toggle visibility
        this.renderCardList('rejected-cards', this.state.rejectedArticles, true);
    },

    renderCardList(containerId, articles, isRejectedList = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Use shared renderArticleCard with publisher options
        container.innerHTML = articles.map(article => {
            const isSelected = this.state.selectedDraftIds.has(article.article_id);

            // 폐기 사유 표시
            let displayCategory = article.category;
            if (isRejectedList) {
                const reason = article.rejected_reason || 'unknown';
                const reasonMap = {
                    'cutline': '✂️ 커트라인',
                    'duplicate': '🔄 중복',
                    'manual': '👤 수동 폐기',
                    'unknown': '⛔ 폐기됨'
                };
                displayCategory = reasonMap[reason] || `⛔ ${reason}`;
            }

            const options = {
                selectable: !isRejectedList, // Rejected items not selectable for publish
                selected: isSelected,
                showCategory: true,
                showSummary: true,
                enlarged: true,
            };

            // Hack for display
            const displayArticle = { ...article, category: displayCategory };

            return renderArticleCard(displayArticle, options);
        }).join('');

        // Card Events (Common)
        container.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const isCheckboxArea = e.target.closest('.card-checkbox-label') || e.target.type === 'checkbox';

                if (isCheckboxArea) {
                    if (isRejectedList) return; // No selection for rejected
                    const checkbox = card.querySelector('.card-checkbox');
                    if (checkbox && e.target.type !== 'checkbox') {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                } else {
                    // View article details
                    const articleId = card.dataset.id;
                    if (typeof showArticleRaw === 'function') {
                        showArticleRaw(articleId); // Global View Function
                    }
                }
            });
        });

        // Checkbox events (only if selectable)
        if (!isRejectedList) {
            container.querySelectorAll('.card-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const card = e.target.closest('.kanban-card');
                    if (e.target.checked) {
                        this.state.selectedDraftIds.add(e.target.value);
                        card.classList.add('selected');
                    } else {
                        this.state.selectedDraftIds.delete(e.target.value);
                        card.classList.remove('selected');
                    }
                    this.updateDraftToolbar();
                });
            });
        }
    },

    toggleRejectedVisibility() {
        const container = document.getElementById('rejected-cards');
        const icon = document.getElementById('rejected-toggle-icon');
        if (container) {
            container.classList.toggle('hidden');
            if (icon) {
                icon.textContent = container.classList.contains('hidden') ? '▼ 펼치기' : '▲ 접기';
            }
        }
    },

    setupDraftEvents() {
        // Select All (Targeting only draft-cards)
        document.getElementById('draft-check-all')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            const checkboxes = document.querySelectorAll('#draft-cards .card-checkbox');

            checkboxes.forEach(cb => {
                if (checked) {
                    cb.checked = true;
                    this.state.selectedDraftIds.add(cb.value);
                    cb.closest('.kanban-card')?.classList.add('selected');
                } else {
                    cb.checked = false;
                    this.state.selectedDraftIds.delete(cb.value);
                    cb.closest('.kanban-card')?.classList.remove('selected');
                }
            });
            this.updateDraftToolbar();
        });

        // Publish Button
        // Publish Button
        document.getElementById('btn-publish-now')?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.state.selectedDraftIds.size === 0) return alert('발행할 기사를 선택하세요.');

            const editionCode = document.getElementById('edition-code').value;
            const editionNum = document.getElementById('edition-number').value;

            if (!editionCode || !editionNum) return alert('회차 코드와 회차 번호를 입력하세요.');

            const format = this.state.editionFormat || '{N}호';
            const editionName = format.replace('{N}', editionNum);

            if (!confirm(`${this.state.selectedDraftIds.size}건의 기사를 [${editionName}]로 발행하시겠습니까?`)) return;

            // Show Progress Modal
            const modal = document.getElementById('progress-modal');
            const bar = document.getElementById('progress-bar');
            const logEl = document.getElementById('progress-log');
            const textEl = document.getElementById('progress-text');
            const btnClose = document.getElementById('btn-progress-close');

            if (modal) {
                modal.classList.remove('hidden');
                if (btnClose) btnClose.classList.add('hidden');
                if (bar) bar.style.width = '0%';
                if (logEl) logEl.innerHTML = '';
                if (textEl) textEl.textContent = '서버 연결 중...';
            }

            try {
                // Use native fetch for streaming support
                const response = await fetch('/api/publisher/publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        article_ids: Array.from(this.state.selectedDraftIds),
                        edition_code: editionCode,
                        edition_name: editionName
                    })
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const msg = JSON.parse(line);

                            if (msg.error) {
                                throw new Error(msg.error);
                            }

                            if (msg.status === 'processing') {
                                const percent = Math.round((msg.current / msg.total) * 100);
                                if (bar) bar.style.width = `${percent}%`;
                                if (textEl) textEl.textContent = `${msg.current}/${msg.total} 처리 중...`;
                                if (msg.message && logEl) {
                                    const logLine = document.createElement('div');
                                    logLine.textContent = `[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg.message}`;
                                    logEl.appendChild(logLine);
                                    logEl.scrollTop = logEl.scrollHeight;
                                }
                            } else if (msg.status === 'completed') {
                                if (bar) bar.style.width = '100%';
                                if (textEl) textEl.textContent = '완료!';
                                const logLine = document.createElement('div');
                                logLine.style.color = '#4caf50';
                                logLine.textContent = `✅ ${msg.success_count}건 발행 완료!`;
                                if (logEl) logEl.appendChild(logLine);
                                logEl.scrollTop = logEl.scrollHeight;
                            }
                        } catch (e) {
                            console.error('JSON Parse error:', e);
                        }
                    }
                }

                // Allow user to see the result briefly
                setTimeout(() => {
                    alert('발행되었습니다!');
                    this.state.selectedDraftIds.clear();
                    if (modal) modal.classList.add('hidden');
                    this.switchTab('history');
                }, 1000);

            } catch (e) {
                console.error(e);
                alert('발행 중 오류 발생: ' + e.message);
                if (btnClose) btnClose.classList.remove('hidden'); // Show close button on error
                if (textEl) textEl.textContent = '오류 발생';
            }
        });
    },

    updateDraftToolbar() {
        const span = document.getElementById('selected-count');
        if (span) span.textContent = `${this.state.selectedDraftIds.size}개 선택됨`;
    },

    // =========================================================================
    // History View (Review & Release)
    // =========================================================================

    async loadHistoryEditions() {
        this.showLoading();
        try {
            const result = await fetchAPI('/api/publisher/editions');
            if (result.success) {
                this.state.historyEditions = result.editions;
                this.renderEditionList(result.env);
            }
        } finally {
            this.hideLoading();
        }
    },

    renderEditionList(envName = 'unknown') {
        const headerHtml = `<div class="edition-list-header">Current Env: <span class="badge-${envName}">${envName}</span></div>`;

        const itemsHtml = this.state.historyEditions.map(ed => {
            const edCode = ed.code || ed.edition_code || 'N/A';
            const edName = ed.name || ed.edition_name || 'N/A';
            const edDate = (ed.updated_at || ed.published_at || '').substring(0, 10);
            const edCount = ed.count || ed.article_count || 0;

            return `
            <div class="edition-item ${this.state.selectedEditionCode === edCode ? 'active' : ''}" 
                 onclick="PublisherV2.goToHistoryEdition('${edCode}')">
                <div class="edition-header">
                    <span class="edition-name">${edName}</span>
                    <span class="edition-date">${edDate}</span>
                </div>
                <div class="edition-meta">
                    Code: ${edCode} | Articles: ${edCount}
                </div>
            </div>
        `;
        }).join('');

        // Update History Sidebar
        const listHistory = document.getElementById('edition-list');
        if (listHistory) listHistory.innerHTML = headerHtml + itemsHtml;

        // Update Draft Sidebar
        const listDraft = document.getElementById('edition-list-draft');
        if (listDraft) listDraft.innerHTML = headerHtml + itemsHtml;
    },

    async goToHistoryEdition(code) {
        // Switch to History Tab if not active
        const historyBtn = document.getElementById('tab-btn-history');
        if (historyBtn && !historyBtn.classList.contains('active')) {
            historyBtn.click();
        }
        // Load data
        await this.selectEdition(code);
    },

    async selectEdition(code) {
        this.state.selectedEditionCode = code;
        this.renderEditionList(); // To update active class

        // Load Details
        this.showLoading();
        try {
            const result = await fetchAPI(`/api/publisher/edition/${code}`);
            if (result.success) {
                this.state.historyArticles = result.articles;
                this.renderHistoryDetail();
            }
        } finally {
            this.hideLoading();
        }
    },

    renderHistoryDetail() {
        const container = document.getElementById('history-detail');
        if (!container) return;

        const articlesHtml = this.state.historyArticles.map((art, idx) => {
            // Use common card renderer, allowing default onClick (showArticleRaw)
            return renderArticleCard(art, {
                selectable: false,
                selected: false,
                showCategory: true,
                showSummary: true, // 요약도 보여주면 더 꽉 차 보임
                enlarged: true     // 카드 확대 모드
            });
        }).join('');

        container.innerHTML = `
            <div class="detail-header" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <h3>${this.state.selectedEditionCode} 상세</h3>
                <div class="actions">
                     <button class="btn btn-danger" style="margin-right: 8px;" onclick="PublisherV2.deleteCurrentEdition()">🗑️ 파기 (Delete)</button>
                     <button class="btn btn-success" onclick="PublisherV2.releaseCurrentEdition()">🌐 전체 공개 (Release)</button>
                </div>
            </div>
            <div class="kanban-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                ${articlesHtml}
            </div>
        `;
    },

    async deleteCurrentEdition() {
        const code = this.state.selectedEditionCode;
        if (!code) return;

        // Safety check for published/released status? 
        // Backend handles logic, but frontend warning is good.
        if (!confirm(`[${code}] 회차를 정말 파기하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없으며, 포함된 모든 기사는 'Draft' 상태로 돌아갑니다.`)) return;

        this.showLoading();
        try {
            // Pass code for ID based deletion
            const result = await fetchAPI(`/api/publisher/edition/${code}`, {
                method: 'DELETE'
            });

            if (result.success) {
                alert(`파기 완료! (${result.reverted_count}건의 기사가 복구되었습니다.)`);
                // Reset Selection
                this.state.selectedEditionCode = null;
                // Reload Everything
                await this.init();
            } else {
                alert('Error: ' + (result.error || 'Unknown error'));
            }
        } finally {
            this.hideLoading();
        }
    },

    async releaseCurrentEdition() {
        const code = this.state.selectedEditionCode;
        if (!code) return;

        if (!confirm(`[${code}] 회차를 웹사이트에 공개하시겠습니까?`)) return;

        this.showLoading();
        try {
            const result = await fetchAPI('/api/publisher/release', {
                method: 'POST',
                body: JSON.stringify({ edition_code: code }) // Sending edition_code for consistency
            });
            if (result.success) {
                alert(`공개 완료! (${result.released_count}건)`);
                this.selectEdition(code); // Reload to show status update
            } else {
                alert('Error: ' + result.error);
            }
        } finally {
            this.hideLoading();
        }
    },

    setupHistoryEvents() {
        // Handled via onclick in HTML generation for simplicity due to scope
    },

    // =========================================================================
    // Article Viewer (Read-Only)
    // =========================================================================

    // For Draft cards - find by article_id
    // viewArticle removed in favor of global showArticleRaw

    // For History cards - find by index


    // =========================================================================
    // Cutline Filter Functions
    // =========================================================================

    updateCutlinePreview() {
        this.saveCutlineSettings(); // Persist changes

        const isValue = parseFloat(document.getElementById('cutlineIS').value);
        const zsValue = parseFloat(document.getElementById('cutlineZS').value);

        document.getElementById('cutlineISValue').textContent = isValue.toFixed(1);
        document.getElementById('cutlineZSValue').textContent = zsValue.toFixed(1);

        // Preview count and real-time blink effect
        const container = document.getElementById('draft-cards');
        let passCount = 0;
        const total = this.state.draftArticles.length;

        container.querySelectorAll('.kanban-card').forEach(card => {
            const artIS = parseFloat(card.dataset.is) || 0;
            const artZS = parseFloat(card.dataset.zs) || 10;

            const isScoreSpan = card.querySelector('.score-is');
            const zsScoreSpan = card.querySelector('.score-zs');

            // Reset blink classes
            isScoreSpan?.classList.remove('blink-warning');
            zsScoreSpan?.classList.remove('blink-warning');

            const isOk = artIS >= isValue;
            const zsOk = artZS <= zsValue;

            if (isOk && zsOk) {
                passCount++;
            }

            // Add blink to problematic scores
            if (!isOk) isScoreSpan?.classList.add('blink-warning');
            if (!zsOk) zsScoreSpan?.classList.add('blink-warning');
        });

        const preview = document.getElementById('cutlinePreview');
        document.getElementById('cutlineCount').textContent = passCount;
        document.getElementById('cutlineTotalCount').textContent = total;
        preview.style.display = 'block';
    },

    async applyCutline() {
        const isValue = parseFloat(document.getElementById('cutlineIS').value);
        const zsValue = parseFloat(document.getElementById('cutlineZS').value);

        // Find articles to reject
        const toReject = [];
        this.state.draftArticles.forEach(article => {
            const artIS = article.impact_score ?? 0;
            const artZS = article.zero_echo_score ?? 10;

            // Criteria: Hide/Reject if IS < Threshold OR ZS > Threshold
            // If article is already rejected, no need to double reject unless we want to update reason?
            // User annoyance: "rejected but disappeared" -> implying they want to see it.
            // If we filter, they disappear. If we reject, they become rejected state.
            // If they are already rejected, we skip to avoid redundant calls.

            const failIS = artIS < isValue;
            const failZS = artZS > zsValue;

            if (failIS || failZS) {
                const isAlreadyRejected = article.state === 'REJECTED' || article.state === 'rejected';
                if (!isAlreadyRejected) {
                    toReject.push(article.article_id || article.id);
                }
            }
        });

        console.log(`[Cutline] IS < ${isValue}, ZS > ${zsValue}`);
        console.log(`[Cutline] Total: ${this.state.draftArticles.length}, ToReject: ${toReject.length}`);

        if (toReject.length === 0) {
            // 디버깅을 위해 상세 메시지 표시
            const sample = this.state.draftArticles.length > 0 ? this.state.draftArticles[0] : null;
            let msg = '새로 폐기할 대상이 없습니다.\n\n';
            msg += `설정: IS(${isValue}), ZS(${zsValue})\n`;
            if (sample) {
                msg += `샘플 기사: IS(${sample.impact_score}), ZS(${sample.zero_echo_score})`;
            }
            alert(msg);
            // Still perform visual filter? No, user wants rejection.
            // If goal is just to filter view, use preview. Apply means ACTION.
            return;
        }

        if (!confirm(`커트라인 미달로 총 ${toReject.length}건의 기사를 폐기하시겠습니까?\n(IS < ${isValue} 또는 ZS > ${zsValue})`)) return;

        this.showLoading();
        try {
            const result = await fetchAPI('/api/publisher/reject', {
                method: 'POST',
                body: JSON.stringify({ article_ids: toReject, reason: 'cutline' })
            });

            if (result.success) {
                alert(`${result.results.length}건 처리 완료`);

                // [UX] 낙관적 업데이트: 화면에서 즉시 제거
                this.state.draftArticles = this.state.draftArticles.filter(a =>
                    !toReject.includes(a.article_id || a.id)
                );
                this.renderDraftCards();

                // UI 필터 초기화
                this.resetCutline();

                // 서버 상태 동기화 (약간의 지연 후)
                setTimeout(() => this.loadDraftArticles(), 500);
            } else {
                alert('Error: ' + result.error);
            }
        } finally {
            this.hideLoading();
        }
    },

    resetCutline() {
        document.getElementById('cutlineIS').value = 0;
        document.getElementById('cutlineZS').value = 10;
        document.getElementById('cutlineISValue').textContent = '0.0';
        document.getElementById('cutlineZSValue').textContent = '10.0';
        document.getElementById('cutlinePreview').style.display = 'none';

        // Show all cards
        const container = document.getElementById('draft-cards');
        container.querySelectorAll('.kanban-card').forEach(card => {
            card.style.display = '';
            // Remove blink classes
            card.querySelector('.score-is')?.classList.remove('blink-warning');
            card.querySelector('.score-zs')?.classList.remove('blink-warning');
        });

        console.log('↩️ 커트라인 초기화');
    }
};

// Global Exposure for inline calls
window.PublisherV2 = PublisherV2;
