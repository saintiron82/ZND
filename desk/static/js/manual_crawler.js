// Manual Crawler (Kanban Logic)

let currentData = {}; // { inbox: [], analyzed: [], ... }
let selectedItems = new Set(); // Set of URLs
let currentDetailItem = null; // For modal actions

window.onload = function () {
    loadCache();
    startPolling();
};

// [NEW] Polling Status
let pollingInterval = null;

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(checkCrawlStatus, 3000);
}

async function checkCrawlStatus() {
    try {
        const res = await fetch('/api/crawl/status');
        const data = await res.json();

        // Update Header Badge
        const badge = document.getElementById('crawlerStatusBadge');
        if (badge) {
            if (data.is_crawling) {
                badge.textContent = `Running: ${data.current_task || '...'}`;
                badge.style.background = '#e83e8c';
                badge.style.color = 'white';
            } else {
                badge.textContent = 'Idle';
                badge.style.background = '#444';
                badge.style.color = '#aaa';
            }
        }

        // Also update Inbox Header (legacy, keep for compatibility)
        const headerTitle = document.querySelector('.col-inbox .col-header span:first-child');
        if (headerTitle) {
            const smallTag = headerTitle.querySelector('small');
            if (smallTag) {
                if (data.is_crawling) {
                    smallTag.innerHTML = `(Crawling...)`;
                    smallTag.style.color = '#e83e8c';
                } else {
                    smallTag.innerHTML = `(Raw)`;
                    smallTag.style.color = '';
                }
            }
        }
    } catch (e) {
        console.error('Polling error:', e);
    }
}

// Time filter callback for header dropdown
function reloadWithTimeFilter(hours) {
    console.log(`[CacheManager] Time filter changed to ${hours} hours`);
    loadCache();
}

// Load cache with time filter
async function loadCache() {
    showLoading('Loading cache...');
    selectedItems.clear();
    updateActionBar();

    try {
        const hours = typeof getTimeFilterHours === 'function' ? getTimeFilterHours() : '0';
        const res = await fetch(`/api/cache/list_by_date?date=all&hours=${hours}`);
        const json = await res.json();

        if (json.success) {
            currentData = json.data;
            renderBoard();
        } else {
            alert('Error: ' + json.error);
        }
    } catch (e) {
        console.error(e);
        alert('Network Error');
    } finally {
        hideLoading();
    }
}

// 3. Render Board
function renderBoard() {
    const cols = ['inbox', 'analyzed', 'staged', 'published', 'trash'];

    cols.forEach(col => {
        const listEl = document.getElementById(`list-${col}`);
        const countEl = document.getElementById(`count-${col}`);
        const items = currentData[col] || [];

        listEl.innerHTML = '';
        countEl.textContent = items.length;

        items.forEach(item => {
            const card = createCard(item, col);
            listEl.appendChild(card);
        });
    });
}

function createCard(item, colType) {
    const card = document.createElement('div');
    card.className = 'card';
    if (selectedItems.has(item.url)) card.classList.add('selected');

    // Status Badge & Info
    let badges = '';
    if (item.impact_score !== undefined) {
        badges += `<span class="card-score">IS: ${item.impact_score}</span> `;
    }
    if (item.saved) {
        badges += `<span class="badge-s">S</span> `;
    }
    if (item.published) {
        badges += `<span class="badge-p">P</span> `;
    }

    // Source ID
    const sourceId = item.source_id || 'unknown';

    card.innerHTML = `
        <div class="card-meta">
            <span>${sourceId}</span>
            <span style="font-size:0.9em; opacity:0.7;">${colType.toUpperCase()}</span>
        </div>
        <div class="card-title" title="${item.title}">${item.title || '(No Title)'}</div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
             <div>${badges}</div>
        </div>
    `;

    // Click Handler (Selection vs Detail)
    card.onclick = (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            // Toggle Selection
            toggleSelection(item.url, card);
        } else {
            // Show Detail
            showDetail(item);
        }
    };

    return card;
}

// 4. Interaction
function toggleSelection(url, cardEl) {
    if (selectedItems.has(url)) {
        selectedItems.delete(url);
        cardEl.classList.remove('selected');
    } else {
        selectedItems.add(url);
        cardEl.classList.add('selected');
    }
    updateActionBar();
}

