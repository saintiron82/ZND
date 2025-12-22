// Manual Crawler (Kanban Logic)

let currentDate = '';
let currentData = {}; // { inbox: [], analyzed: [], ... }
let selectedItems = new Set(); // Set of URLs
let currentDetailItem = null; // For modal actions

window.onload = function () {
    loadDates();
};

// 1. Load Dates
async function loadDates() {
    const sel = document.getElementById('dateSelect');
    sel.innerHTML = '<option>Loading...</option>';

    try {
        const res = await fetch('/api/cache/dates');
        const data = await res.json();

        if (data.success && data.dates.length > 0) {
            sel.innerHTML = '';
            data.dates.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                sel.appendChild(opt);
            });
            // Auto load first date
            currentDate = data.dates[0];
            loadDate(currentDate);
        } else {
            sel.innerHTML = '<option>No dates found</option>';
        }
    } catch (e) {
        alert('Failed to load dates: ' + e);
    }
}

// 2. Load Board Data
async function loadDate(date) {
    if (!date) return;
    currentDate = date;
    showLoading(`Loading cache for ${date}...`);
    selectedItems.clear();
    updateActionBar();

    try {
        const res = await fetch(`/api/cache/list_by_date?date=${date}`);
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

// [NEW] Run Auto Crawler
async function runCrawlNow() {
    if (!confirm('지금 자동 수집(Auto-Collect)을 실행하시겠습니까?')) return;

    showLoading('🚀 Collecting new articles...');
    try {
        const res = await fetch('/api/automation/collect', { method: 'POST' });
        const json = await res.json();

        if (json.success) {
            alert('Collection Complete!');
            loadDate(currentDate); // Refresh
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
        loadDate(currentDate); // Refresh board
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
            loadDate(currentDate); // Refresh
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
            loadDate(currentDate);
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
            loadDate(currentDate);
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
