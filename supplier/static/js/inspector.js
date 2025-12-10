// Batch Processor Logic

let allLinks = [];      // Flattened list of all links
let sourceGroups = {};  // Map: source_id -> [linkObj, ...]
let loadedContent = {}; // Map: url -> contentData
let currentGroup = null; // Current selected source_id

window.onload = function () {
    // Initial state handled by HTML mostly.

    // Set default Header Instruction
    const defaultHeader = "";

    const headerEl = document.getElementById('promptHeader');
    if (headerEl) headerEl.value = defaultHeader;

    // Load Cache
    loadContentCache();
};

// --- Step 1: Load List Only ---
async function loadTargetList() {
    showLoading('Fetching Target List...');
    try {
        // 1. Fetch List Only
        const res = await fetch('/api/fetch?target_id=all');
        const data = await res.json();
        allLinks = data.links;

        // 2. Group by Source
        sourceGroups = {};
        allLinks.forEach(link => {
            const sid = link.source_id || 'unknown';
            if (!sourceGroups[sid]) sourceGroups[sid] = [];
            sourceGroups[sid].push(link);
        });

        // 3. Render List with Checkboxes
        renderGroupList(true);

        // Show Action Button
        document.getElementById('groupActionArea').style.display = 'block';

        log(`Loaded list: ${allLinks.length} items. Select targets and click Fetch.`, 'success');

    } catch (e) {
        log('Error loading list: ' + e, 'error');
    } finally {
        hideLoading();
    }
}

