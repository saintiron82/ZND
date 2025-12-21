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

    // [NEW] Auto Load List on Start (Simulate 'List' button click)
    // This will chain: Load List -> Restore Group -> Auto Fetch -> Auto Copy
    loadTargetList();
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

        // [NEW] Auto-select last group if exists
        const lastGroup = localStorage.getItem('inspector_last_group');
        if (lastGroup && sourceGroups[lastGroup]) {
            log(`Restoring last session: ${lastGroup}`, 'info');
            selectGroup(lastGroup);
        }

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
        const acceptedCount = items.filter(i => i.status === 'ACCEPTED').length;
        const cachedCount = items.filter(i => loadedContent[i.url] && (loadedContent[i.url].text || loadedContent[i.url].summary)).length;
        // 중복/스킵된 항목 (SKIPPED, REJECTED, WORTHLESS, MLL_FAILED 등)
        const skippedStatuses = ['SKIPPED', 'REJECTED', 'WORTHLESS', 'MLL_FAILED', 'INVALID'];
        const skippedCount = items.filter(i => skippedStatuses.includes(i.status)).length;

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
        // 상태별 개수 표시
        let statusParts = [];
        if (newCount > 0) statusParts.push(`<span style="color:#dc3545; font-weight:bold;">NEW ${newCount}</span>`);
        if (cachedCount > 0) statusParts.push(`<span style="color:#17a2b8;">📦${cachedCount}</span>`);
        if (acceptedCount > 0) statusParts.push(`<span style="color:#28a745;">✅${acceptedCount}</span>`);
        if (skippedCount > 0) statusParts.push(`<span style="color:#888; text-decoration:line-through;">⏭️${skippedCount}</span>`);

        const statusDisplay = statusParts.length > 0 ? statusParts.join(' · ') : '<span style="color:#888;">-</span>';

        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <input type="checkbox" id="${chkId}" class="group-chk" value="${sid}" checked style="margin-right:10px; transform:scale(1.2);">
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; font-size:1.1em;">${sid}</span>
                        <button onclick="resetGroupStatus('${sid}')" title="Reset all to NEW" style="font-size:0.8em; padding:2px 6px; cursor:pointer;">↺</button>
                    </div>
                    <div class="group-stat" style="margin-top:3px;">
                        <span style="color:#666;">전체 ${items.length}</span> | ${statusDisplay}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    // 전체 합계 업데이트
    updateSummary();
}

// 전체 합계 표시 업데이트
function updateSummary() {
    const skippedStatuses = ['SKIPPED', 'REJECTED', 'WORTHLESS', 'MLL_FAILED', 'INVALID'];

    let total = 0, newCount = 0, cachedCount = 0, acceptedCount = 0, skippedCount = 0;

    Object.values(sourceGroups).forEach(items => {
        items.forEach(item => {
            total++;
            if (item.status === 'NEW') newCount++;
            else if (item.status === 'ACCEPTED') acceptedCount++;
            else if (skippedStatuses.includes(item.status)) skippedCount++;

            if (loadedContent[item.url] && (loadedContent[item.url].text || loadedContent[item.url].summary)) {
                cachedCount++;
            }
        });
    });

    // DOM 업데이트
    const summaryArea = document.getElementById('summaryArea');
    if (summaryArea && total > 0) {
        summaryArea.style.display = 'block';
        document.getElementById('totalCount').textContent = total;
        document.getElementById('totalNew').textContent = newCount;
        document.getElementById('totalCached').textContent = cachedCount;
        document.getElementById('totalAccepted').textContent = acceptedCount;
        document.getElementById('totalSkipped').textContent = skippedCount;
    }
}

