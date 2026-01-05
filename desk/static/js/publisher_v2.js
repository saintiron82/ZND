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
        // Use dedicated next-edition API (lastIndex 기반)
        fetchAPI('/api/publisher/next-edition')
            .then(res => {
                if (!res.success) {
                    console.error('API Error:', res);
                    this._setEditionInputs(1, '제1호');
                    return;
                }

                const format = res.edition_name_format || '{N}호';
                this.state.editionFormat = format;

                // API가 이미 계산한 값 사용
                const nextIdx = res.next_index || 1;
                const nextCode = res.next_edition_code;

                this._setEditionInputs(nextIdx, format, nextCode);
            })
            .catch(err => {
                console.error('Fetch Error:', err);
                this._setEditionInputs(1, '제1호');
            });
    },

    _setEditionInputs(nextNum, format, nextCode = null) {
        const today = new Date();
        const yy = String(today.getFullYear()).slice(2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;

        const code = nextCode || `${dateStr}_${nextNum}`;

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
        if (codeInput) codeInput.value = code;

        // Add listener to auto-update code when number changes
        if (numberInput && !numberInput.dataset.listenerAdded) {
            numberInput.dataset.listenerAdded = 'true';
            numberInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (codeInput && val) {
                    codeInput.value = `${dateStr}_${val}`;
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
            // [NEW] Board와 동일한 시간 필터 적용 (localStorage에서 공유)
            const timeRangeHours = parseInt(localStorage.getItem('boardTimeRangeHours')) || 48;
            const sinceTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
            const url = `/api/publisher/list?state=classified,rejected&since=${sinceTime.toISOString()}`;
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

                // [NEW] Calculate Scores & Assign Awards & Sort (Web Logic Sync)
                this.calculateDraftScores(classified);
                this.assignDraftAwards(classified);
                this.sortDraftArticles(classified);

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

    // [NEW] Web Sync Logic: Calculate Combined Scores
    calculateDraftScores(articles) {
        articles.forEach(a => {
            const isA = a.impact_score ?? 0;
            const zeA = a.zero_echo_score ?? 10;

            // Formula: (10 - ZS) + IS
            a.combinedScore = (10 - zeA) + isA;

            // Normalize for safety
            a.impact_score = isA;
            a.zero_echo_score = zeA;
        });
    },

    // [NEW] Web Sync Logic: Assign Awards
    assignDraftAwards(articles) {
        // Clear existing
        articles.forEach(a => { a.awards = []; });

        if (articles.length === 0) return;

        // 1. Today's Headline (Best Combined)
        const byCombo = [...articles].sort((a, b) => b.combinedScore - a.combinedScore);

        // 2. Zero Echo Award (Lowest ZS, Tie-break by IS)
        const byZS = [...articles].sort((a, b) => {
            const zsDiff = a.zero_echo_score - b.zero_echo_score;
            if (Math.abs(zsDiff) < 0.01) return b.impact_score - a.impact_score;
            return zsDiff;
        });

        // 3. Hot Topic (Highest IS)
        const byIS = [...articles].sort((a, b) => b.impact_score - a.impact_score);

        // Assign (Unique Logic)
        if (byCombo.length > 0) byCombo[0].awards.push("Today's Headline");

        if (byZS.length > 0) {
            const winner = byZS[0];
            if (!winner.awards.includes("Today's Headline")) {
                winner.awards.push("Zero Echo Award");
            } else if (byZS.length > 1) {
                // If 1st place already has Headline, give to runner-up if possible (optional Web parity check needed, assuming strict slot logic)
                // Web Logic: "Slot 2: Zero Echo Award (only if different from Headline)"
                // So if same, we look for next best? No, usually distinct winners. Web logic just skips if same ID.
                // Let's stick to simple logic: If already has headline, maybe just add it?
                // Web: "addAward... if (byZS.length > 0) addAward..."
                // Web allows multiple awards per article in candidates, BUT "Phase 0" placement extracts unique top 3.
                // Here we just toggle badges.
                if (!winner.awards.includes("Zero Echo Award")) winner.awards.push("Zero Echo Award");
            }
        }

        if (byIS.length > 0) {
            const winner = byIS[0];
            if (!winner.awards.includes("Hot Topic")) winner.awards.push("Hot Topic");
        }
    },

    // [NEW] Web Sync Logic: Sort for Display
    sortDraftArticles(articles) {
        articles.sort((a, b) => {
            // 1. Award Count Descending (Any award puts it on top)
            const aAwards = a.awards ? a.awards.length : 0;
            const bAwards = b.awards ? b.awards.length : 0;

            if (aAwards !== bAwards) return bAwards - aAwards;

            // 2. Combined Score Descending
            return b.combinedScore - a.combinedScore;
        });
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
            const articleId = article.article_id || article.id;

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

            // 기본 카드 HTML
            let cardHtml = renderArticleCard(displayArticle, options);

            // [NEW] 폐기된 기사에 복원 버튼 추가
            if (isRejectedList) {
                // 카드 끝 </div> 앞에 복원 버튼 삽입
                const restoreBtn = `<button class="btn-restore" onclick="event.stopPropagation(); PublisherV2.restoreArticle('${articleId}')" style="position: absolute; bottom: 8px; right: 8px; background: #10b981; color: white; padding: 4px 10px; font-size: 0.75em; border-radius: 4px; border: none; cursor: pointer;">↩️ 복원</button>`;
                // 카드에 position:relative 추가하고 버튼 삽입
                cardHtml = cardHtml.replace('class="kanban-card', 'class="kanban-card" style="position: relative;');
                cardHtml = cardHtml.slice(0, -6) + restoreBtn + '</div>';
            }

            return cardHtml;
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

    // [NEW] 폐기된 기사 전체 복구
    async restoreAllRejected() {
        const rejectedCount = this.state.rejectedArticles.length;

        if (rejectedCount === 0) {
            alert('복구할 기사가 없습니다.');
            return;
        }

        if (!confirm(`폐기된 ${rejectedCount}건의 기사를 복구하시겠습니까?\n(분류됨 상태로 복원됩니다)`)) {
            return;
        }

        const articleIds = this.state.rejectedArticles.map(a => a.article_id || a.id);

        this.showLoading();
        try {
            const result = await fetchAPI('/api/publisher/restore', {
                method: 'POST',
                body: JSON.stringify({ article_ids: articleIds })
            });

            if (result.success) {
                const successCount = result.results?.filter(r => r.success).length || 0;
                alert(`${successCount}건 복구 완료`);

                // 목록 새로고침
                await this.loadDraftArticles();
            } else {
                alert('오류: ' + (result.error || 'Unknown error'));
            }
        } catch (e) {
            alert('복구 중 오류: ' + e.message);
        } finally {
            this.hideLoading();
        }
    },

    // [NEW] 개별 기사 복원
    async restoreArticle(articleId) {
        if (!confirm('이 기사를 복원하시겠습니까?')) {
            return;
        }

        this.showLoading();
        try {
            const result = await fetchAPI('/api/publisher/restore', {
                method: 'POST',
                body: JSON.stringify({ article_ids: [articleId] })
            });

            if (result.success && result.results?.[0]?.success) {
                const restoredTo = result.results[0].restored_to || 'CLASSIFIED';
                alert(`복원 완료 (${restoredTo} 상태로)`);

                // 목록 새로고침
                await this.loadDraftArticles();
            } else {
                alert('오류: ' + (result.error || result.results?.[0]?.error || 'Unknown error'));
            }
        } catch (e) {
            alert('복원 중 오류: ' + e.message);
        } finally {
            this.hideLoading();
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

    async rejectSelected() {
        if (this.state.selectedDraftIds.size === 0) {
            alert('폐기할 기사를 선택하세요.');
            return;
        }

        const count = this.state.selectedDraftIds.size;
        if (!confirm(`선택한 ${count}건의 기사를 폐기하시겠습니까?`)) return;

        this.showLoading();
        try {
            const result = await fetchAPI('/api/publisher/reject', {
                method: 'POST',
                body: JSON.stringify({
                    article_ids: Array.from(this.state.selectedDraftIds),
                    reason: 'manual'
                })
            });

            if (result.success) {
                const successCount = result.results.filter(r => r.success).length;
                alert(`${successCount}건 폐기 완료`);

                // 선택 초기화 및 목록 새로고침
                this.state.selectedDraftIds.clear();
                await this.loadDraftArticles();
            } else {
                alert('Error: ' + (result.error || 'Unknown error'));
            }
        } catch (e) {
            alert('폐기 중 오류: ' + e.message);
        } finally {
            this.hideLoading();
        }
    },

    // [NEW] Toggle draft article selection (called from checkbox onchange)
    toggleDraftSelection(articleId, isChecked) {
        const card = document.querySelector(`.kanban-card[data-id="${articleId}"]`);

        if (isChecked) {
            this.state.selectedDraftIds.add(articleId);
            card?.classList.add('selected');
        } else {
            this.state.selectedDraftIds.delete(articleId);
            card?.classList.remove('selected');
        }

        this.updateDraftToolbar();
        console.log(`[Selection] ${articleId} ${isChecked ? 'selected' : 'deselected'}. Total: ${this.state.selectedDraftIds.size}`);
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
            const edCode = ed.edition_code || ed.code || 'N/A';
            const edName = ed.edition_name || ed.name || 'N/A';
            const edDate = (ed.updated_at || ed.published_at || '').substring(0, 10);
            const edCount = ed.article_count || ed.count || 0;
            const edIndex = ed.index || 1;  // 호수
            const status = ed.status || 'preview'; // Get status, default to 'preview'
            const statusBadge = status === 'released'
                ? '<span class="badge-released">🟢 Released</span>'
                : '<span class="badge-preview">🟠 Preview</span>';

            const statusClass = status === 'released' ? 'status-released' : 'status-preview';

            return `
            <div class="edition-item ${this.state.selectedEditionCode === edCode ? 'active' : ''} ${statusClass}" 
                 onclick="PublisherV2.goToHistoryEdition('${edCode}')">
                <div class="edition-header">
                    <span class="edition-name">${edName}</span>
                    <span class="edition-date">${edDate}</span>
                </div>
                <div class="edition-meta">
                    Code: ${edCode} | Articles: ${edCount}
                </div>
                <div class="edition-status" style="margin-top: 4px; font-size: 11px;">
                    ${statusBadge}
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

        // 현재 선택된 회차 정보 가져오기
        const currentEdition = this.state.historyEditions.find(
            ed => (ed.edition_code || ed.code) === this.state.selectedEditionCode
        );
        const editionName = currentEdition?.edition_name || currentEdition?.name || '(이름 없음)';
        const editionIndex = currentEdition?.index || 1;

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
            <div class="detail-header" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3>${this.state.selectedEditionCode} 상세</h3>
                    <div class="actions">
                         <button class="btn" style="background: #3498db; margin-right: 8px;" onclick="PublisherV2.editCurrentEdition()">✏️ 수정</button>
                         <button class="btn btn-danger" style="margin-right: 8px;" onclick="PublisherV2.deleteCurrentEdition()">🗑️ 파기 (Delete)</button>
                         <button class="btn btn-success" onclick="PublisherV2.releaseCurrentEdition()">🌐 전체 공개 (Release)</button>
                    </div>
                </div>
                <div class="edition-info" style="background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 6px; font-size: 14px;">
                    <span style="margin-right: 20px;"><strong>호수:</strong> ${editionName}</span>
                    <span style="margin-right: 20px;"><strong>인덱스:</strong> ${editionIndex}</span>
                    <span><strong>기사 수:</strong> ${this.state.historyArticles.length}개</span>
                </div>
            </div>
            <div class="kanban-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                ${articlesHtml}
            </div>
        `;
    },

    async editCurrentEdition() {
        const code = this.state.selectedEditionCode;
        if (!code) return;

        // 현재 회차 정보 가져오기
        const currentEdition = this.state.historyEditions.find(
            ed => (ed.edition_code || ed.code) === code
        );

        const currentName = currentEdition?.edition_name || currentEdition?.name || '';
        const currentIndex = currentEdition?.index || 1;

        // 프롬프트로 새 값 입력받기
        const newName = prompt('회차 이름을 입력하세요:', currentName);
        if (newName === null) return; // 취소됨

        const newIndexStr = prompt('발행 번호(index)를 입력하세요:', String(currentIndex));
        if (newIndexStr === null) return; // 취소됨

        const newIndex = parseInt(newIndexStr, 10);
        if (isNaN(newIndex) || newIndex < 1) {
            alert('유효한 번호를 입력하세요.');
            return;
        }

        // 변경사항이 없으면 종료
        if (newName === currentName && newIndex === currentIndex) {
            alert('변경사항이 없습니다.');
            return;
        }

        this.showLoading();
        try {
            const result = await fetchAPI(`/api/publisher/edition/${code}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    edition_name: newName,
                    index: newIndex
                })
            });

            if (result.success) {
                alert(`수정 완료! (${Object.keys(result.updated).join(', ')})`);
                // 목록 새로고침
                await this.loadHistoryEditions();
                // 상세 새로고침
                await this.selectEdition(code);
            } else {
                alert('Error: ' + (result.error || 'Unknown error'));
            }
        } catch (e) {
            alert('수정 중 오류: ' + e.message);
        } finally {
            this.hideLoading();
        }
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
            const artZS = Number.isNaN(parseFloat(card.dataset.zs)) ? 10 : parseFloat(card.dataset.zs);  // [FIX] 0도 유효한 값

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
