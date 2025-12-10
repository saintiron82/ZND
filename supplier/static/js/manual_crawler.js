// Global state
let currentLinks = [];
let currentLinkIndex = -1;
let currentTargetId = '';
let loadedContents = {}; // url -> content data

// Field name normalization helper
function normalizeFieldNames(data) {
    const normalized = { ...data };

    // Find and normalize zero_echo_score variations (case-insensitive)
    const keys = Object.keys(normalized);
    for (const key of keys) {
        if (key.toLowerCase() === 'zero_echo_score' && key !== 'zero_echo_score') {
            normalized.zero_echo_score = normalized[key];
            delete normalized[key];
            console.log(`[Normalize] Renamed '${key}' to 'zero_echo_score'`);
        }
        // Also handle old zero_noise_score
        if (key.toLowerCase() === 'zero_noise_score') {
            normalized.zero_echo_score = normalized[key];
            delete normalized[key];
            console.log(`[Normalize] Migrated '${key}' to 'zero_echo_score'`);
        }
    }

    return normalized;
}

// 페이지 로드 시 타겟 목록 초기화
document.addEventListener('DOMContentLoaded', function () {
    loadTargets();
});

function loadTargets() {
    const select = document.getElementById('targetSelect');
    select.innerHTML = '<option value="">로딩 중...</option>';

    fetch('/api/targets')
        .then(res => res.json())
        .then(targets => {
            select.innerHTML = '<option value="">타겟 선택...</option>';
            targets.forEach(target => {
                const option = document.createElement('option');
                option.value = target.id;
                option.textContent = target.name || target.id;
                select.appendChild(option);
            });
        })
        .catch(err => {
            console.error('Error loading targets:', err);
            select.innerHTML = '<option value="">타겟 로드 실패</option>';
        });
}

function fetchLinks() {
    const select = document.getElementById('targetSelect');
    currentTargetId = select.value;
    if (!currentTargetId) return alert('Please select a target');

    const btn = document.querySelector('.target-select button');
    btn.textContent = 'Fetching...';
    btn.classList.add('loading');

    fetch(`/api/fetch?target_id=${currentTargetId}`)
        .then(res => res.json())
        .then(data => {
            currentLinks = data.links;
            renderLinks();
            btn.textContent = 'Fetch Links';
            btn.classList.remove('loading');
        })
        .catch(err => {
            alert('Error fetching links: ' + err);
            btn.textContent = 'Fetch Links';
            btn.classList.remove('loading');
        });
}

function renderLinks() {
    const list = document.getElementById('link-list');
    list.innerHTML = '';
    currentLinks.forEach((item, index) => {
        const li = document.createElement('li');

        let statusClass = '';
        let badge = '';

        if (item.status === 'ACCEPTED') {
            statusClass = 'status-saved';
            badge = '<span class="status-badge badge-saved">SAVED</span>';
        } else if (item.status === 'SKIPPED') {
            statusClass = 'status-skipped';
            badge = '<span class="status-badge badge-skipped">SKIP</span>';
        } else if (item.status === 'INVALID') {
            statusClass = 'status-invalid';
            badge = '<span class="status-badge badge-invalid">BAD</span>';
        } else if (item.status === 'WORTHLESS') {
            statusClass = 'status-worthless';
            badge = '<span class="status-badge badge-worthless">TRASH</span>';
        }

        li.innerHTML = `${badge}${item.url}`;
        li.className = statusClass;

        li.onclick = () => loadArticle(index);
        if (index === currentLinkIndex) li.classList.add('active');
        list.appendChild(li);
    });
}