function resetGroupStatus(sid) {
    // [MODIFIED] 문구 변경: Reset -> Set to NEW
    if (!confirm(`'${sid}' 그룹의 모든 항목을 'NEW' 상태로 변경하시겠습니까?\n(기존에 긁어온 내용은 유지됩니다)`)) return;

    // 1. Reset Status
    sourceGroups[sid].forEach(i => i.status = 'NEW');

    // 2. [FIX] Do NOT Clear Cache! User wants to keep content.
    // sourceGroups[sid].forEach(i => {
    //     delete loadedContent[i.url];
    // });

    // Save state (saved flag might need update if we want to un-save? No, just status reset)
    saveContentCache();

    renderGroupList();
    if (currentGroup === sid) selectGroup(sid); // Refresh prompt if active

    log(`'${sid}' 그룹 상태가 NEW로 변경되었습니다. (내용 유지됨)`, 'info');
}

// --- Step 2: Fetch Content for Selected ---

// [NEW] Fetch ALL NEW items from ALL groups
async function fetchAllNewContent() {
    const allNewItems = [];
    Object.values(sourceGroups).forEach(items => {
        allNewItems.push(...items.filter(i => i.status === 'NEW'));
    });

    if (allNewItems.length === 0) {
        log("No NEW items found in any group.", 'info');
        return;
    }

    if (!confirm(`전체 그룹의 ${allNewItems.length}개 기사 내용을 모두 긁어오시겠습니까?`)) return;

    await fetchItems(allNewItems);

    // Auto-select first group if none selected
    if (!currentGroup) {
        const firstGroup = Object.keys(sourceGroups).sort()[0];
        if (firstGroup) selectGroup(firstGroup);
    } else {
        // Refresh current group prompt
        generatePromptForGroup(currentGroup);
    }
}

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

    await fetchItems(itemsToFetch);

    // Automatically select the first checked group
    if (selectedSids.length > 0) {
        selectGroup(selectedSids[0]);
    }
}

// [Helper] Generic Batch Fetcher
async function fetchItems(itemsToFetch) {
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

    } catch (e) {
        log('Error fetching content: ' + e, 'error');
        throw e; // Propagate error
    } finally {
        hideLoading();
    }
}

