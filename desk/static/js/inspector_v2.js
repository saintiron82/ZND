// Inspector V2 Logic
let allArticles = [];
let sourceGroups = {};
let selectedGroups = new Set();
let articleMap = {}; // id -> article

document.addEventListener('DOMContentLoaded', () => {
    loadArticles();

    // Event Listeners
    document.getElementById('btn-refresh-list').addEventListener('click', loadArticles);
    document.getElementById('btn-select-all').addEventListener('click', selectAllGroups);
    document.getElementById('btn-copy-prompt').addEventListener('click', copyPrompt);
    document.getElementById('btn-copy-prompt').addEventListener('click', copyPrompt);
    document.getElementById('btn-process-result').addEventListener('click', processResult);
    document.getElementById('batch-limit').addEventListener('input', generatePrompt);
});

// 1. Load Articles (Unprocessed Only)
async function loadArticles() {
    const listEl = document.getElementById('group-list');
    listEl.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';

    try {
        // Fetch all articles that are valid for inspection (COLLECTED state)
        // reusing list_articles API but filtering client-side or we can add a param later
        const res = await fetch(`/api/analyzer/list?state=${ArticleState.COLLECTED}&limit=500&include_text=true`); // limit high
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        allArticles = data.articles || [];
        articleMap = {};
        sourceGroups = {};

        // Group by Source
        allArticles.forEach(article => {
            articleMap[article.id] = article;

            // Determine Source (heuristic from URL or metadata)
            let source = 'Unknown';
            if (article.url) {
                try {
                    source = new URL(article.url).hostname.replace('www.', '');
                } catch (e) { }
            }

            if (!sourceGroups[source]) sourceGroups[source] = [];
            sourceGroups[source].push(article);
        });

        renderGroupList();
        updateStatus(`${allArticles.length} items loaded ready for inspection.`);

    } catch (e) {
        listEl.innerHTML = `<div style="padding:20px; color:red;">Error: ${e.message}</div>`;
    }
}

function renderGroupList() {
    const listEl = document.getElementById('group-list');
    listEl.innerHTML = '';

    const sortedSources = Object.keys(sourceGroups).sort();

    if (sortedSources.length === 0) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No collected articles found.</div>';
        return;
    }

    sortedSources.forEach(source => {
        const items = sourceGroups[source];
        const div = document.createElement('div');
        div.className = `group-item ${selectedGroups.has(source) ? 'active' : ''}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <strong>${source}</strong>
                <span class="badge-new">${items.length}</span>
            </div>
        `;
        div.onclick = () => toggleGroupSelection(source, div);
        listEl.appendChild(div);
    });
}

function toggleGroupSelection(source, divEl) {
    if (selectedGroups.has(source)) {
        selectedGroups.delete(source);
        divEl.classList.remove('active');
    } else {
        selectedGroups.add(source);
        divEl.classList.add('active');
    }
    generatePrompt();
}

function selectAllGroups() {
    const allSources = Object.keys(sourceGroups);
    if (selectedGroups.size === allSources.length) {
        selectedGroups.clear(); // Deselect all
    } else {
        allSources.forEach(s => selectedGroups.add(s));
    }
    renderGroupList();
    generatePrompt();
}

// 2. Generate Prompt
function generatePrompt() {
    const selectedArticles = [];
    selectedGroups.forEach(source => {
        if (sourceGroups[source]) {
            selectedArticles.push(...sourceGroups[source]);
        }
    });

    const limit = parseInt(document.getElementById('batch-limit').value) || 10;

    // Apply Limit (Take first N items)
    const limitedArticles = selectedArticles.slice(0, limit);

    document.getElementById('prompt-count').textContent = `${limitedArticles.length} items (from ${selectedArticles.length} selected)`;

    if (limitedArticles.length === 0) {
        document.getElementById('prompt-area').value = '';
        return;
    }

    // Format for MLL Input (JSON Array) - V1 Spec Compliance
    const promptData = limitedArticles.map(article => {
        // Safe extraction
        const original = article._original || {};
        const description = original.summary || original.description || '';

        return {
            "Article_ID": article.id,
            "Source": article.source_id || 'unknown',
            "Title": original.title || article.title,
            "Description": description,
            "Body": (original.text || '').substring(0, 3000) // Truncate for safety
        };
    });

    const jsonStr = JSON.stringify(promptData, null, 2);
    document.getElementById('prompt-area').value = jsonStr;
}

async function copyPrompt() {
    const text = document.getElementById('prompt-area').value;
    if (!text) {
        alert('No prompt generated.');
        return;
    }
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('btn-copy-prompt');
    const originalText = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = originalText, 1500);
}

// 3. Process Result
async function processResult() {
    const input = document.getElementById('result-area').value.trim();
    if (!input) return alert('Paste the LLM result first.');

    // Parse JSON (handle markdown blocks)
    let jsonStr = input;
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '');
    }

    let resultData;
    try {
        resultData = JSON.parse(jsonStr);
    } catch (e) {
        return alert('Invalid JSON format. Please check the pasted content.');
    }

    // Support formatting: Array or Object wrapper
    let results = [];
    if (Array.isArray(resultData)) {
        results = resultData;
    } else if (resultData.results && Array.isArray(resultData.results)) {
        results = resultData.results;
    } else {
        // Single object?
        results = [resultData];
    }

    // [FIX] Sanitize results: Filter out invalid items (e.g., strings like "  " from LLM)
    results = results.filter(item => {
        return typeof item === 'object' && item !== null && !Array.isArray(item);
    });

    if (results.length === 0) return alert('No valid results found in JSON.');

    updateStatus(`Saving ${results.length} results...`);

    try {
        const res = await fetch('/api/analyzer/save_results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: results })
        });
        const data = await res.json();

        if (data.success) {
            alert(`✅ Saved ${data.saved_count} articles successfully!`);
            document.getElementById('result-area').value = ''; // clear
            selectedGroups.clear(); // clear selection
            loadArticles(); // reload list

            // 칸반보드 탭에 갱신 알림 (Cross-Tab Communication)
            localStorage.setItem('board_refresh_trigger', Date.now().toString());
        } else {
            alert('Error saving results: ' + data.error);
        }
    } catch (e) {
        alert('Network Error: ' + e.message);
    }
}

function updateStatus(msg) {
    document.getElementById('status-text').textContent = msg;
}