function updateActionBar() {
    const bar = document.getElementById('actionBar');
    if (!bar) return; // Should exist, but check

    // Clear existing dynamic buttons (Move ones) to prevent duplicates or build manually
    // Since we overwrote HTML, we should just rewrite innerHTML for the button part
    // But reusing existing Analyze/Delete is better.
    // Let's assume we re-render the whole bar content based on selection, 
    // OR we just show/hide.
    // For simplicity, I'll update the text and ensure display.
    // Ideally I should inject the "Move" buttons if not present.
    // But since I'm rewriting this file, I can define the HTML in the HTML file OR inject it here.
    // I will dynamically inject the *buttons* for Move here if I didn't add them to HTML.
    // Wait, I didn't edit index.html to add Move buttons.
    // So I should render the ActionBar content dynamically here.

    const count = selectedItems.size;

    if (count > 0) {
        bar.style.display = 'flex';
        bar.innerHTML = `
            <span style="color:white; font-weight:bold;">${count} Selected</span>
            <div style="height:20px; width:1px; background:#555;"></div>
            
            <!-- Move Actions -->
            <select onchange="if(this.value) { moveItems(this.value); this.value=''; }" 
                    style="background:#444; color:white; border:1px solid #666; padding:5px; border-radius:4px; margin-right:5px;">
                <option value="">Move to...</option>
                <option value="inbox">📥 Inbox</option>
                <option value="analyzed">📝 Analyzed</option>
                <option value="staged">✅ Staged</option>
                <option value="published">🚀 Published</option>
                <option value="trash">🗑️ Trash</option>
            </select>
            
            <button class="success" onclick="batchAnalyze()">⚡ Extract/Analyze</button>
            <button class="danger" onclick="batchDelete()">🗑️ Delete</button>
        `;
    } else {
        bar.style.display = 'none';
    }
}

// 5. Actions / Detail
function showDetail(item) {
    currentDetailItem = item;
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const link = document.getElementById('modalLink');
    const readable = document.getElementById('modalReadable');
    const jsonPre = document.getElementById('modalJson');

    title.textContent = item.title || "No Title";
    link.href = item.url || "#";

    // Left: Readable Info
    let html = `<h4>Summary</h4><p>${item.summary || 'No summary available.'}</p>`;
    html += `<h4>Impact Analysis</h4>`;
    html += `<p><strong>Score:</strong> ${item.impact_score || 'N/A'}</p>`;
    if (item.impact_analysis) {
        html += `<p>${item.impact_analysis}</p>`;
    }

    // Status Change Buttons in Modal
    html += `
        <hr style="margin:20px 0; border:0; border-top:1px solid #eee;">
        <h4>Change Status</h4>
        <div style="display:flex; gap:5px; flex-wrap:wrap;">
            <button onclick="moveItems('inbox')" style="padding:5px 10px; cursor:pointer;">📥 Inbox</button>
            <button onclick="moveItems('analyzed')" style="padding:5px 10px; cursor:pointer;">📝 Analyzed</button>
            <button onclick="moveItems('staged')" style="padding:5px 10px; cursor:pointer; background:#e8f5e9;">✅ Staged</button>
            <button onclick="moveItems('published')" style="padding:5px 10px; cursor:pointer; background:#e3f2fd;">🚀 Published</button>
        </div>
    `;

    readable.innerHTML = html;

    // Right: JSON
    jsonPre.textContent = JSON.stringify(item, null, 2);

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
    currentDetailItem = null;
}

// [NEW] Run Auto Crawler (Collect + Extract)
async function runCrawlNow() {
    if (!confirm('지금 자동 수집(Collect + Extract)을 실행하시겠습니까?')) return;

    showLoading('🚀 Collecting and extracting articles...');
    try {
        // collect-extract로 변경 - 수집 + 추출 + 캐시 저장
        const res = await fetch('/api/automation/collect-extract', { method: 'POST' });
        const json = await res.json();

        if (json.success) {
            const msg = `수집 완료!\n- 수집: ${json.collected || 0}개\n- 추출: ${json.extracted || 0}개\n- 실패: ${json.failed || 0}개`;
            alert(msg);
            loadCache(); // Refresh
        } else {
            alert('Failed: ' + json.error);
        }
    } catch (e) {
        alert('Error: ' + e);
    } finally {
        hideLoading();
    }
}