function loadArticle(index) {
    currentLinkIndex = index;
    renderLinks(); // Update active state

    const item = currentLinks[index];
    const link = item.url;
    document.getElementById('url').value = link;

    // Clear inputs
    document.getElementById('originalTitle').value = 'Loading...';
    document.getElementById('jsonInput').value = '';
    document.getElementById('previewPane').innerHTML = '<div style="text-align:center; margin-top:50px;">Loading content...</div>';

    // Helper to render
    const render = (data) => {
        document.getElementById('originalTitle').value = data.title || data.original_title || '';

        // Check if it's existing data (has source_id or scores) OR modified batch data
        if ((data.source_id && data.zero_echo_score !== undefined) || data.zero_echo_score !== undefined) {
            document.getElementById('jsonInput').value = JSON.stringify(data, null, 2);
            verifyScore();
        } else {
            document.getElementById('jsonInput').value = '';
            document.getElementById('verifyResult').style.display = 'none';
        }

        document.getElementById('previewPane').innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h2 style="margin: 0; font-size: 1.5em;">${data.title || data.title_ko || 'No Title'}</h2>
                <div style="white-space: nowrap;">
                    <button onclick="copyContent()" style="padding: 5px 10px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; margin-right: 10px;">📋 Copy Content</button>
                    <a href="${link}" target="_blank" style="text-decoration: none; color: #007bff; font-weight: bold; border: 1px solid #007bff; padding: 4px 8px; border-radius: 4px;">🔗 Original</a>
                </div>
            </div>
            <hr>
            <pre id="articleBody" style="white-space: pre-wrap; font-family: inherit;">${data.text || data.summary || 'No text content'}</pre>
        `;
    };

    // Check Cache First
    if (loadedContents[link]) {
        render(loadedContents[link]);
        return;
    }

    // Fallback to fetch
    fetch(`/api/extract?url=${encodeURIComponent(link)}`)
        .then(res => res.json())
        .then(data => {
            loadedContents[link] = data;
            render(data);
        })
        .catch(err => {
            document.getElementById('previewPane').innerHTML = `<div style="color:red">Error loading content: ${err}</div>`;
        });
}

function copyContent() {
    const title = document.querySelector('#previewPane h2').innerText;
    const body = document.getElementById('articleBody').innerText;
    const content = `${title}\n\n${body}`;

    navigator.clipboard.writeText(content).then(() => {
        const btn = document.querySelector('#previewPane button');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        setTimeout(() => btn.textContent = originalText, 1500);
    }).catch(err => {
        alert('Failed to copy: ' + err);
    });
}

function saveArticle() {
    const jsonStr = document.getElementById('jsonInput').value;
    let jsonData = {};

    try {
        jsonData = JSON.parse(jsonStr);
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    const data = {
        ...jsonData,
        url: document.getElementById('url').value,
        source_id: currentTargetId,
        original_title: document.getElementById('originalTitle').value
    };

    if (!data.title_ko || !data.summary) {
        return alert('JSON must contain title_ko and summary');
    }

    fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                markAsProcessed('ACCEPTED');
                loadNext();
            } else {
                alert('Error saving: ' + res.error);
            }
        });
}

function verifyScore() {
    const jsonStr = document.getElementById('jsonInput').value;
    let jsonData = {};
    try {
        jsonData = JSON.parse(jsonStr);
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    // Normalize field names (handle case variations like zero_Echo_score, Zero_echo_score, etc.)
    jsonData = normalizeFieldNames(jsonData);
    // Update the input with normalized data
    document.getElementById('jsonInput').value = JSON.stringify(jsonData, null, 2);

    const resultDiv = document.getElementById('verifyResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = 'Verifying...';
    resultDiv.style.background = '#eee';
    resultDiv.style.color = 'black';

    fetch('/api/verify_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
    })
        .then(res => res.json())
        .then(res => {
            if (res.error) {
                resultDiv.innerHTML = `Error: ${res.error}`;
                resultDiv.style.background = '#f8d7da';
            } else {
                const breakdown = res.breakdown || {};
                let html = '';

                // Header
                if (res.match) {
                    html += `<div style="color: #155724; background: #d4edda; padding: 10px; border-radius: 4px; margin-bottom: 10px;">✅ <b>MATCH!</b> (ZS: ${res.calculated_zs})</div>`;
                } else {
                    html += `<div style="color: #721c24; background: #f8d7da; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    ❌ <b>MISMATCH!</b><br>
                    Rec: <b>${jsonData.zero_echo_score}</b> vs Calc: <b>${res.calculated_zs}</b> (Diff: ${res.diff.toFixed(2)})
                    </div>`;
                }

                // Table Style
                html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.9em; background: white;">`;
                html += `<tr style="background: #f1f1f1; text-align: left;"><th style="padding: 5px;">Item</th><th style="padding: 5px; text-align: right;">Value</th></tr>`;

                // Base
                html += `<tr><td style="padding: 5px; border-bottom: 1px solid #eee;">Base Noise Level</td><td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">5.0</td></tr>`;

                // Credits
                if (breakdown.credits && breakdown.credits.length > 0) {
                    breakdown.credits.forEach(c => {
                        html += `<tr><td style="padding: 5px; border-bottom: 1px solid #eee; color: blue;">- ${c.id} (Good)</td><td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee; color: blue;">-${c.value}</td></tr>`;
                    });
                }

                // Penalties
                if (breakdown.penalties && breakdown.penalties.length > 0) {
                    breakdown.penalties.forEach(p => {
                        html += `<tr><td style="padding: 5px; border-bottom: 1px solid #eee; color: red;">+ ${p.id} (Bad)</td><td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee; color: red;">+${p.value}</td></tr>`;
                    });
                }

                // Modifiers
                if (breakdown.modifiers && breakdown.modifiers.length > 0) {
                    breakdown.modifiers.forEach(m => {
                        const isGood = m.effect > 0;
                        const sign = isGood ? '-' : '+';
                        const color = isGood ? 'blue' : 'red';
                        const absEffect = Math.abs(m.effect);
                        html += `<tr><td style="padding: 5px; border-bottom: 1px solid #eee; color: ${color};">${sign} ${m.id}</td><td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee; color: ${color};">${sign}${absEffect}</td></tr>`;
                    });
                }

                // Summary Rows
                const zsRaw = breakdown.zs_raw !== undefined ? breakdown.zs_raw : 0;
                const zsClamped = breakdown.zs_clamped !== undefined ? breakdown.zs_clamped : 0;

                html += `<tr style="font-weight: bold; background: #fafafa;"><td style="padding: 5px;">Raw ZS</td><td style="padding: 5px; text-align: right;">${zsRaw.toFixed(2)}</td></tr>`;
                html += `<tr style="font-weight: bold; background: #333; color: white;"><td style="padding: 5px;">Final ZS (0~10)</td><td style="padding: 5px; text-align: right;">${res.calculated_zs}</td></tr>`;

                html += `</table>`;

                // Impact Score Verification
                html += `<div style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px;"></div>`;

                if (res.impact_match) {
                    html += `<div style="color: #155724; background: #d4edda; padding: 10px; border-radius: 4px; margin-bottom: 10px;">✅ <b>Impact MATCH!</b> (Score: ${breakdown.impact_calc})</div>`;
                } else {
                    html += `<div style="color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                        ⚠️ <b>Impact MISMATCH!</b><br>
                        Rec: <b>${breakdown.impact_rec}</b> vs Calc: <b>${breakdown.impact_calc}</b> (Diff: ${breakdown.impact_diff.toFixed(2)})
                        </div>`;
                }

                html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.9em; background: white;">`;
                html += `<tr style="background: #f1f1f1; text-align: left;"><th style="padding: 5px;">Impact Factor</th><th style="padding: 5px; text-align: right;">Weight</th></tr>`;

                // Entity
                if (breakdown.impact_entity) {
                    const ent = breakdown.impact_entity;
                    html += `<tr><td style="padding: 5px; border-bottom: 1px solid #eee;">Entity: ${ent.id}</td><td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">${ent.weight}</td></tr>`;
                }

                // Events
                if (breakdown.impact_events && breakdown.impact_events.length > 0) {
                    breakdown.impact_events.forEach(e => {
                        html += `<tr><td style="padding: 5px; border-bottom: 1px solid #eee;">Event: ${e.id}</td><td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">+${e.weight}</td></tr>`;
                    });
                }

                html += `<tr style="font-weight: bold; background: #333; color: white;"><td style="padding: 5px;">Calculated Impact</td><td style="padding: 5px; text-align: right;">${breakdown.impact_calc}</td></tr>`;
                html += `</table>`;

                resultDiv.innerHTML = html;
                resultDiv.style.background = 'transparent';
                resultDiv.style.padding = '0';
            }
        })
        .catch(err => {
            resultDiv.innerHTML = `Error: ${err}`;
        });
}

