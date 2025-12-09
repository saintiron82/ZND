let links = [];
let loadedContents = {};
let currentIndex = -1;

// Load data from opener
window.onload = function () {
    if (!window.opener) {
        // Standalone mode - just wait for user to click Load
        return;
    }

    try {
        // Reference parent data if available to start with
        if (window.opener.batchInspectorLinks) {
            links = window.opener.batchInspectorLinks;
        } else {
            links = window.opener.currentLinks || [];
        }

        loadedContents = window.opener.loadedContents || {};

        document.getElementById('count').innerText = links.length;
        renderList();

        if (links.length > 0) {
            const firstSource = links[0].source_id || 'unknown';
            selectItem(`BATCH:${firstSource}`);
            loadRest();
        }
    } catch (e) {
        console.warn("Error accessing parent window: " + e);
    }
};

async function loadAllAndPrepare() {
    const btn = document.querySelector('button[onclick="loadAllAndPrepare()"]');
    const originalText = btn.textContent;
    btn.textContent = 'Fetching ALL Links...';
    btn.disabled = true;

    try {
        // 1. Fetch ALL Links (target_id=all)
        const res = await fetch(`/api/fetch?target_id=all`);
        const data = await res.json();
        const newLinks = data.links || [];

        if (newLinks.length === 0) {
            alert('No links found.');
            btn.textContent = originalText;
            btn.disabled = false;
            return;
        }

        // 2. Set Links
        links = newLinks;
        document.getElementById('count').innerText = links.length;
        renderList();

        // 3. Load Content for ALL links
        btn.textContent = `Loading Content (${links.length})...`;

        // Chunking requests if too many? For now, let's try one big batch or chunks of 20
        const chunkSize = 20;
        const urls = links.map(l => l.url);

        for (let i = 0; i < urls.length; i += chunkSize) {
            const chunk = urls.slice(i, i + chunkSize);
            btn.textContent = `Loading Content (${i}/${urls.length})...`;

            try {
                const contentRes = await fetch('/api/extract_batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls: chunk })
                });
                const contentData = await contentRes.json();

                if (contentData.error) throw new Error(contentData.error);

                contentData.forEach(item => {
                    loadedContents[item.url] = item;
                    if (window.opener && window.opener.loadedContents) {
                        window.opener.loadedContents[item.url] = item;
                    }
                });
                renderList(); // Update icons progressively
            } catch (err) {
                console.error("Batch chunk failed", err);
            }
        }

        // 4. Finished
        renderList();

        // Select first group
        const groups = getGroups();
        const firstSid = Object.keys(groups)[0];
        if (firstSid) {
            selectItem(`BATCH:${firstSid}`);
        }

        alert(`✅ Loaded ALL: ${links.length} items across ${Object.keys(groups).length} groups.`);

    } catch (e) {
        alert('Error: ' + e);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function loadInspectorTargets() {
    const select = document.getElementById('inspectorTargetSelect');
    fetch('/api/targets')
        .then(res => res.json())
        .then(targets => {
            select.innerHTML = '<option value="">Select Target...</option>';
            targets.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name || t.id;
                select.appendChild(opt);
            });
        })
        .catch(err => {
            select.innerHTML = '<option value="">Error loading targets</option>';
        });
}