// [batch] Analyze
async function batchAnalyze() {
    const urls = Array.from(selectedItems);
    if (urls.length === 0) return;

    if (!confirm(`Analyze ${urls.length} items? This will use LLM tokens.`)) return;

    // Get full objects
    let itemsToProcess = [];
    Object.values(currentData).flat().forEach(i => {
        if (selectedItems.has(i.url)) itemsToProcess.push(i);
    });

    showLoading(`Extracting & Analyzing ${itemsToProcess.length} items...`);

    try {
        const res = await fetch('/api/extract_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsToProcess })
        });
        const result = await res.json();

        alert(`Processed ${result.length} items.`);
        loadCache(); // Refresh board
    } catch (e) {
        alert('Batch Process Failed: ' + e);
    } finally {
        hideLoading();
    }
}

// [batch] Move Status
async function moveItems(targetStatus) {
    const urls = Array.from(selectedItems);
    // If no selection, check current detail item
    let targetUrls = urls;
    if (targetUrls.length === 0 && currentDetailItem) {
        targetUrls = [currentDetailItem.url];
    }

    if (targetUrls.length === 0) return;

    const count = targetUrls.length;
    // Specific warning for publishing
    let msg = `Move ${count} items to '${targetStatus.toUpperCase()}'?`;
    if (targetStatus === 'published') {
        msg += "\n\n⚠️ Note: This only sets the 'Published' flag. Actual edition data is not set.";
    }

    if (!confirm(msg)) return;

    showLoading(`Moving items to ${targetStatus}...`);
    try {
        const res = await fetch('/api/cache/update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: targetUrls, target_status: targetStatus })
        });
        const json = await res.json();

        if (json.success) {
            // alert(`Successfully moved ${json.count} items.`);
            if (currentDetailItem) closeModal();
            loadCache(); // Refresh
        } else {
            alert('Move Failed: ' + json.error);
        }
    } catch (e) {
        alert('Error: ' + e);
    } finally {
        hideLoading();
    }
}