async function selectGroup(sid) {
    currentGroup = sid;
    localStorage.setItem('inspector_last_group', sid); // Save state

    // Highlight UI
    document.querySelectorAll('.group-item').forEach(el => el.classList.remove('active'));
    const chk = document.getElementById(`chk-${sid}`);
    if (chk) {
        chk.closest('.group-item').classList.add('active');
        // Ensure checkbox is checked when selected
        chk.checked = true;
    }

    // [NEW] Auto-Fetch Content Logic
    const items = sourceGroups[sid] || [];
    const newItems = items.filter(i => i.status === 'NEW');

    // Check if we need to fetch anything
    const missingUrls = newItems
        .map(i => i.url)
        .filter(u => !loadedContent[u] || (!loadedContent[u].text && !loadedContent[u].summary));

    if (missingUrls.length > 0) {
        log(`자동 추출 시작: '${sid}' 그룹 ${missingUrls.length}개 항목...`, 'info');
        showLoading(`'${sid}' 콘텐츠 자동 추출 중 (${missingUrls.length}개)...`);

        try {
            const chunkSize = 20;
            for (let i = 0; i < missingUrls.length; i += chunkSize) {
                const chunk = missingUrls.slice(i, i + chunkSize);
                // Update loading text if multiple chunks
                if (missingUrls.length > chunkSize) {
                    document.getElementById('loadingText').innerText = `Extracting ${Math.min(i + chunkSize, missingUrls.length)} / ${missingUrls.length}...`;
                }

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
            saveContentCache();
            log(`✅ 자동 추출 완료: ${missingUrls.length}개`, 'success');
        } catch (e) {
            log(`⚠️ 자동 추출 실패: ${e}`, 'error');
        } finally {
            hideLoading();
        }
    }

    // Clear Result
    document.getElementById('inputArea').value = '';

    // Generate Prompt (Now with loaded content)
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

    // [NEW] Auto-Copy Prompt
    try {
        await copyPrompt(true); // silent mode = true
    } catch (e) {
        console.warn("Auto-copy blocked by browser policy:", e);
        // It's okay, user can click the button.
    }
}

// [NEW] Copy Function
async function copyPrompt(silent = false) {
    const header = document.getElementById('promptHeader').value;
    const body = document.getElementById('promptArea').value;

    if (!body) {
        if (!silent) alert('복사할 내용이 없습니다.');
        return;
    }

    const fullText = `${header}\n\n${body}`;

    try {
        await navigator.clipboard.writeText(fullText);
        if (!silent) {
            alert('📋 프롬프트가 복사되었습니다! Gemini에 붙여넣으세요.');
        } else {
            log('📋 프롬프트 자동 복사 완료!', 'success');
        }

        // Visual Feedback
        const btn = document.getElementById('btnCopy');
        const originColor = btn.style.background;
        btn.style.background = '#28a745';
        btn.textContent = '✅ Copied!';
        setTimeout(() => {
            btn.style.background = originColor; // Restore color
            btn.textContent = '📋 Copy'; // Restore text
        }, 2000);

    } catch (err) {
        if (!silent) alert('복사 실패: ' + err);
        throw err;
    }
}



// --- Step 4: Batch Processing ---

// Helper: Normalize any input JSON structure to an Array of Articles (Legacy & V1.0 Support)
function normalizeStructToBatch(jsonStr) {
    let jsonData;
    try {
        if (typeof jsonStr === 'string') {
            // Markdown code block removal
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
            jsonData = JSON.parse(jsonStr);
        } else {
            jsonData = jsonStr;
        }

        console.log('[Inspector] Parsed Keys:', Object.keys(jsonData));

        // 1. Priority: V1.0.0 Standard { articles: [...] }
        if (jsonData.articles && Array.isArray(jsonData.articles)) {
            console.log(`[Inspector] Detected V1.0 'articles' array (${jsonData.articles.length} items)`);
            return jsonData.articles;
        }
        // 2. Legacy/Alternative { results: [...] }
        else if (jsonData.results && Array.isArray(jsonData.results)) {
            console.log(`[Inspector] Detected Legacy 'results' array (${jsonData.results.length} items)`);
            return jsonData.results;
        }
        // 3. Direct Array [...]
        else if (Array.isArray(jsonData)) {
            console.log(`[Inspector] Detected Direct Array (${jsonData.length} items)`);
            return jsonData;
        }
        // 4. Single Object -> Wrap in Array
        else if (typeof jsonData === 'object' && jsonData !== null) {
            // Check for valid single object
            if (jsonData.Article_ID || jsonData.article_id || jsonData.title_ko || jsonData.Meta) {
                console.log('[Inspector] Detected Single Object -> Wrapped in Array');
                return [jsonData];
            }
        }

        throw new Error(`Unknown structure. Keys: ${Object.keys(jsonData).join(', ')}`);

    } catch (e) {
        throw new Error('JSON Parse/Normalize Error: ' + e.message);
    }
}

async function processBatch() {
    const rawInput = document.getElementById('inputArea').value;
    if (!rawInput.trim()) return alert('JSON 응답을 붙여넣으세요!');

    alert('⚡ [Inspector] 처리 시작...'); // Debug Alert

    let results = [];
    try {
        results = normalizeStructToBatch(rawInput.trim());
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    if (results.length === 0) return alert('No results found in JSON');
    if (results.length === 0) return alert('No results found in JSON');
    if (!currentGroup) return alert('❌ 그룹(Target)이 선택되지 않았습니다. 왼쪽 목록에서 대상을 클릭해주세요.');

    // Debug: Check ID Map
    const mapSize = Object.keys(articleIdMap).length;
    console.log(`[Inspector] Current Group: ${currentGroup}, ID Map Size: ${mapSize}`);
    if (mapSize === 0) {
        log('⚠️ 경고: 현재 그룹의 매칭 정보(Article_ID)가 비어있습니다. "📥 Fetch Content"를 먼저 실행했거나, 그룹을 다시 클릭해보세요.', 'error');
    }

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
                log(`❌ 매칭 실패 (ID 미확인): ${articleId}`, 'error');
                console.warn(`[Match Fail] ID: ${articleId} not found in map (Size: ${mapSize})`);
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
            log(`❌ 매칭 실패 (링크 없음): 결과 #${i + 1}`, 'error');
            skippedCount++;
            continue;
        }

        try {
            // --- Schema Detection & Processing ---
            let processedData = {};

            // ========== V1.0 Schema (IS_Analysis, ZES_Raw_Metrics) ==========
            if (resData.IS_Analysis || resData.ZES_Raw_Metrics) {
                // V1.0 Meta Mapping (Stronger Fallback)
                if (resData.Meta) {
                    processedData.title_ko = resData.Meta.Headline || resData.Meta.title_ko || resData.Meta.Title_Ko || null;
                    processedData.summary = resData.Meta.Summary || resData.Meta.summary || null;
                    processedData.tags = resData.Meta.Tag || resData.Meta.tags || [];
                }

                // [FIX] 필수 필드 누락 방지 (Title Fallback)
                if (!processedData.title_ko) {
                    // 1. Root level check
                    processedData.title_ko = resData.Headline || resData.title_ko || resData.Title_Ko || resData.Title || null;
                }
                if (!processedData.title_ko && itemLink) {
                    // 2. Cache/Original fallback
                    const cached = loadedContent[itemLink.url] || {};
                    processedData.title_ko = cached.title || cached.original_title || itemLink.url; // 최후의 수단: URL
                    console.warn(`[Inspector] 'title_ko' missing for ${articleId}, using fallback: ${processedData.title_ko}`);
                }

                // V1.0 IS Calculation: IS = IW + IE
                // IW = Tier_Score + Gap_Score
                // IE = Scope_Total + Criticality_Total
                if (resData.IS_Analysis && resData.IS_Analysis.Calculations) {
                    const calc = resData.IS_Analysis.Calculations;
                    const iwAnalysis = calc.IW_Analysis || {};
                    const ieAnalysis = calc.IE_Analysis || {};
                    const ieInputs = ieAnalysis.Inputs || {};

                    const tierScore = parseFloat(iwAnalysis.Tier_Score || 0);
                    const gapScore = parseFloat(iwAnalysis.Gap_Score || 0);
                    const iwTotal = tierScore + gapScore;

                    const scopeTotal = parseFloat(ieInputs.Scope_Matrix_Score || 0);
                    const criticalityTotal = parseFloat(ieInputs.Criticality_Total || 0);
                    const ieTotal = scopeTotal + criticalityTotal;

                    const isScore = iwTotal + ieTotal;
                    processedData.impact_score = Math.round(Math.max(0, Math.min(10, isScore)) * 10) / 10;
                    processedData.IS_Analysis = resData.IS_Analysis;
                }

                // V1.0 ZES Calculation:
                // S = (T1 + T2 + T3) / 3
                // N = (P1 + P2 + P3) / 3
                // U = (V1 + V2 + V3) / 3
                // ZS = 10 - (((S + 10 - N) / 2) * (U / 10) + Fine_Adjustment)
                if (resData.ZES_Raw_Metrics) {
                    const metrics = resData.ZES_Raw_Metrics;

                    const signal = metrics.Signal || {};
                    const t1 = parseFloat(signal.T1 || 0);
                    const t2 = parseFloat(signal.T2 || 0);
                    const t3 = parseFloat(signal.T3 || 0);
                    const s = (t1 + t2 + t3) / 3.0;

                    const noise = metrics.Noise || {};
                    const p1 = parseFloat(noise.P1 || 0);
                    const p2 = parseFloat(noise.P2 || 0);
                    const p3 = parseFloat(noise.P3 || 0);
                    const n = (p1 + p2 + p3) / 3.0;

                    const utility = metrics.Utility || {};
                    const v1 = parseFloat(utility.V1 || 0);
                    const v2 = parseFloat(utility.V2 || 0);
                    const v3 = parseFloat(utility.V3 || 0);
                    const u = (v1 + v2 + v3) / 3.0;

                    const fineAdjObj = metrics.Fine_Adjustment || {};
                    const fineAdj = parseFloat(fineAdjObj.Score || 0);

                    const inner = (s + 10 - n) / 2.0;
                    const weighted = inner * (u / 10.0);
                    const zes = 10.0 - (weighted + fineAdj);

                    processedData.zero_echo_score = Math.round(Math.max(0, Math.min(10, zes)) * 10) / 10;
                    processedData.ZES_Raw_Metrics = resData.ZES_Raw_Metrics;
                }

                processedData.schema_version = 'V1.0';
            }
            // ========== V0.9 Schema (Impact_Analysis_IS, Evidence_Analysis_ZES) ==========
            else if (resData.Impact_Analysis_IS || resData.Evidence_Analysis_ZES) {
                // Meta (title_ko, summary, tags)
                if (resData.Meta) {
                    processedData.title_ko = resData.Meta.Headline || resData.Meta.title_ko;
                    processedData.summary = resData.Meta.summary;
                    processedData.tags = resData.Meta.Tag || resData.Meta.tags || [];
                }

                // [FIX] V0.9 Title Fallback
                if (!processedData.title_ko && itemLink) {
                    const cached = loadedContent[itemLink.url] || {};
                    processedData.title_ko = cached.title || cached.original_title || itemLink.url;
                }

                // Impact Score (IS) Calculation from Impact_Analysis_IS
                if (resData.Impact_Analysis_IS && resData.Impact_Analysis_IS.Scores) {
                    const scores = resData.Impact_Analysis_IS.Scores;
                    let is = 0.0;
                    is += parseFloat(scores.IW_Score || 0);
                    is += parseFloat(scores.Gap_Score || 0);
                    is += parseFloat(scores.Context_Bonus || 0);
                    const ieBreakdown = scores.IE_Breakdown_Total || {};
                    is += parseFloat(ieBreakdown.Scope_Total || 0);
                    is += parseFloat(ieBreakdown.Criticality_Total || 0);
                    is += parseFloat(scores.Adjustment_Score || 0);
                    processedData.impact_score = Math.round(Math.max(0, Math.min(10, is)) * 10) / 10;
                    processedData.Impact_Analysis_IS = resData.Impact_Analysis_IS;
                }

                // Zero Echo Score (ZES) Calculation from Evidence_Analysis_ZES (Base 5.0)
                if (resData.Evidence_Analysis_ZES && resData.Evidence_Analysis_ZES.ZES_Score_Vector) {
                    const vector = resData.Evidence_Analysis_ZES.ZES_Score_Vector;
                    let zesSum = 0.0;
                    if (vector.Positive_Scores) {
                        vector.Positive_Scores.forEach(p => { zesSum += parseFloat(p.Raw_Score || 0) * parseFloat(p.Weight || 1); });
                    }
                    if (vector.Negative_Scores) {
                        vector.Negative_Scores.forEach(n => { zesSum += parseFloat(n.Raw_Score || 0) * parseFloat(n.Weight || 1); });
                    }
                    let zes = 5.0 - zesSum;
                    processedData.zero_echo_score = Math.round(Math.max(0, Math.min(10, zes)) * 10) / 10;
                    processedData.Evidence_Analysis_ZES = resData.Evidence_Analysis_ZES;
                }

                processedData.schema_version = 'V0.9';
            }
            // ========== Legacy Flat Fields ==========
            else {
                if (resData.title_ko) processedData.title_ko = resData.title_ko;
                if (resData.summary) processedData.summary = resData.summary;
                if (resData.tags) processedData.tags = resData.tags;
                if (resData.impact_score !== undefined) processedData.impact_score = parseFloat(resData.impact_score);
                if (resData.zero_echo_score !== undefined) processedData.zero_echo_score = parseFloat(resData.zero_echo_score);
                processedData.schema_version = 'Legacy';
            }

            // Legacy flat fields fallback (ensure basic fields exist)
            if (!processedData.title_ko && resData.title_ko) processedData.title_ko = resData.title_ko;
            if (!processedData.summary && resData.summary) processedData.summary = resData.summary;
            if (!processedData.tags && resData.tags) processedData.tags = resData.tags;

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