async function loadTargetAndPrepare() {
    const btn = document.querySelector('button[onclick="loadTargetAndPrepare()"]');
    const originalText = btn.textContent;
    const select = document.getElementById('inspectorTargetSelect');
    const targetId = select.value;

    if (!targetId) return alert('Please select a target first.');

    btn.textContent = 'Fetching Links...';
    btn.disabled = true;

    try {
        // 1. Fetch Links for Target
        const res = await fetch(`/api/fetch?target_id=${targetId}`);
        const data = await res.json();
        const newLinks = data.links || [];

        if (newLinks.length === 0) {
            alert('No links found for this target.');
            btn.textContent = originalText;
            btn.disabled = false;
            return;
        }

        // 2. Merge Links (Avoid Duplicates if needed, but usually we just want to work on this batch)
        // Strategy: Replace current list or Append? 
        // Request said "fetch list of targets units", implies working on that unit.
        // Let's Replace to be clean, or Append if we want to build a big list.
        // User said "Fetch by Link Target List Unit", implies looking at that Unit.
        // Let's clear and set to this new unit for clarity.

        // Resetting global links
        links = newLinks;
        document.getElementById('count').innerText = links.length;
        renderList();

        // 3. Select the Group Immediately
        selectItem(`BATCH:${targetId}`);

        // 4. Load Content for all keys
        btn.textContent = `Loading Content (${links.length})...`;

        // Use batch extract for speed
        const urls = links.map(l => l.url);
        const contentRes = await fetch('/api/extract_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: urls })
        });
        const contentData = await contentRes.json();

        if (contentData.error) throw new Error(contentData.error);

        // Update loadedContents
        contentData.forEach(item => {
            loadedContents[item.url] = item;
            // Sync with parent if exists
            if (window.opener && window.opener.loadedContents) {
                window.opener.loadedContents[item.url] = item;
            }
        });

        // Refresh UI
        renderList();
        // Re-select to update prompt
        selectItem(`BATCH:${targetId}`);

        alert(`✅ Loaded and Prepared ${links.length} items for ${targetId}`);

    } catch (e) {
        alert('Error: ' + e);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function loadRest() {
    for (let i = 0; i < links.length; i++) {
        const item = links[i];
        const url = item.url;
        const data = loadedContents[url] || item;

        // If no text, fetch it
        if (!data.text && !data.summary) {
            try {
                const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
                const fetchedData = await res.json();

                // Update cache
                const merged = { ...data, ...fetchedData };
                loadedContents[url] = merged;
                if (window.opener && window.opener.loadedContents) {
                    window.opener.loadedContents[url] = merged;
                }

                // Update list icon
                renderList();
            } catch (e) {
                console.error("Failed to autoload", url, e);
            }
        }
    }
}

// Helper to group by source
function getGroups() {
    const groups = {};
    links.forEach(l => {
        const sid = l.source_id || 'unknown';
        if (!groups[sid]) groups[sid] = [];
        groups[sid].push(l);
    });
    return groups;
}

function renderList() {
    const container = document.getElementById('listContainer');
    container.innerHTML = '';

    const groups = getGroups();
    const sourceIds = Object.keys(groups);

    sourceIds.forEach(sid => {
        // Batch Header Item
        const batchDiv = document.createElement('div');
        batchDiv.className = 'list-item';
        batchDiv.style.background = '#e9ecef';
        batchDiv.style.fontWeight = 'bold';

        if (currentIndex === `BATCH:${sid}`) {
            batchDiv.classList.add('active');
            batchDiv.style.background = '#007bff';
        }

        batchDiv.innerHTML = `📁 [${sid}] Group Batch (${groups[sid].length})`;
        batchDiv.onclick = () => selectItem(`BATCH:${sid}`);
        container.appendChild(batchDiv);

        // Individual Items
        groups[sid].forEach((item) => {
            const globalIdx = links.indexOf(item);

            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.paddingLeft = '20px'; // Indent
            if (globalIdx === currentIndex) div.classList.add('active');

            let icon = '⚪';
            const data = loadedContents[item.url];
            if (data) {
                if (data.zero_noise_score !== undefined) icon = '✅';
                else if (data.text || data.summary) icon = '📄';
            }

            div.innerHTML = `<span class="status-icon">${icon}</span> ${item.title || 'No Title'}`;
            div.onclick = () => selectItem(globalIdx);
            container.appendChild(div);
        });
    });
}

function selectItem(indexOrBatchId) {
    currentIndex = indexOrBatchId;
    renderList();

    const promptArea = document.getElementById('promptArea');
    const inputArea = document.getElementById('inputArea');
    const btnSave = document.getElementById('btnSave');

    // --- BATCH MODE ---
    if (typeof indexOrBatchId === 'string' && indexOrBatchId.startsWith('BATCH:')) {
        const sid = indexOrBatchId.split(':')[1];
        const groupLinks = links.filter(l => (l.source_id || 'unknown') === sid);

        btnSave.textContent = `⚡ Apply Batch (${sid})`;

        // Generate Group Batch Prompt
        let text = `${groupLinks.length}개의 항목에 대해서 개별로 평가하라.\n이 목록은 '${sid}' 그룹에 해당하는 리스트이다.\n`;
        text += `응답은 반드시 Valid JSON List 포맷으로 작성하라. \n예시: { "results": [ { "title_ko": "...", "zero_noise_score": 5.0, "impact_score": 3.5, "summary": "...", "reasoning": "..." } ] }\n\n`;

        let loadedCount = 0;
        groupLinks.forEach((linkItem, i) => {
            const data = loadedContents[linkItem.url] || linkItem;
            if (data.text || data.summary) {
                const title = data.title || data.original_title || 'No Title';
                const body = data.text || data.summary || 'No content';
                text += `--- Item ${i + 1} ---\nOriginalURL: ${linkItem.url}\nTitle: ${title}\nBody:\n${body}\n\n`;
                loadedCount++;
            } else {
                text += `--- Item ${i + 1} ---\n(Loading...)\n\n`;
            }
        });

        if (loadedCount < groupLinks.length) {
            text = "(아직 모든 문서가 로드되지 않았습니다. 잠시만 기다려주세요...)\n\n" + text;
        }

        promptArea.value = text;
        inputArea.value = "";
        return;
    }

    // --- SINGLE MODE ---
    btnSave.textContent = "💾 Verify & Save";
    const item = links[currentIndex];
    if (!item) return;

    const url = item.url;
    let data = loadedContents[url] || item;

    function updatePrompt(d) {
        const title = d.title || d.original_title || d.title_ko || 'No Title';
        const body = d.text || d.summary || 'No text content';
        const prompt = `${title}\n\n${body}\n\n위 문서를 평가하고 결과를 JSON으로 반환하라.`;
        promptArea.value = prompt;

        if (d.zero_noise_score !== undefined) {
            inputArea.value = JSON.stringify(d, null, 2);
        } else {
            inputArea.value = '';
        }
    }

    if (data.text || data.summary) {
        updatePrompt(data);
    } else {
        promptArea.value = "Loading content...";
        inputArea.value = "";

        fetch(`/api/extract?url=${encodeURIComponent(url)}`)
            .then(res => res.json())
            .then(fetched => {
                data = { ...data, ...fetched };
                loadedContents[url] = data;
                if (window.opener) window.opener.loadedContents[url] = data;
                if (currentIndex === indexOrBatchId) updatePrompt(data);
                renderList();
            })
            .catch(err => {
                promptArea.value = "Error: " + err;
            });
    }
}

function copyPrompt() {
    const text = document.getElementById('promptArea').value;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('button[onclick="copyPrompt()"]');
        const orig = btn.innerText;
        btn.innerText = "✅ Copied";
        setTimeout(() => btn.innerText = orig, 1000);
    });
}