// [batch] Delete
async function batchDelete() {
    const urls = Array.from(selectedItems);
    if (urls.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${urls.length} items?`)) return;

    showLoading('Deleting items...');
    try {
        const res = await fetch('/api/delete_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: urls })
        });
        const json = await res.json();
        if (json.success) {
            alert('Deleted successfully.');
            loadCache();
        } else {
            alert('Delete failed: ' + json.error);
        }
    } catch (e) {
        alert('Error: ' + e);
    } finally {
        hideLoading();
    }
}

async function deleteCurrentItem() {
    if (!currentDetailItem) return;
    if (!confirm('Delete this item?')) return;

    showLoading('Deleting...');
    try {
        const res = await fetch('/api/delete_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: [currentDetailItem.url] })
        });
        const json = await res.json();
        if (json.success) {
            closeModal();
            loadCache();
        } else {
            alert('Delete failed: ' + json.error);
        }
    } catch (e) {
        alert('Error: ' + e);
    } finally {
        hideLoading();
    }
}


// Utils
function showLoading(msg) {
    document.getElementById('loadingText').innerText = msg;
    document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// ============================================
// Schedule Management Functions (from desk_schedule.js)
// ============================================

function openSchedulePanel() {
    document.getElementById('scheduleModal').style.display = 'flex';
    loadSchedules();
    currentLogOffset = 0; // 로그 오프셋 초기화
    refreshLogs(); // 로그도 함께 로드
}
function closeScheduleModal() {
    document.getElementById('scheduleModal').style.display = 'none';
}

async function loadSchedules() {
    try {
        const resp = await fetch('/api/schedule');
        const result = await resp.json();
        const container = document.getElementById('scheduleList');
        if (!result.success || !result.schedules || result.schedules.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#666; padding:10px;">스케줄 없음</div>';
            return;
        }
        // 시간 순으로 정렬
        const sortedSchedules = result.schedules.sort((a, b) => {
            const partsA = a.cron.split(' ');
            const partsB = b.cron.split(' ');
            const timeA = parseInt(partsA[1] || 0) * 60 + parseInt(partsA[0] || 0);
            const timeB = parseInt(partsB[1] || 0) * 60 + parseInt(partsB[0] || 0);
            return timeA - timeB;
        });
        container.innerHTML = sortedSchedules.map(s => {
            const parts = s.cron.split(' ');
            const minute = parts[0] || '0';
            const hour = parts[1] || '0';
            const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; margin-bottom:8px; 
                    background:${s.enabled ? 'rgba(32,201,151,0.15)' : 'rgba(108,117,125,0.15)'}; 
                    border-radius:8px; border-left:4px solid ${s.enabled ? '#20c997' : '#6c757d'};">
                    <div style="flex:1;">
                        <div style="font-size:0.9em; font-weight:bold; color:${s.enabled ? '#fff' : '#888'};">${s.name}</div>
                        <div style="font-size:1.1em; font-weight:bold; color:${s.enabled ? '#20c997' : '#666'};">⏰ ${timeStr}</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="toggleSchedule('${s.id}')" 
                            style="padding:5px 10px; font-size:0.8em; border:none; border-radius:4px; cursor:pointer;
                                   background:${s.enabled ? '#28a745' : '#6c757d'}; color:white;">
                            ${s.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button onclick="editSchedule('${s.id}', '${s.name}', '${hour}', '${minute}')" 
                            style="padding:5px 10px; font-size:0.8em; border:none; border-radius:4px; cursor:pointer; background:#ffc107; color:#333;">✏️</button>
                        <button onclick="deleteSchedule('${s.id}')" 
                            style="padding:5px 10px; font-size:0.8em; border:none; border-radius:4px; cursor:pointer; background:#dc3545; color:white;">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Schedule load failed:', e);
    }
}

async function toggleSchedule(scheduleId) {
    try {
        const resp = await fetch(`/api/schedule/${scheduleId}/toggle`, { method: 'POST' });
        const result = await resp.json();
        if (result.success) loadSchedules();
        else alert('토글 실패: ' + result.error);
    } catch (e) { alert('오류: ' + e.message); }
}

async function deleteSchedule(scheduleId) {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return;
    try {
        const resp = await fetch(`/api/schedule/${scheduleId}`, { method: 'DELETE' });
        const result = await resp.json();
        if (result.success) loadSchedules();
        else alert('삭제 실패: ' + result.error);
    } catch (e) { alert('오류: ' + e.message); }
}

function openAddScheduleDialog() {
    const name = prompt('스케줄 이름:', '새 스케줄');
    if (!name) return;
    const hour = prompt('시 (0-23):', '8');
    if (hour === null) return;
    const minute = prompt('분 (0-59):', '30');
    if (minute === null) return;
    const cron = `${minute} ${hour} * * *`;
    addSchedule(name, cron);
}

function editSchedule(scheduleId, currentName, currentHour, currentMinute) {
    const name = prompt('스케줄 이름:', currentName);
    if (!name) return;
    const hour = prompt('시 (0-23):', currentHour);
    if (hour === null) return;
    const minute = prompt('분 (0-59):', currentMinute);
    if (minute === null) return;
    const cron = `${minute} ${hour} * * *`;
    updateSchedule(scheduleId, name, cron);
}

async function addSchedule(name, cron) {
    try {
        const resp = await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cron, enabled: true })
        });
        const result = await resp.json();
        if (result.success) loadSchedules();
        else alert('추가 실패: ' + result.error);
    } catch (e) { alert('오류: ' + e.message); }
}

async function updateSchedule(scheduleId, name, cron) {
    try {
        const resp = await fetch(`/api/schedule/${scheduleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cron })
        });
        const result = await resp.json();
        if (result.success) loadSchedules();
    } catch (e) { alert('오류: ' + e.message); }
}

// runCrawlNow는 상단에 정의됨 (line 253) - collect-extract 사용