function markWorthless() {
    const url = document.getElementById('url').value;
    if (!url) return;

    fetch('/api/worthless', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                markAsProcessed('WORTHLESS');
                loadNext();
            } else {
                alert('Error marking as worthless: ' + res.error);
            }
        });
}

function skipArticle() {
    const url = document.getElementById('url').value;
    if (!url) return;

    fetch('/api/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                markAsProcessed('SKIPPED');
                loadNext();
            } else {
                alert('Error skipping: ' + res.error);
            }
        });
}

function markAsProcessed(status) {
    if (currentLinks[currentLinkIndex]) {
        currentLinks[currentLinkIndex].status = status;
    }
    renderLinks();
}

function loadNext() {
    if (currentLinkIndex < currentLinks.length - 1) {
        loadArticle(currentLinkIndex + 1);
    } else {
        alert('All links in this batch processed!');
    }
}

function scanContent() {
    if (currentLinks.length === 0) return alert('No links to scan');

    const btn = document.querySelector('button[onclick="scanContent()"]');
    const originalText = btn.textContent;
    btn.textContent = 'Scanning...';
    btn.disabled = true;

    const newItems = currentLinks.map((item, idx) => ({ ...item, idx })).filter(item => item.status === 'NEW');

    if (newItems.length === 0) {
        alert('No new items to scan');
        btn.textContent = originalText;
        btn.disabled = false;
        return;
    }

    fetch('/api/check_quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: newItems.map(i => i.url) })
    })
        .then(res => res.json())
        .then(results => {
            results.forEach(r => {
                const item = currentLinks.find(l => l.url === r.url);
                if (item) {
                    item.status = r.status === 'valid' ? 'NEW' : 'INVALID';
                }
            });
            renderLinks();
            btn.textContent = originalText;
            btn.disabled = false;
        })
        .catch(err => {
            alert('Scan failed: ' + err);
            btn.textContent = originalText;
            btn.disabled = false;
        });
}

