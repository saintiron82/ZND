/* ============================================
 * desk_publish.js
 * ============================================ */

const LATEST_SCHEMA_VERSION = '2.0.0';

async function refreshIssueList() {
    try {
        const resp = await fetch('/api/publications/list');
        const data = await resp.json();
        availableIssues = data.issues || [];

        const selector = document.getElementById('issueSelector');
        // Keep desk option, clear rest
        selector.innerHTML = '<option value="desk">✨ 미발행 (Desk)</option>';

        availableIssues.forEach(issue => {
            const opt = document.createElement('option');
            opt.value = issue.id;
            const dateStr = issue.published_at ? new Date(issue.published_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : (issue.date || '-');
            opt.textContent = `📰 ${dateStr} ${issue.edition_name} (${issue.article_count || 0}건)`;
            selector.appendChild(opt);
        });

        // Populate publications panel
        const panel = document.getElementById('publicationsPanel');
        if (availableIssues.length === 0) {
            panel.innerHTML = '<div style="text-align: center; color: #666; padding: 10px; font-size: 0.85em;">발행된 회차가 없습니다</div>';
        } else {
            panel.innerHTML = availableIssues.map(issue => {
                const isPreview = issue.status === 'preview';
                const isReleased = issue.status === 'released';
                const borderColor = isReleased ? '#28a745' : '#ffc107';
                const bgColor = isReleased ? 'rgba(40,167,69,0.1)' : 'rgba(255,193,7,0.1)';
                const statusBadge = isPreview
                    ? '<span style="background:#ffc107;color:#333;padding:2px 6px;border-radius:4px;font-size:0.7em;font-weight:bold;">📝 프리뷰</span>'
                    : '<span style="background:#28a745;color:white;padding:2px 6px;border-radius:4px;font-size:0.7em;font-weight:bold;">✅ 발행</span>';
                const releaseBtn = isPreview
                    ? `<button onclick="event.stopPropagation(); releaseIssue('${issue.id}', '${issue.edition_name}')" style="background:#28a745;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:0.75em;cursor:pointer;margin-left:6px;">🚀 Release</button>`
                    : '';
                const deleteBtn = `<button onclick="event.stopPropagation(); deleteIssue('${issue.id}', '${issue.edition_name}')" style="background:#dc3545;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:0.75em;cursor:pointer;margin-left:4px;">🗑️</button>`;
                return `
                                <div class="issue-card" style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px; margin-bottom: 8px; cursor: pointer;" onclick="viewIssue('${issue.id}')">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span style="font-weight: bold; color: ${borderColor};">${issue.published_at ? new Date(issue.published_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : issue.date || '-'} ${issue.edition_name}</span>
                                            ${statusBadge}
                                        </div>
                                        <div style="display:flex; align-items:center;">
                                            <span style="font-size: 0.8em; color: #888;">${issue.article_count || 0}건</span>
                                            ${releaseBtn}
                                            ${issue.schema_version === LATEST_SCHEMA_VERSION ? '' : `<button onclick="event.stopPropagation(); updateIssueFormat('${issue.id}', '${issue.edition_name}')" style="background:#17a2b8;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:0.75em;cursor:pointer;margin-left:4px;" title="최신 데이터로 업데이트">⬆️</button>`}
                                            ${deleteBtn}
                                        </div>
                                    </div>
                                    <div style="font-size: 0.75em; color: #aaa; margin-top: 4px;">
                                        🕐 ${issue.published_at ? new Date(issue.published_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'} 발행
                                    </div>
                                </div>
                            `;
            }).join('');
        }

        console.log('📰 Issue list refreshed:', availableIssues.length);
    } catch (e) {
        console.error('Issue list refresh failed:', e);
        const panel = document.getElementById('publicationsPanel');
        if (panel) panel.innerHTML = '<div style="text-align: center; color: #dc3545; font-size: 0.85em;">로드 실패</div>';
    }
}
function viewIssue(publishId) {
    // Update selector and load issue
    const selector = document.getElementById('issueSelector');
    selector.value = publishId;
    onIssueSelectorChange();
}
async function releaseIssue(publishId, editionName) {
    if (!confirm(`🚀 "${editionName}" 회차를 정식 발행(Release)하시겠습니까?\n\n이 작업 후 웹사이트에 즉시 표시됩니다.`)) {
        return;
    }

    try {
        const resp = await fetch('/api/publications/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publish_id: publishId })
        });
        const result = await resp.json();

        if (result.success) {
            alert(`✅ ${result.message || '릴리즈 완료!'}`);
            await refreshIssueList();
        } else {
            alert(`❌ 릴리즈 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ 오류: ${e.message}`);
    }
}
async function deleteIssue(publishId, editionName) {
    if (!confirm(`🗑️ "${editionName}" 회차를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!\n• 회차 문서가 삭제됩니다\n• 해당 기사들의 발행 정보가 초기화됩니다`)) {
        return;
    }

    try {
        const resp = await fetch('/api/publications/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publish_id: publishId })
        });
        const result = await resp.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            await refreshIssueList();
            backToDesk(); // Desk로 돌아가기
        } else {
            alert(`❌ 삭제 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ 오류: ${e.message}`);
    }
}
async function onIssueSelectorChange() {
    const selector = document.getElementById('issueSelector');
    currentViewMode = selector.value;

    if (currentViewMode === 'desk') {
        await loadDesk();
    } else {
        await loadPublishedIssue(currentViewMode);
    }

    // 뷰 모드에 따른 UI 업데이트
    updateViewModeUI();
}
async function loadPublishedIssue(publishId) {
    const grid = document.getElementById('articleGrid');
    grid.innerHTML = '<div class="loading">로딩 중...</div>';

    try {
        const resp = await fetch(`/api/publications/view?publish_id=${publishId}`);
        const data = await resp.json();

        if (!data.success) {
            grid.innerHTML = `<div class="empty-state">오류: ${data.error}</div>`;
            return;
        }

        deskData = data.articles || [];
        renderArticles();
        updateStats();
    } catch (e) {
        grid.innerHTML = `<div class="empty-state">로드 실패: ${e.message}</div>`;
    }
}
function openPublishModal() {
    // Get selected filenames
    const checkboxes = document.querySelectorAll('.article-checkbox:checked');
    pendingPublishFilenames = Array.from(checkboxes).map(cb => cb.dataset.filename);

    if (pendingPublishFilenames.length === 0) {
        alert('발행할 기사를 선택해주세요.');
        return;
    }

    document.getElementById('publishSelectedCount').textContent = pendingPublishFilenames.length;

    // Populate append target dropdown
    const appendSelect = document.getElementById('appendTargetSelect');
    appendSelect.innerHTML = '<option value="">-- 회차 선택 --</option>';
    availableIssues.forEach(issue => {
        const opt = document.createElement('option');
        opt.value = issue.id;
        opt.textContent = issue.edition_name;
        appendSelect.appendChild(opt);
    });

    // Reset to 'new' mode
    selectPublishOption('new');

    document.getElementById('publishModal').classList.add('active');
}
function closePublishModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('publishModal').classList.remove('active');
}
function selectPublishOption(mode) {
    selectedPublishMode = mode;
    document.getElementById('publishOptionNew').classList.toggle('selected', mode === 'new');
    document.getElementById('publishOptionAppend').classList.toggle('selected', mode === 'append');
    document.getElementById('appendTargetSelect').style.display = mode === 'append' ? 'block' : 'none';
}
async function executePublish() {
    const payload = {
        filenames: pendingPublishFilenames,
        mode: selectedPublishMode
    };

    if (selectedPublishMode === 'append') {
        const targetId = document.getElementById('appendTargetSelect').value;
        if (!targetId) {
            alert('추가할 회차를 선택해주세요.');
            return;
        }
        payload.target_publish_id = targetId;
    }

    try {
        const resp = await fetch('/api/desk/publish_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await resp.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            closePublishModal();
            await refreshIssueList();
            await loadDesk(); // Refresh desk view
        } else {
            alert(`❌ 발행 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ 오류: ${e.message}`);
    }
}
function publishAll() {
    openPublishModal();
}
async function removeFromIssue() {
    if (currentViewMode === 'desk') {
        alert('발행된 회차를 선택한 후 사용해주세요.');
        return;
    }

    const checkboxes = document.querySelectorAll('.article-checkbox:checked');

    if (checkboxes.length === 0) {
        alert('제거할 기사를 선택해주세요.');
        return;
    }

    const selectedArticleIds = [];
    const selectedFilenames = [];

    checkboxes.forEach(cb => {
        if (cb.dataset.articleId) {
            selectedArticleIds.push(cb.dataset.articleId);
        }
        if (cb.dataset.filename) {
            selectedFilenames.push(cb.dataset.filename);
        }
    });

    if (!confirm(`선택한 ${checkboxes.length}개 기사를 현재 회차에서 제거하시겠습니까?\n\n제거된 기사는 미발행(Desk) 상태로 돌아갑니다.`)) {
        return;
    }

    try {
        const response = await fetch('/api/publications/remove_articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                publish_id: currentViewMode,
                article_ids: selectedArticleIds,
                filenames: selectedFilenames
            })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}\n\n제거됨: ${result.removed}개\n남은 기사: ${result.remaining_count}개`);
            await refreshIssueList();
            // 현재 회차 다시 로드
            if (result.remaining_count > 0) {
                await loadPublishedIssue(currentViewMode);
            } else {
                // 회차에 기사가 없으면 Desk로 이동
                document.getElementById('issueSelector').value = 'desk';
                await loadDesk();
            }
        } else {
            alert(`❌ 제거 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
function updateViewModeUI() {
    const btnRemoveFromIssue = document.getElementById('btnRemoveFromIssue');

    const deskStatsPanel = document.getElementById('deskStatsPanel');
    const issueControlPanel = document.getElementById('issueControlPanel');

    const currentIssueNameDisplay = document.getElementById('currentIssueNameDisplay');
    const currentIssueDateDisplay = document.getElementById('currentIssueDateDisplay');
    const currentIssueCount = document.getElementById('currentIssueCount');
    const currentIssueStatus = document.getElementById('currentIssueStatus');

    if (currentViewMode === 'desk') {
        // Desk 모드
        if (btnRemoveFromIssue) btnRemoveFromIssue.style.display = 'none';

        // 패널 전환: Desk 통계 표시, 회차 패널 숨김
        if (deskStatsPanel) deskStatsPanel.style.display = 'block';
        if (issueControlPanel) issueControlPanel.style.display = 'none';
    } else {
        // 발행 회차 보기 모드
        if (btnRemoveFromIssue) btnRemoveFromIssue.style.display = 'block';

        // 패널 전환: Desk 통계 숨김, 회차 패널 표시
        if (deskStatsPanel) deskStatsPanel.style.display = 'none';
        if (issueControlPanel) issueControlPanel.style.display = 'block';

        // 현재 회차 정보 표시
        const currentIssue = availableIssues.find(i => i.id === currentViewMode);
        if (currentIssue) {
            if (currentIssueNameDisplay) currentIssueNameDisplay.textContent = currentIssue.edition_name;
            if (currentIssueDateDisplay) {
                const publishedAt = currentIssue.published_at ? new Date(currentIssue.published_at) : null;
                currentIssueDateDisplay.textContent = publishedAt
                    ? publishedAt.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : (currentIssue.date || '-');
            }
            if (currentIssueCount) currentIssueCount.textContent = currentIssue.article_count || 0;
            if (currentIssueStatus) {
                const isReleased = currentIssue.status === 'released';
                currentIssueStatus.innerHTML = isReleased
                    ? '<span style="color:#28a745">Released</span>'
                    : '<span style="color:#ffc107">Preview</span>';
            }
        }
    }
}
async function deleteCurrentIssue() {
    if (currentViewMode === 'desk') return;

    const currentIssue = availableIssues.find(i => i.id === currentViewMode);
    if (!currentIssue) return;

    await deleteIssue(currentIssue.id, currentIssue.edition_name);
}
async function editIssueNumber() {
    if (currentViewMode === 'desk') return;

    const currentIssue = availableIssues.find(i => i.id === currentViewMode);
    if (!currentIssue) return;

    const newName = prompt('수정할 회차 이름을 입력하세요 (예: 1호):', currentIssue.edition_name);
    if (!newName || newName === currentIssue.edition_name) return;

    try {
        const resp = await fetch('/api/publications/update_edition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                publish_id: currentIssue.id,
                new_edition_name: newName
            })
        });
        const result = await resp.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            await refreshIssueList();

            // 선택 상태 유지 (이름이 바뀌었으므로 UI 갱신 필요)
            const selector = document.getElementById('issueSelector');
            selector.value = currentIssue.id; // ID는 그대로임
            await onIssueSelectorChange();
        } else {
            alert(`❌ 수정 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ 오류: ${e.message}`);
    }
}
function backToDesk() {
    const selector = document.getElementById('issueSelector');
    selector.value = 'desk';
    onIssueSelectorChange();
}
async function syncCachePush() {
    const syncAll = confirm('☁️ 캐시 + 히스토리를 Firebase에 업로드합니다.\n\n⚡ 이미 동기화된 기사는 자동으로 건너뜁니다.\n📜 크롤링 히스토리도 함께 동기화됩니다.\n\n[확인] 전체 업로드\n[취소] 선택된 날짜만 업로드');

    const payload = syncAll ? {} : { date: selectedDate };

    if (!syncAll && !selectedDate) {
        alert('📅 먼저 날짜를 선택해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/cache/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            let msg = `✅ 업로드 완료!\n\n`;
            msg += `📦 캐시: ${result.synced}개 업로드\n`;
            msg += `⏭️ 스킵: ${result.skipped}개\n`;
            if (result.history_count > 0) {
                msg += `📜 히스토리: ${result.history_count}개 URL\n`;
            }
            if (result.failed > 0) {
                msg += `❌ 실패: ${result.failed}개`;
            }
            alert(msg);
        } else {
            alert(`❌ 업로드 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}

async function syncCachePull() {
    const pullAll = confirm('⬇️ Firebase에서 캐시를 내려받습니다.\n\n📦 클라우드에 저장된 캐시를 로컬에 저장합니다.\n📜 크롤링 히스토리도 함께 병합됩니다.\n\n[확인] 전체 다운로드\n[취소] 선택된 날짜만 다운로드');

    const payload = pullAll ? { all: true } : { date: selectedDate };

    if (!pullAll && (!selectedDate || selectedDate === 'all')) {
        alert('📅 먼저 특정 날짜를 선택해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/cache/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            let msg = `✅ 다운로드 완료!\n\n`;
            msg += `📦 캐시: ${result.downloaded}개 저장\n`;
            if (result.history_count > 0) {
                msg += `📜 히스토리: ${result.history_count}개 병합\n`;
            }
            alert(msg);
            await loadDesk(); // 새로고침
        } else {
            alert(`❌ 다운로드 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}

// [BACKWARD COMPAT] 기존 함수명 호환
function syncCacheToFirebase() {
    syncCachePush();
}
async function publishAll() {
    // Check only Visible checkboxes
    const checkboxes = document.querySelectorAll('.article-checkbox:checked');
    const selectedFiles = Array.from(checkboxes).map(cb => cb.dataset.filename);

    if (selectedFiles.length === 0) {
        alert('발행할 기사를 선택해주세요.');
        return;
    }

    // Get current target issue name (from display or input)
    const nextIssueDisplay = document.getElementById('nextIssueNumberDisplay');
    const issueName = nextIssueDisplay ? nextIssueDisplay.textContent.trim() : '다음 호수';

    if (!confirm(`${selectedFiles.length}개 기사를 [${issueName}]로 발행하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch('/api/desk/publish_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: selectedFiles })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 발행 완료!\n\n${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 발행 실패\n\n${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}

async function setNextIssueNumber() {
    const input = document.getElementById('nextIssueNumberInput');
    const val = parseInt(input.value);

    if (!val || val < 1) {
        alert('유효한 호수를 입력해주세요 (1 이상 숫자).');
        return;
    }

    try {
        const resp = await fetch('/api/publication/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ next_issue_number: val })
        });
        const result = await resp.json();

        if (result.success) {
            alert(`✅ 설정 완료!\n${result.message}`);
            loadPublicationConfig(); // Refresh display
            input.value = ''; // Clear input
        } else {
            alert(`❌ 설정 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ 오류: ${e.message}`);
    }
}

async function updateIssueFormat(publishId, editionName) {
    if (!confirm(`🔄 "${editionName}" 회차를 최신 데이터로 업데이트하시겠습니까?\n\n로컬 캐시(Staging)에 있는 상세 정보를 바탕으로\n회차 문서(Cloud & Local)를 보강합니다.`)) {
        return;
    }

    try {
        const resp = await fetch(`/api/publication/${publishId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await resp.json();

        if (result.success) {
            alert(`✅ 업데이트 완료!\n\n- 보강됨: ${result.enriched}건\n- 캐시 없음: ${result.not_found}건\n- 총 기사: ${result.total}건`);
            await refreshIssueList();
        } else {
            alert(`❌ 업데이트 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ 통신 오류: ${e.message}`);
    }
}