function renderGroupList(showCheckboxes = true) {
    const container = document.getElementById('groupList');
    container.innerHTML = '';

    const sortedKeys = Object.keys(sourceGroups).sort();

    sortedKeys.forEach(sid => {
        const items = sourceGroups[sid];
        const newCount = items.filter(i => i.status === 'NEW').length;

        const div = document.createElement('div');
        div.className = 'group-item';

        const isSelected = currentGroup === sid;
        if (isSelected) div.classList.add('active');

        div.onclick = (e) => {
            // Check if clicked element is checkbox or button
            if (e.target.type !== 'checkbox' && e.target.tagName !== 'BUTTON') {
                selectGroup(sid);
            }
        };

        const chkId = `chk-${sid}`;
        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <input type="checkbox" id="${chkId}" class="group-chk" value="${sid}" checked style="margin-right:10px; transform:scale(1.2);">
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; font-size:1.1em;">${sid}</span>
                        <button onclick="resetGroupStatus('${sid}')" title="Reset all to NEW" style="font-size:0.8em; padding:2px 6px; cursor:pointer;">↺</button>
                    </div>
                    <div class="group-stat">
                        Total: ${items.length} | <span style="color:${newCount > 0 ? 'red' : 'green'}">New: ${newCount}</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function resetGroupStatus(sid) {
    if (!confirm(`Reset all items in '${sid}' to NEW?`)) return;

    // 1. Reset Status
    sourceGroups[sid].forEach(i => i.status = 'NEW');

    // 2. Clear Cache for these items so they re-fetch
    sourceGroups[sid].forEach(i => {
        delete loadedContent[i.url];
    });
    saveContentCache(); // Save the cleared state

    renderGroupList();
    if (currentGroup === sid) selectGroup(sid); // Refresh prompt if active
}

// --- Step 2: Fetch Content for Selected ---

async function fetchSelectedContent() {
    const checkboxes = document.querySelectorAll('.group-chk:checked');
    const selectedSids = Array.from(checkboxes).map(cb => cb.value);

    if (selectedSids.length === 0) return alert("Please select at least one group.");

    // Collect all NEW items from selected groups
    let itemsToFetch = [];
    selectedSids.forEach(sid => {
        const newItems = sourceGroups[sid].filter(i => i.status === 'NEW');
        itemsToFetch = itemsToFetch.concat(newItems);
    });

    if (itemsToFetch.length === 0) {
        log("No NEW items found in selected groups.", 'info');
        // Still allow selecting groups to see existing data if any?
        if (selectedSids.length > 0) selectGroup(selectedSids[0]);
        return;
    }

    showLoading(`Extracting content for ${itemsToFetch.length} items... (This may take a while)`);

    try {
        const chunkSize = 20;
        const urls = itemsToFetch.map(i => i.url);

        const missingUrls = urls.filter(u => !loadedContent[u] || (!loadedContent[u].text && !loadedContent[u].summary));

        if (missingUrls.length > 0) {
            for (let i = 0; i < missingUrls.length; i += chunkSize) {
                const chunk = missingUrls.slice(i, i + chunkSize);
                document.getElementById('loadingText').innerText = `Extracting ${Math.min(i + chunkSize, missingUrls.length)} / ${missingUrls.length}...`;

                const contentRes = await fetch('/api/extract_batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls: chunk })
                });
                const fetchedList = await contentRes.json();
                fetchedList.forEach(item => {
                    loadedContent[item.url] = item;
                });
            }
        }

        log(`Content ready for ${itemsToFetch.length} items!`, 'success');

        // Save Cache
        saveContentCache();

        // Automatically select the first checked group
        if (selectedSids.length > 0) {
            selectGroup(selectedSids[0]);
        }

    } catch (e) {
        log('Error fetching content: ' + e, 'error');
    } finally {
        hideLoading();
    }
}

function selectGroup(sid) {
    currentGroup = sid;

    // Highlight UI
    document.querySelectorAll('.group-item').forEach(el => el.classList.remove('active'));
    const chk = document.getElementById(`chk-${sid}`);
    if (chk) {
        chk.closest('.group-item').classList.add('active');
    }

    // Clear Result
    document.getElementById('inputArea').value = '';

    // Generate Prompt
    generatePromptForGroup(sid);
}

async function generatePromptForGroup(sid) {
    const items = sourceGroups[sid];
    const newItems = items.filter(i => i.status === 'NEW');

    if (newItems.length === 0) {
        document.getElementById('promptArea').value = "(No 'NEW' items in this group to process)";
        document.getElementById('promptStatus').textContent = 'Idle';
        return;
    }

    // Build Body Only
    let bodyText = '';
    let loadedCount = 0;

    newItems.forEach((link, idx) => {
        const content = loadedContent[link.url] || {};
        const title = content.title || content.original_title || link.url;
        let body = content.text || content.summary || '(Content not loaded yet. Click Fetch Content first.)';

        if (content.text || content.summary) loadedCount++;

        if (body.length > 5000) body = body.substring(0, 5000) + "...(truncated)";

        bodyText += `--- Article ${idx + 1} ---\n`;
        bodyText += `Title: ${title}\n`;
        bodyText += `Body:\n${body}\n\n`;
    });

    const countInfo = `${newItems.length}개의 기사를 전달했으니 ${newItems.length}개의 JSON 묶음으로 답하라\n\n`;
    document.getElementById('promptArea').value = countInfo + bodyText;

    if (loadedCount < newItems.length) {
        document.getElementById('promptStatus').textContent = `Warning: Only ${loadedCount}/${newItems.length} loaded`;
    } else {
        document.getElementById('promptStatus').textContent = `Ready (${newItems.length} items)`;
    }
}

function copyPrompt() {
    const header = document.getElementById('promptHeader').value;
    const body = document.getElementById('promptArea').value;
    if (!body) return;

    const fullPrompt = header + "\n" + body;

    navigator.clipboard.writeText(fullPrompt).then(() => {
        const btn = document.getElementById('btnCopy');
        const orig = btn.innerText;
        btn.innerText = "✅ Copied!";
        setTimeout(() => btn.innerText = orig, 1500);
        log('Prompt copied to clipboard', 'info');
    }).catch(err => log('Failed to copy: ' + err, 'error'));
}

// --- Step 4: Batch Processing ---

async function processBatch() {
    const rawInput = document.getElementById('inputArea').value;
    if (!rawInput.trim()) return alert('Paste JSON first!');

    let jsonStr = rawInput.trim();
    // Remove markdown
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let results = [];
    try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) results = parsed;
        else if (parsed.results && Array.isArray(parsed.results)) results = parsed.results;
        else throw new Error("JSON must be a list or {results: []}");
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    if (results.length === 0) return alert('No results found in JSON');
    if (!currentGroup) return alert('No group selected');

    const items = sourceGroups[currentGroup].filter(i => i.status === 'NEW');

    if (items.length !== results.length) {
        if (!confirm(`Count Mismatch! \nExpected (NEW items): ${items.length}\nProvided (JSON): ${results.length}\n\nProceed mapping by order?`)) return;
    }

    showLoading('Processing & Saving...');

    let successCount = 0;

    for (let i = 0; i < Math.min(items.length, results.length); i++) {
        const itemLink = items[i];
        const resData = results[i];

        try {
            let finalDoc = { ...loadedContent[itemLink.url], ...resData };

            finalDoc.url = itemLink.url;
            finalDoc.source_id = currentGroup;
            if (!finalDoc.original_title && finalDoc.title) finalDoc.original_title = finalDoc.title;

            const saveRes = await fetch('/api/inject_correction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalDoc)
            });
            const saveJson = await saveRes.json();

            if (saveJson.status === 'success') {
                log(`✅ Saved: ${finalDoc.title_ko || itemLink.url}`, 'success');
                itemLink.status = 'ACCEPTED';
                successCount++;
            } else {
                log(`❌ Failed: ${itemLink.url} - ${saveJson.error}`, 'error');
            }
        } catch (err) {
            log(`❌ Error processing ${itemLink.url}: ${err}`, 'error');
        }
    }

    hideLoading();
    log(`Batch Complete. Saved ${successCount} / ${results.length}`, 'success');
    renderGroupList();
    document.getElementById('inputArea').value = '';

    // Save cache after processing (optional, maybe clear used items? No, keep them for reference)
    saveContentCache();
}

// --- Utils ---

function log(msg, type = 'info') {
    const area = document.getElementById('logArea');
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    area.insertBefore(div, area.firstChild);
}

function showLoading(msg) {
    document.getElementById('loadingText').innerText = msg;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// --- Caching Logic ---
const CACHE_KEY = 'inspector_content_cache';

function saveContentCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(loadedContent));
        // log('Content cache saved (Browser)', 'info'); 
    } catch (e) {
        console.error("Cache Save Error", e);
    }
}

function loadContentCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            loadedContent = { ...loadedContent, ...data };
            log(`Restored ${Object.keys(data).length} cached items.`, 'info');
        }
    } catch (e) {
        console.error("Cache Load Error", e);
    }
}

function clearContentCache() {
    if (!confirm("Clear local content cache?")) return;
    localStorage.removeItem(CACHE_KEY);
    loadedContent = {};
    log('Cache cleared.', 'success');
    renderGroupList(); // Update UI (red/green counts might change if we relied on loaded status, but mainly data is gone)
}