function saveItem() {
    const inputArea = document.getElementById('inputArea');
    const jsonStr = inputArea.value;
    let jsonData = {};

    try {
        jsonData = JSON.parse(jsonStr);
    } catch (e) {
        return alert("Invalid JSON");
    }

    // --- BATCH SAVE ---
    if (typeof currentIndex === 'string' && currentIndex.startsWith('BATCH:')) {
        const sid = currentIndex.split(':')[1];
        const groupLinks = links.filter(l => (l.source_id || 'unknown') === sid);

        let results = [];
        if (Array.isArray(jsonData)) results = jsonData;
        else if (jsonData.results && Array.isArray(jsonData.results)) results = jsonData.results;
        else return alert('JSON must be a list or have "results" list.');

        let updated = 0;
        results.forEach((res, i) => {
            if (i >= groupLinks.length) return;
            const link = groupLinks[i];

            if (!loadedContents[link.url]) loadedContents[link.url] = { url: link.url };
            Object.assign(loadedContents[link.url], res);

            if (window.opener && window.opener.loadedContents) {
                if (!window.opener.loadedContents[link.url]) window.opener.loadedContents[link.url] = { url: link.url };
                Object.assign(window.opener.loadedContents[link.url], res);
            }
            updated++;
        });

        alert(`✅ Applied batch results to ${updated} items in group ${sid}.`);
        renderList();
        return;
    }

    // --- SINGLE SAVE ---
    const item = links[currentIndex];
    const url = item.url;
    const btn = document.getElementById('btnSave');

    btn.textContent = 'Saving...';
    btn.disabled = true;

    fetch('/api/inject_correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...jsonData, url: url })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                if (window.opener.loadedContents[url]) Object.assign(window.opener.loadedContents[url], jsonData);
                loadedContents[url] = window.opener.loadedContents[url];
                renderList();
                alert("✅ Saved!");
            } else {
                alert("Error: " + res.error);
            }
            btn.textContent = '💾 Verify & Save';
            btn.disabled = false;
        })
        .catch(err => {
            alert("Network Error: " + err);
            btn.textContent = '💾 Verify & Save';
            btn.disabled = false;
        });
}