// 스케줄 모달 내 상태 표시 버전 (폴링으로 진행 상황 표시)
async function runCrawlNowWithStatus() {
    const statusBox = document.getElementById('crawlStatusBox');
    const statusText = document.getElementById('crawlStatusText');
    const statusDetail = document.getElementById('crawlStatusDetail');
    const spinner = document.getElementById('crawlStatusSpinner');
    const btn = document.getElementById('btnRunCrawlNow');

    // 상태 표시 시작
    statusBox.style.display = 'block';
    statusText.textContent = '🚀 크롤링 시작 중...';
    statusDetail.textContent = '링크 수집 및 콘텐츠 추출을 진행합니다.';
    spinner.style.display = 'block';
    btn.disabled = true;
    btn.style.opacity = '0.6';

    // 진행 상황 폴링 시작
    let pollInterval = setInterval(async () => {
        try {
            const statusRes = await fetch('/api/crawl/status');
            const status = await statusRes.json();
            if (status.is_crawling && status.progress) {
                const p = status.progress;
                const progressText = p.current_target
                    ? `📡 ${p.current_target} (${p.current_index}/${p.total_targets})`
                    : '📡 준비 중...';
                const countText = p.collected_count > 0 ? ` - ${p.collected_count}개 수집` : '';
                statusText.textContent = progressText + countText;
                statusDetail.textContent = p.message || status.current_task;
            }
        } catch (e) {
            console.error('Poll error:', e);
        }
    }, 1000);

    try {
        const resp = await fetch('/api/schedule/run_now', { method: 'POST' });
        const result = await resp.json();

        clearInterval(pollInterval);
        spinner.style.display = 'none';

        if (result.success) {
            statusText.textContent = '✅ 크롤링 완료!';
            statusText.style.color = '#28a745';
            statusDetail.textContent = result.message || '새 기사가 수집되었습니다.';
            // 로그 새로고침
            if (typeof refreshLogs === 'function') refreshLogs();
            // 3초 후 상태창 숨기기
            setTimeout(() => {
                statusBox.style.display = 'none';
                statusText.style.color = '#20c997';
            }, 3000);
        } else {
            statusText.textContent = '❌ 실행 실패';
            statusText.style.color = '#dc3545';
            statusDetail.textContent = result.error || '알 수 없는 오류';
        }
    } catch (e) {
        clearInterval(pollInterval);
        spinner.style.display = 'none';
        statusText.textContent = '❌ 오류 발생';
        statusText.style.color = '#dc3545';
        statusDetail.textContent = e.message;
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

// ============================================
// Logs Panel Functions
// ============================================

let currentLogOffset = 0;
const LOG_PAGE_SIZE = 50;

function openLogsPanel() {
    document.getElementById('logsModal').style.display = 'flex';
    currentLogOffset = 0;
    refreshLogs();
}
function closeLogsPanel() {
    document.getElementById('logsModal').style.display = 'none';
}

async function refreshLogs(append = false) {
    const list = document.getElementById('crawlerLogList');
    if (!list) return;

    if (!append) {
        currentLogOffset = 0;
        list.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">로그 로딩 중...</div>';
    }

    try {
        const res = await fetch(`/api/logs/crawler?limit=${LOG_PAGE_SIZE}&offset=${currentLogOffset}`);
        const logs = await res.json();

        if (!logs || logs.length === 0) {
            if (!append) {
                list.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">기록 없음</div>';
            }
            // 더보기 버튼 숨기기
            const btnMore = document.getElementById('btnLoadMoreLogs');
            if (btnMore) btnMore.style.display = 'none';
            return;
        }

        const logsHtml = logs.map(log => {
            let timeStr = log.timestamp || '';
            // 날짜 + 시간 형식으로 표시
            if (timeStr.includes('T')) {
                const parts = timeStr.split('T');
                const datePart = parts[0].substring(5); // MM-DD
                const timePart = parts[1].substring(0, 5); // HH:MM
                timeStr = `${datePart} ${timePart}`;
            }
            const color = log.success ? '#28a745' : '#dc3545';
            const icon = log.success ? '✅' : '❌';
            return `
                <div style="border-bottom:1px solid #444; padding:8px 0;">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#eee;">[${timeStr}] <strong>${log.action}</strong></span>
                        <span style="color:${color};">${icon} ${log.duration}s</span>
                    </div>
                    <div style="color:#aaa; margin-top:4px; font-size:0.9em;">${log.result}</div>
                </div>
            `;
        }).join('');

        if (append) {
            list.innerHTML += logsHtml;
        } else {
            list.innerHTML = logsHtml;
        }

        // 더보기 버튼 표시/숨기기
        const btnMore = document.getElementById('btnLoadMoreLogs');
        if (btnMore) {
            btnMore.style.display = logs.length >= LOG_PAGE_SIZE ? 'block' : 'none';
        }
    } catch (e) {
        if (!append) {
            list.innerHTML = '<div style="color:#dc3545; text-align:center; padding:20px;">로그 로드 오류</div>';
        }
        console.error('Log load error:', e);
    }
}

async function loadMoreLogs() {
    currentLogOffset += LOG_PAGE_SIZE;
    await refreshLogs(true);
}

// ============================================
// Sync Functions
// ============================================

async function runSyncNow() {
    if (!confirm('지금 캐시 동기화를 실행하시겠습니까?')) return;

    showLoading('☁️ 캐시 동기화 중...');
    try {
        const resp = await fetch('/api/cache/sync', { method: 'POST' });
        const result = await resp.json();

        if (result.success) {
            alert('✅ ' + (result.message || '동기화 완료!'));
            refreshLogs(); // 로그 새로고침
        } else {
            alert('❌ 동기화 실패: ' + (result.error || '알 수 없는 오류'));
        }
    } catch (e) {
        alert('❌ 오류: ' + e.message);
    } finally {
        hideLoading();
    }
}
