// Batch Processor Logic

let allLinks = [];      // Flattened list of all links
let sourceGroups = {};  // Map: source_id -> [linkObj, ...]
let loadedContent = {}; // Map: url -> contentData
let currentGroup = null; // Current selected source_id
let articleIdMap = {};  // Map: articleId -> url (for hash-based matching)

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

        // 2. 캐시에 이미 저장된(saved) 아이템은 ACCEPTED 처리
        allLinks.forEach(link => {
            const cached = loadedContent[link.url];
            if (cached && cached.saved) {
                link.status = 'ACCEPTED';
            }
        });

        // 3. Group by Source
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

// Generate a short unique hash ID for article matching
function generateArticleId() {
    return Math.random().toString(36).substring(2, 8);
}

async function generatePromptForGroup(sid) {
    const items = sourceGroups[sid];
    const newItems = items.filter(i => i.status === 'NEW');

    // Reset article ID map for this batch
    articleIdMap = {};

    // [FIX] 전체 그룹의 Article_ID를 articleIdMap에 등록 (덮어쓰기 지원)
    items.forEach(link => {
        const content = loadedContent[link.url] || link.content || {};
        const articleId = content.article_id || null;
        if (articleId) {
            articleIdMap[articleId] = link.url;
        }
    });

    if (newItems.length === 0) {
        document.getElementById('promptArea').value = "(이 그룹에 'NEW' 상태의 기사가 없습니다)";
        document.getElementById('promptStatus').textContent = 'Idle';
        return;
    }

    // Build V0.9 JSON Array (NEW 기사만 프롬프트에 포함)
    const inputArray = [];
    let loadedCount = 0;

    newItems.forEach((link, idx) => {
        const content = loadedContent[link.url] || {};
        const title = content.title || content.original_title || link.url;
        let body = content.text || content.summary || '';

        if (content.text || content.summary) loadedCount++;

        if (body.length > 5000) body = body.substring(0, 5000) + "...(truncated)";

        // Generate unique hash ID for this article
        const articleId = content.article_id || generateArticleId();
        articleIdMap[articleId] = link.url;  // NEW 기사도 등록

        inputArray.push({
            "Article_ID": articleId,
            "Title": title,
            "Body": body
        });
    });

    // Format as JSON string (V0.9 Input Format)
    const jsonStr = JSON.stringify(inputArray, null, 2);
    document.getElementById('promptArea').value = jsonStr;

    if (loadedCount < newItems.length) {
        document.getElementById('promptStatus').textContent = `⚠️ ${loadedCount}/${newItems.length} 로드됨`;
    } else {
        document.getElementById('promptStatus').textContent = `✅ 준비 완료 (${newItems.length}개)`;
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
    if (!rawInput.trim()) return alert('JSON 응답을 붙여넣으세요!');

    let jsonStr = rawInput.trim();
    // Remove markdown
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let results = [];
    try {
        let parsed = JSON.parse(jsonStr);

        // Auto-extract if LLM sent schema format
        if (parsed.properties && parsed.type === 'object') {
            parsed = parsed.properties;
        }

        if (Array.isArray(parsed)) results = parsed;
        else if (parsed.results && Array.isArray(parsed.results)) results = parsed.results;
        else if (parsed.Article_ID || parsed.article_id || parsed.title_ko) {
            results = [parsed];
        }
        else throw new Error("JSON must be a list or {results: []}");
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    if (results.length === 0) return alert('No results found in JSON');
    if (!currentGroup) return alert('No group selected');

    // NEW 상태 기사 (순서 기반 매칭용)
    const newItems = sourceGroups[currentGroup].filter(i => i.status === 'NEW');
    // 전체 기사 (Article_ID 기반 매칭용 - 덮어쓰기 지원)
    const allItems = sourceGroups[currentGroup];

    // V0.9: Article_ID, Legacy: article_id
    const hasArticleIds = results.every(r => r.Article_ID || r.article_id);

    if (!hasArticleIds) {
        if (!confirm(`⚠️ 응답에 Article_ID가 없습니다!\n순서 기반 매칭을 사용합니다.\n\nExpected: ${newItems.length}개\nProvided: ${results.length}개\n\n계속하시겠습니까?`)) return;
    }

    // [NEW] Article_ID로 서버 전체 캐시 검색 (로컬 맵에 없는 ID 처리)
    let serverCacheMap = {};
    if (hasArticleIds) {
        const allArticleIds = results.map(r => r.Article_ID || r.article_id);
        const missingIds = allArticleIds.filter(id => !articleIdMap[id]);

        if (missingIds.length > 0) {
            showLoading(`서버 캐시 검색 중 (${missingIds.length}개)...`);
            try {
                const searchRes = await fetch('/api/find_by_article_ids', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ article_ids: missingIds })
                });
                const searchData = await searchRes.json();
                if (searchData.found) {
                    serverCacheMap = searchData.found;
                    log(`🔍 서버 캐시에서 ${searchData.found_count}개 발견`, 'info');
                }
            } catch (err) {
                log(`⚠️ 서버 캐시 검색 실패: ${err}`, 'error');
            }
        }
    }

    showLoading('저장 중...');

    let successCount = 0;
    let skippedCount = 0;
    let overwriteCount = 0;

    for (let i = 0; i < results.length; i++) {
        const resData = results[i];
        let itemLink = null;
        let url = null;
        let isOverwrite = false;
        let serverCacheData = null;  // 서버에서 찾은 캐시 데이터

        // V0.9: Article_ID, Legacy: article_id
        const articleId = resData.Article_ID || resData.article_id;

        if (hasArticleIds && articleId) {
            // 1. 먼저 로컬 articleIdMap에서 찾기
            url = articleIdMap[articleId];

            // 2. 로컬에 없으면 서버 캐시에서 찾기
            if (!url && serverCacheMap[articleId]) {
                url = serverCacheMap[articleId].url;
                serverCacheData = serverCacheMap[articleId].content;
                loadedContent[url] = serverCacheData;  // 로컬 캐시에 추가
                log(`🔍 서버 캐시에서 매칭: ${articleId}`, 'info');
            }

            if (!url) {
                log(`⚠️ 알 수 없는 Article_ID: ${articleId}`, 'error');
                skippedCount++;
                continue;
            }

            // [FIX] Article_ID 매칭은 전체 그룹에서 검색 (덮어쓰기 지원)
            itemLink = allItems.find(item => item.url === url);

            // 서버 캐시에서 찾은 경우 임시 itemLink 생성
            if (!itemLink && serverCacheData) {
                itemLink = {
                    url: url,
                    source_id: serverCacheData.source_id || 'unknown',
                    status: serverCacheData.saved ? 'ACCEPTED' : 'NEW'
                };
                isOverwrite = serverCacheData.saved;
            } else if (itemLink && itemLink.status === 'ACCEPTED') {
                isOverwrite = true;
            }
        } else {
            // 순서 기반 매칭은 NEW 상태만
            if (i < newItems.length) {
                itemLink = newItems[i];
                url = itemLink.url;
            }
        }

        if (!itemLink) {
            log(`⚠️ 결과 ${i + 1}에 일치하는 기사 없음`, 'error');
            skippedCount++;
            continue;
        }

        try {
            // --- V0.9 Schema Processing ---
            let processedData = {};

            // Meta (title_ko, summary, tags)
            if (resData.Meta) {
                processedData.title_ko = resData.Meta.Headline || resData.Meta.title_ko;
                processedData.summary = resData.Meta.summary;
                processedData.tags = resData.Meta.Tag || resData.Meta.tags || [];
            }

            // Impact Score (IS) Calculation from Impact_Analysis_IS
            if (resData.Impact_Analysis_IS && resData.Impact_Analysis_IS.Scores) {
                const scores = resData.Impact_Analysis_IS.Scores;
                let is = 0.0;
                is += parseFloat(scores.IW_Score || 0);
                is += parseFloat(scores.Gap_Score || 0);
                is += parseFloat(scores.Context_Bonus || 0);
                // Scope_Total and Criticality_Total are nested inside IE_Breakdown_Total
                const ieBreakdown = scores.IE_Breakdown_Total || {};
                is += parseFloat(ieBreakdown.Scope_Total || 0);
                is += parseFloat(ieBreakdown.Criticality_Total || 0);
                is += parseFloat(scores.Adjustment_Score || 0);
                processedData.impact_score = Math.round(Math.max(0, Math.min(10, is)) * 10) / 10;
                processedData.Impact_Analysis_IS = resData.Impact_Analysis_IS;
            } else if (resData.impact_score !== undefined) {
                processedData.impact_score = parseFloat(resData.impact_score);
            }

            // Zero Echo Score (ZES) Calculation from Evidence_Analysis_ZES (Base 5.0)
            // Formula: ZES = 5 - (Positive + Negative)
            if (resData.Evidence_Analysis_ZES && resData.Evidence_Analysis_ZES.ZES_Score_Vector) {
                const vector = resData.Evidence_Analysis_ZES.ZES_Score_Vector;
                let zesSum = 0.0;
                if (vector.Positive_Scores) {
                    vector.Positive_Scores.forEach(p => { zesSum += parseFloat(p.Raw_Score || 0) * parseFloat(p.Weight || 1); });
                }
                if (vector.Negative_Scores) {
                    vector.Negative_Scores.forEach(n => { zesSum += parseFloat(n.Raw_Score || 0) * parseFloat(n.Weight || 1); });
                }
                // ZES = 5 - (sum)
                let zes = 5.0 - zesSum;
                processedData.zero_echo_score = Math.round(Math.max(0, Math.min(10, zes)) * 10) / 10;
                processedData.Evidence_Analysis_ZES = resData.Evidence_Analysis_ZES;
            } else if (resData.zero_echo_score !== undefined) {
                processedData.zero_echo_score = parseFloat(resData.zero_echo_score);
            }

            // Legacy flat fields fallback
            if (!processedData.title_ko && resData.title_ko) processedData.title_ko = resData.title_ko;
            if (!processedData.summary && resData.summary) processedData.summary = resData.summary;
            if (!processedData.tags && resData.tags) processedData.tags = resData.tags;

            // Build final document
            let finalDoc = { ...loadedContent[url], ...processedData };
            finalDoc.raw_analysis = resData; // Store original response for reference

            finalDoc.url = url;
            finalDoc.source_id = currentGroup;
            if (!finalDoc.original_title && finalDoc.title) finalDoc.original_title = finalDoc.title;

            const saveRes = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalDoc)
            });
            const saveJson = await saveRes.json();

            if (saveJson.status === 'success') {
                if (isOverwrite) {
                    log(`🔄 덮어쓰기: ${finalDoc.title_ko || url}`, 'success');
                    overwriteCount++;
                } else {
                    log(`✅ 저장: ${finalDoc.title_ko || url}`, 'success');
                }
                itemLink.status = 'ACCEPTED';
                successCount++;
            } else {
                log(`❌ 실패: ${url} - ${saveJson.error}`, 'error');
            }
        } catch (err) {
            log(`❌ 오류 처리 ${url}: ${err}`, 'error');
        }
    }

    hideLoading();
    let logMsg = `배치 완료. ${successCount}/${results.length} 저장`;
    if (overwriteCount > 0) logMsg += ` (덮어쓰기: ${overwriteCount})`;
    if (skippedCount > 0) logMsg += ` (건너뜀: ${skippedCount})`;
    log(logMsg, 'success');
    renderGroupList();
    document.getElementById('inputArea').value = '';

    // 처리된 아이템 제외하고 남은 NEW 아이템만 프롬프트에 표시
    if (currentGroup) {
        generatePromptForGroup(currentGroup);
    }

    // Save cache after processing
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