// Bulk Operations
function loadAllContent(callback) {
    if (currentLinks.length === 0) return alert('No links to load');

    const btn = document.querySelector('button[onclick="loadAndCopy()"]') || document.querySelector('button[onclick="loadAllContent()"]');
    const originalText = btn ? btn.textContent : 'Load';
    if (btn) {
        btn.textContent = 'Loading...';
        btn.disabled = true;
    }

    const urls = currentLinks.map(l => l.url);

    fetch('/api/extract_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urls })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);

            data.forEach(item => {
                loadedContents[item.url] = item;
            });

            alert(`✅ Loaded content for ${data.length} items`);
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }

            if (callback) callback();
        })
        .catch(err => {
            alert('Batch load failed: ' + err);
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
}

function loadAndCopy() {
    loadAllContent(() => {
        copyAllForPrompt();
    });
}

function copyAllForPrompt() {
    const keys = Object.keys(loadedContents);
    if (keys.length === 0) return alert('Please "Load All" content first!');

    const N = currentLinks.length;
    let text = `${N}개의 항목에 대해서 개별로 평가하라.\n이 목록은 해당 그룹에 해당하는 리스트이다.\n`;
    text += `응답은 반드시 Valid JSON List 포맷으로 작성하라. \n예시: { "results": [ { "title_ko": "...", "zero_echo_score": 5.0, "impact_score": 3.5, "summary": "...", "reasoning": "..." } ] }\n\n`;

    currentLinks.forEach((linkItem, index) => {
        const data = loadedContents[linkItem.url];
        if (!data) return;

        const title = data.title || data.title_ko || 'No Title';
        const body = data.text || data.summary || 'No text content';

        text += `--- Item ${index + 1} ---\n`;
        text += `${title}\n\n${body}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Copied formatted prompt to clipboard!');
    }).catch(err => alert('Failed to copy: ' + err));
}

function injectCorrection() {
    const jsonStr = document.getElementById('jsonInput').value;
    const url = document.getElementById('url').value;

    if (!url) return alert('No URL loaded');

    let jsonData = {};
    try {
        jsonData = JSON.parse(jsonStr);
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    if (!confirm('⚠️ Are you sure you want to overwrite the existing file with this content? \n(Original will be backed up)')) {
        return;
    }

    const btn = document.querySelector('button[onclick="injectCorrection()"]');
    const originalText = btn.textContent;
    btn.textContent = 'Injecting...';
    btn.disabled = true;

    fetch('/api/inject_correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...jsonData, url: url })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                alert('✅ Success: ' + res.message);

                if (res.new_scores) {
                    jsonData.zero_echo_score = res.new_scores.zs_final;
                    jsonData.impact_score = res.new_scores.impact_score;
                    document.getElementById('jsonInput').value = JSON.stringify(jsonData, null, 2);

                    verifyScore();
                }
            } else {
                alert('❌ Error: ' + res.error);
            }
            btn.textContent = originalText;
            btn.disabled = false;
        })
        .catch(err => {
            alert('Connection Error: ' + err);
            btn.textContent = originalText;
            btn.disabled = false;
        });
}

// Batch Result Parsing
function showBatchModal() {
    document.getElementById('batchModal').style.display = 'flex';
}

function closeBatchModal() {
    document.getElementById('batchModal').style.display = 'none';
}

function applyBatchResults() {
    const jsonStr = document.getElementById('batchInput').value;
    let data = null;

    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    let results = [];
    if (Array.isArray(data)) {
        results = data;
    } else if (data.results && Array.isArray(data.results)) {
        results = data.results;
    } else {
        return alert('JSON must be an array or object with "results" array.');
    }

    if (results.length === 0) return alert('No results found in JSON.');

    if (results.length !== currentLinks.length) {
        if (!confirm(`⚠️ Count Mismatch!\nLinks: ${currentLinks.length}\nResults: ${results.length}\n\nApply anyway (by order)?`)) {
            return;
        }
    }

    let updatedCount = 0;
    results.forEach((resItem, index) => {
        if (index >= currentLinks.length) return;

        const linkItem = currentLinks[index];
        const url = linkItem.url;

        if (!loadedContents[url]) loadedContents[url] = { url: url };

        Object.assign(loadedContents[url], resItem);

        if (resItem.zero_echo_score !== undefined) {
            loadedContents[url].zero_echo_score = parseFloat(resItem.zero_echo_score);
        }
        if (resItem.impact_score !== undefined) {
            loadedContents[url].impact_score = parseFloat(resItem.impact_score);
        }

        updatedCount++;
    });

    alert(`✅ Applied results to ${updatedCount} items.\nReview them one by one and click 'Save'.`);
    closeBatchModal();

    if (currentLinkIndex >= 0) {
        loadArticle(currentLinkIndex);
    }
}

// Inspector Logic
function showInspector() {
    window.batchInspectorLinks = null;
    window.open('/inspector', 'inspector', 'width=1000,height=800');
}

function showIndependentInspector() {
    const btn = document.querySelector('button[onclick="showIndependentInspector()"]');
    const originalText = btn.textContent;
    btn.textContent = 'Preparing...';
    btn.classList.add('loading');

    fetch('/api/fetch?target_id=all')
        .then(res => res.json())
        .then(data => {
            window.batchInspectorLinks = data.links;
            window.open('/inspector', 'independent_inspector', 'width=1000,height=800');

            btn.textContent = originalText;
            btn.classList.remove('loading');
        })
        .catch(err => {
            alert('Error preparing independent inspector: ' + err);
            btn.textContent = originalText;
            btn.classList.remove('loading');
        });
}
