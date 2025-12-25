// Batch Processor Logic
let allLinks = [];      // Flattened list of all links
let sourceGroups = {};  // Map: source_id -> [linkObj, ...]
let loadedContent = {}; // Map: url -> contentData
let currentGroup = null; // Current selected source_id
let articleIdMap = {};  // Map: articleId -> url (for hash-based matching)

// [Helper] Check if item is already analyzed (has scores)
function isAnalyzed(url) {
    const content = loadedContent[url];
    if (!content) return false;
    // 1. 명시적 상태 확인
    if (content.status === 'ANALYZED') return true;
    if (content.status === 'RAW') return false;
    // 2. 하위 호환: 점수가 있으면 분석된 것으로 간주
    return (content.impact_score !== undefined || content.zero_echo_score !== undefined);
}

window.onload = function () {
    // Initial state handled by HTML mostly.

    // Set default Header Instruction
    const defaultHeader = "";

    const headerEl = document.getElementById('promptHeader');
    if (headerEl) headerEl.value = defaultHeader;

    // Load Cache
    loadContentCache();

    // [MODIFIED] Auto Load List on Start
    loadTargetList();
};

// [NEW] 즉시 수집 실행 (UTF-8 Safe)
async function runCrawlNow() {
    if (!confirm('지금 모든 타겟에 대해 수집을 실행하시겠습니까?\n(기존 수집된 데이터는 유지되고 새로운 기사만 추가됩니다.)')) return;

    showLoading('⏳ 수집 중... (잠시만 기다려주세요)');

    try {
        const response = await fetch('/api/automation/collect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.success) {
            log('✅ 수집 완료!', 'success');
            // 리스트 자동 갱신
            loadTargetList();
        } else {
            log('❌ 수집 실패: ' + result.error, 'error');
            alert('수집 실패: ' + result.error);
        }
    } catch (e) {
        log('❌ 통신 오류: ' + e.message, 'error');
        alert('통신 오류: ' + e.message);
    } finally {
        hideLoading();
    }
}



// [NEW] 휴지통 모드 토글
async function toggleTrashMode() {
    isTrashMode = !isTrashMode;
    const btn = document.getElementById('btnCrawlNow'); // Reusing or finding adequate button space
    // UI Update Logic will be in HTML or here if element exists

    // Refresh List
    await loadTargetList();

    // Update Header UI to reflect mode
    const titleEl = document.querySelector('h1');
    if (isTrashMode) {
        titleEl.textContent = '🗑️ 휴지통 (Trash Bin)';
        titleEl.style.color = 'red';
    } else {
        titleEl.textContent = 'Inspector';
        titleEl.style.color = '';
    }
}

// [NEW] 선택 항목 영구 삭제 (Trash Manager)
async function deleteSelectedPermanently() {
    const checked = getCheckedItems();
    if (checked.length === 0) return alert('삭제할 항목을 선택해주세요.');

    if (!confirm(`🔥 정말로 선텍한 ${checked.length}개 항목을 영구 삭제하시겠습니까?\n(파일은 삭제되지만, 재수집 방지를 위해 DB 기록은 남습니다.)`)) return;

    showLoading('영구 삭제 중...');

    try {
        const urls = checked.map(item => item.url);
        const response = await fetch('/api/delete_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: urls })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.deleted_files_count}개의 파일이 삭제되었습니다.`);
            await loadTargetList(); // Refresh
        } else {
            alert('❌ 삭제 실패: ' + result.error);
        }
    } catch (e) {
        alert('삭제 오류: ' + e);
        console.error(e);
    } finally {
        hideLoading();
    }
}

// --- Step 1: Load List Only ---
async function loadTargetList() {
    showLoading('Fetching Unprocessed List... (Checking all history)');
    try {
        // [MODIFIED] Fetch ALL unprocessed items from cache (regardless of date)
        const res = await fetch('/api/unprocessed_items');
        const data = await res.json();
        allLinks = data.links;

        if (allLinks.length === 0) {
            log('현재 대기 중인(미처리) 기사가 없습니다. (필요하면 "▶️ 수집"을 실행하세요)', 'info');
        } else {
            log(`${allLinks.length}개의 미처리 기사를 로드했습니다.`, 'success');
        }

        // Populate loadedContent from API response
        allLinks.forEach(link => {
            if (link.content) {
                loadedContent[link.url] = link.content;
            }
        });

        // 3. Group by Source
        sourceGroups = {};
        allLinks.forEach(link => {
            const sid = link.source_id || 'unknown';
            if (!sourceGroups[sid]) sourceGroups[sid] = [];
            sourceGroups[sid].push(link);
        });

        console.log(`[Inspector] Loaded Links: ${allLinks.length}`);
        console.log(`[Inspector] Groups:`, Object.keys(sourceGroups));
        Object.keys(sourceGroups).forEach(k => {
            console.log(` - ${k}: ${sourceGroups[k].length} items`);
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

        // 상태별 카운트 세분화
        let pureNewCount = 0;   // RAW or NEW (No Analysis)
        let analyzedCount = 0;  // ANALYZED or Analyzed Check
        let savedCount = 0;     // ACCEPTED or PUBLISHED
        let rejectedCount = 0;  // REJECTED or WORTHLESS
        let skippedCount = 0;   // SKIPPED
        let failedCount = 0;    // MLL_FAILED or INVALID or Others

        items.forEach(i => {
            if (i.status === 'ACCEPTED' || i.status === 'PUBLISHED') savedCount++;
            else if (i.status === 'REJECTED' || i.status === 'WORTHLESS') rejectedCount++;
            else if (i.status === 'SKIPPED') skippedCount++;
            else if (i.status === 'MLL_FAILED' || i.status === 'INVALID' || i.status === 'FETCH_FAILED') failedCount++;
            else if (i.status === 'ANALYZED' || isAnalyzed(i.url)) analyzedCount++;
            else pureNewCount++; // 'NEW' or 'RAW' without analysis
        });

        const div = document.createElement('div');
        div.className = 'group-item';

        // [MODIFIED] 그룹 클릭 이벤트 제거 - 현황만 표시
        // (기존: selectGroup 호출)

        // 개선된 UI: 2열 그리드 레이아웃 (체크박스 제거)
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-weight:bold; font-size:1.15em;">${sid}</div>
            </div>
            <div class="group-stat" style="display:grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.9em;">
                <span style="${pureNewCount > 0 ? 'color:#d63384; font-weight:bold;' : 'color:#ccc;'}">🔥 NEW: ${pureNewCount}</span>
                <span style="${analyzedCount > 0 ? 'color:#fd7e14; font-weight:bold;' : 'color:#ccc;'}">📝 Analyzed: ${analyzedCount}</span>
                <span style="${savedCount > 0 ? 'color:#198754; font-weight:bold;' : 'color:#ccc;'}">✅ Saved: ${savedCount}</span>
                <span style="${rejectedCount > 0 ? 'color:#dc3545;' : 'color:#ccc;'}">🚫 Rejected: ${rejectedCount}</span>
                <span style="${skippedCount > 0 ? 'color:#6c757d;' : 'color:#ccc;'}">⏭️ Skipped: ${skippedCount}</span>
                ${failedCount > 0 ? `<span style="color:#dc3545; font-weight:bold;">⚠️ Failed: ${failedCount}</span>` : ''}
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

    let total = 0, pureNewCount = 0, analyzedCount = 0, acceptedCount = 0, skippedCount = 0;

    Object.values(sourceGroups).forEach(items => {
        items.forEach(item => {
            total++;
            if (item.status === 'ACCEPTED') {
                acceptedCount++;
            } else if (skippedStatuses.includes(item.status)) {
                skippedCount++;
            } else if (item.status === 'NEW') {
                if (isAnalyzed(item.url)) {
                    analyzedCount++;
                } else {
                    pureNewCount++;
                }
            }
        });
    });

    // DOM 업데이트
    const summaryArea = document.getElementById('summaryArea');
    if (summaryArea && total > 0) {
        summaryArea.style.display = 'block';
        document.getElementById('totalCount').textContent = total;
        document.getElementById('totalNew').textContent = pureNewCount;
        document.getElementById('totalCached').textContent = analyzedCount; // id 유지, 의미 변경 (Analyzed)
        // summaryArea label도 변경 필요 (아래에서 DOM 조작으로 텍스트 변경)

        // 텍스트 변경
        const cachedLabel = document.getElementById('totalCached').parentElement;
        if (cachedLabel) cachedLabel.innerHTML = `📝요약됨: <strong id="totalCached">${analyzedCount}</strong>`;

        document.getElementById('totalAccepted').textContent = acceptedCount;
        document.getElementById('totalSkipped').textContent = skippedCount;
    }
}

function resetGroupStatus(sid) {
    // [MODIFIED] 문구 변경: Reset -> Set to NEW
    if (!confirm(`'${sid}' 그룹의 모든 항목을 'NEW' 상태로 변경하시겠습니까?\n(기존에 긁어온 내용은 유지됩니다)`)) return;

    // 1. Reset Status
    sourceGroups[sid].forEach(i => i.status = 'NEW');

    // Save state
    saveContentCache();

    renderGroupList();
    log(`'${sid}' 그룹 상태가 NEW로 변경되었습니다. (내용 유지됨)`, 'info');
}

// [NEW] 배치 추출 - 전체 NEW 기사 중 N개를 추출하여 프롬프트 생성
async function extractBatch() {
    const batchSize = parseInt(document.getElementById('batchSizeSlider').value) || 10;

    // 전체 NEW 기사 수집 (분석되지 않은 것만)
    let allNewItems = [];
    Object.values(sourceGroups).forEach(items => {
        items.forEach(item => {
            if (item.status === 'NEW' && !isAnalyzed(item.url)) {
                allNewItems.push(item);
            }
        });
    });

    if (allNewItems.length === 0) {
        alert('분석할 NEW 기사가 없습니다.');
        return;
    }

    // batchSize만큼 추출
    const itemsToProcess = allNewItems.slice(0, batchSize);

    log(`⚡ 추출 시작: ${itemsToProcess.length}개 / 전체 NEW ${allNewItems.length}개`, 'info');

    // 콘텐츠 가져오기 (캐시에 없는 경우)
    const missingUrls = itemsToProcess
        .map(i => i.url)
        .filter(u => !loadedContent[u] || (!loadedContent[u].text && !loadedContent[u].summary));

    if (missingUrls.length > 0) {
        showLoading(`콘텐츠 추출 중... (${missingUrls.length}개)`);
        try {
            const chunkSize = 20;
            for (let i = 0; i < missingUrls.length; i += chunkSize) {
                const chunk = missingUrls.slice(i, i + chunkSize);
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
        } catch (e) {
            log(`❌ 추출 실패: ${e}`, 'error');
            hideLoading();
            return;
        }
        hideLoading();
    }

    // 프롬프트 생성
    articleIdMap = {};
    const inputArray = [];

    itemsToProcess.forEach(link => {
        const content = loadedContent[link.url] || {};
        const title = content.title || content.original_title || link.url;
        let body = content.text || '';
        let description = content.description || content.summary || '';

        if (body.length > 5000) body = body.substring(0, 5000) + '...(truncated)';

        // Article ID 생성
        let articleId = content.article_id;
        if (!articleId) {
            articleId = Math.random().toString(36).substring(2, 8);
            content.article_id = articleId;
            loadedContent[link.url] = content;
        }
        articleIdMap[articleId] = link.url;

        inputArray.push({
            "Article_ID": articleId,
            "Source": link.source_id || 'unknown',
            "Title": title,
            "Description": description,
            "Body": body
        });
    });

    // 프롬프트 영역에 표시
    const jsonStr = JSON.stringify(inputArray, null, 2);
    document.getElementById('promptArea').value = jsonStr;
    document.getElementById('promptStatus').textContent = `✅ ${inputArray.length}개 준비 완료 (전체 NEW: ${allNewItems.length}개)`;

    saveContentCache();
    log(`✅ 프롬프트 생성 완료: ${inputArray.length}개`, 'success');
}

// --- Step 2: Fetch Content for Selected ---

// [NEW] Fetch ALL NEW items from ALL groups
async function fetchAllNewContent() {
    const allNewItems = [];
    Object.values(sourceGroups).forEach(items => {
        // [MODIFIED] Only fetch Pure NEW (exclude Analyzed)
        allNewItems.push(...items.filter(i => i.status === 'NEW' && !isAnalyzed(i.url)));
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

// [NEW] Batch Action Handler
async function handleBatchAction() {
    const checkboxes = document.querySelectorAll('.group-checkbox:checked'); // Class name updated
    const selectedSids = Array.from(checkboxes).map(cb => cb.dataset.sid);   // Dataset updated

    if (selectedSids.length === 0) return alert("최소한 하나 이상의 그룹을 선택해주세요.");

    // Collect all NEW items from selected groups
    let itemsToFetch = [];
    selectedSids.forEach(sid => {
        // [MODIFIED] Only fetch Pure NEW (exclude Analyzed)
        const newItems = sourceGroups[sid].filter(i => i.status === 'NEW' && !isAnalyzed(i.url));
        itemsToFetch = itemsToFetch.concat(newItems);
    });

    if (itemsToFetch.length > 0) {
        await fetchItems(itemsToFetch);
    } else {
        log("선택된 그룹에 새로 추출할 콘텐츠가 없습니다. (이미 로드됨)", 'info');
    }

    // Generate Combined Prompt
    generatePromptBatch(selectedSids);
}

// [NEW] Combined Prompt Generator
async function generatePromptBatch(sids) {
    let allNewItems = [];

    // Aggregate items
    sids.forEach(sid => {
        const items = sourceGroups[sid];
        const newItems = items.filter(i => i.status === 'NEW' && !isAnalyzed(i.url));
        allNewItems = allNewItems.concat(newItems);
    });

    if (allNewItems.length === 0) {
        document.getElementById('promptArea').value = "(선택된 그룹에 'NEW' 상태의 기사가 없습니다)";
        return;
    }

    // Reset ID Map (Batch)
    articleIdMap = {};

    // Register IDs for ALL loaded content (Global Search support handles the rest, but map is good)
    allNewItems.forEach(link => {
        const content = loadedContent[link.url] || link.content || {};
        if (content.article_id) articleIdMap[content.article_id] = link.url;
    });

    // Build Input Array
    const inputArray = [];
    allNewItems.forEach(link => {
        const content = loadedContent[link.url] || {};

        let body = content.text || '';
        let description = content.description || content.summary || ''; // Description or Original Summary

        if (body.length > 3000) body = body.substring(0, 3000) + "...(truncated)"; // Shorter limit for batch

        // Generate ID if missing
        if (!content.article_id) {
            content.article_id = generateArticleId();
            loadedContent[link.url] = content; // Save back
        }
        articleIdMap[content.article_id] = link.url;

        inputArray.push({
            "Article_ID": content.article_id,
            "Source": link.source_id, // Include Source for Batch
            "Title": content.title || link.title,
            "Description": description,
            "Body": body
        });
    });

    const jsonStr = JSON.stringify(inputArray, null, 2);
    document.getElementById('promptArea').value = jsonStr;
    document.getElementById('promptStatus').textContent = `Batch: ${inputArray.length} items from ${sids.length} groups`;

    saveContentCache();

    log(`Bacth Prompt Generated: ${inputArray.length} items`, 'success');
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
    // [MODIFIED] Only select Pure NEW items
    const newItems = items.filter(i => i.status === 'NEW' && !isAnalyzed(i.url));

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
    // [MODIFIED] Generate prompt ONLY for Pure NEW items (exclude Analyzed/Accepted)
    const newItems = items.filter(i => i.status === 'NEW' && !isAnalyzed(i.url));

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

        // [MODIFIED] 내용 본문은 text만 사용. 메타 요약은 Description으로 분리.
        let body = content.text || '';
        let description = content.description || content.summary || '';

        if (body || description) loadedCount++;

        if (body.length > 5000) body = body.substring(0, 5000) + "...(truncated)";

        // Generate unique hash ID for this article
        let articleId = content.article_id;
        if (!articleId) {
            articleId = generateArticleId();
            content.article_id = articleId; // [FIX] 생성된 ID를 콘텐츠에 영구 저장
            loadedContent[link.url] = content;
        }
        articleIdMap[articleId] = link.url;  // NEW 기사도 등록

        inputArray.push({
            "Article_ID": articleId,
            "Title": title,
            "Description": description, // LLM 참고용 메타 요약
            "Body": body
        });
    });

    // Format as JSON string (V0.9 Input Format)
    const jsonStr = JSON.stringify(inputArray, null, 2);
    document.getElementById('promptArea').value = jsonStr;

    // [New] Save IDs to cache immediately
    saveContentCache();

    if (loadedCount < newItems.length) {
        document.getElementById('promptStatus').textContent = `⚠️ ${loadedCount}/${newItems.length} 로드됨`;
    } else {
        document.getElementById('promptStatus').textContent = `✅ 준비 완료 (${newItems.length}개)`;
    }

    // [REMOVED] Auto-Copy Prompt - 이제 명시적으로 Copy 버튼 클릭 필요
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
} // End of normalizeStructToBatch

async function processBatch() {
    const rawInput = document.getElementById('inputArea').value;
    if (!rawInput.trim()) return alert('JSON 응답을 붙여넣으세요!');

    // [MODIFIED] No Alert Check - Start Immediately
    showLoading('⚡ 처리 및 저장 중...');

    let results = [];
    try {
        results = normalizeStructToBatch(rawInput.trim());
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    if (results.length === 0) return alert('No results found in JSON');
    if (results.length === 0) return alert('No results found in JSON');
    if (results.length === 0) return alert('No results found in JSON');
    // Group check removed for Global Search support

    // [MODIFIED] Build Global ID Map (Scan ALL loaded content)
    let globalIdMap = {};
    Object.keys(loadedContent).forEach(url => {
        const c = loadedContent[url];
        if (c && c.article_id) {
            globalIdMap[c.article_id] = url;
        }
    });

    // [FIX] Declare serverCacheMap
    let serverCacheMap = {};

    // [FIX] Handle null currentGroup safely
    const newItems = (currentGroup && sourceGroups[currentGroup]) ? sourceGroups[currentGroup].filter(i => i.status === 'NEW') : [];
    const allItems = (currentGroup && sourceGroups[currentGroup]) ? sourceGroups[currentGroup] : [];
    Object.keys(loadedContent).forEach(url => {
        const c = loadedContent[url];
        if (c && c.article_id) {
            globalIdMap[c.article_id] = url;
        }
    });

    // Debug: Check Global Map
    console.log(`[Inspector] Global ID Map Size: ${Object.keys(globalIdMap).length}`);

    // V0.9: Article_ID
    const hasArticleIds = results.every(r => r.Article_ID || r.article_id);

    if (!hasArticleIds) {
        if (!confirm(`⚠️ 응답에 Article_ID가 없습니다!\n순서 기반 매칭은 현재 그룹(${currentGroup})에만 적용됩니다.\n계속하시겠습니까?`)) return;
    }

    // [New] Server Cache Search for missing IDs
    if (hasArticleIds) {
        const allArticleIds = results.map(r => r.Article_ID || r.article_id);
        const missingIds = allArticleIds.filter(id => !globalIdMap[id]);

        if (missingIds.length > 0) {
            // ... 서버 검색 로직 유지 ...
            // (필요 시 구현, 일단 생략하거나 기존 로직 활용)
        }
    }

    let successCount = 0;
    let skippedCount = 0;
    let overwriteCount = 0;

    try { // [FIX] Start try-finally block for safe loading state
        showLoading('저장 중...');

        for (let i = 0; i < results.length; i++) {
            const resData = results[i];
            let itemLink = null;
            let url = null;
            let isOverwrite = false;
            let serverCacheData = null;  // 서버에서 찾은 캐시 데이터

            // V0.9: Article_ID, Legacy: article_id
            const articleId = resData.Article_ID || resData.article_id;

            if (hasArticleIds && articleId) {
                // 1. 먼저 로컬 articleIdMap에서 찾기 (현재 프롬프트 그룹 내)
                url = articleIdMap[articleId];

                // 2. 없으면 Global Map에서 찾기 (로드된 전체 컨텐츠)
                if (!url && globalIdMap[articleId]) {
                    url = globalIdMap[articleId];
                    log(`🔍 글로벌 검색 성공: ${articleId}`, 'info');
                }

                // 3. 그래도 없으면 서버 캐시 맵(미구현) 또는 실패
                if (!url && serverCacheMap[articleId]) {
                    url = serverCacheMap[articleId].url;
                    serverCacheData = serverCacheMap[articleId].content;
                    loadedContent[url] = serverCacheData;
                    log(`🔍 서버 캐시 매칭: ${articleId}`, 'info');
                }

                if (!url) {
                    log(`❌ 매칭 실패 (ID 없음): ${articleId}`, 'error');
                    console.warn(`[Match Fail] ID: ${articleId} not found in Local/Global Map`);
                    skippedCount++;
                    continue;
                }

                // [FIX] itemLink 생성 로직 강화
                // allItems(현재 그룹)에 없더라도 URL이 있으면 loadedContent에서 찾아 처리
                itemLink = allItems.find(item => item.url === url);

                if (!itemLink) {
                    const cachedItem = loadedContent[url];
                    if (cachedItem) {
                        itemLink = {
                            url: url,
                            source_id: cachedItem.source_id || 'unknown',
                            status: cachedItem.status || (cachedItem.saved ? 'ACCEPTED' : 'NEW')
                        };
                        isOverwrite = (cachedItem.status === 'ACCEPTED' || cachedItem.saved);
                    } else if (serverCacheData) {
                        itemLink = {
                            url: url,
                            source_id: serverCacheData.source_id || 'unknown',
                            status: serverCacheData.saved ? 'ACCEPTED' : 'NEW'
                        };
                        isOverwrite = serverCacheData.saved;
                    }
                } else {
                    // 현재 그룹에 있는 아이템인 경우 덮어쓰기 여부 확인
                    if (itemLink.status === 'ACCEPTED' || itemLink.status === 'PUBLISHED') {
                        isOverwrite = true;
                    }
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
                // [FIX] Use source_id from matched item if available, fallback to currentGroup (safe now)
                finalDoc.source_id = (itemLink && itemLink.source_id) ? itemLink.source_id : currentGroup;
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

        // [NEW] 처리 결과 요약 알림
        const resultMsg = `분석 완료!\n\n총 ${results.length}개 중 ${successCount}개 저장 성공\n(덮어쓰기: ${overwriteCount}, 건너뜀: ${skippedCount})`;
        alert(resultMsg);

        let logMsg = `배치 완료. ${successCount}/${results.length} 저장`;
        if (overwriteCount > 0) logMsg += ` (덮어쓰기: ${overwriteCount})`;
        if (skippedCount > 0) logMsg += ` (건너뜀: ${skippedCount})`;
        log(logMsg, 'success');

        // [MODIFIED] 서버 리스트 새로고침 (자동 Refresh)
        await loadTargetList();
        // renderGroupList(); // loadTargetList 내부에서 수행됨
        document.getElementById('inputArea').value = '';

        if (currentGroup) {
            generatePromptForGroup(currentGroup);
        }

        saveContentCache();

    } catch (err) {
        console.error(err);
        log(`❌ Global Error: ${err.message}`, 'error');
        alert('오류 발생: ' + err.message);
    } finally {
        hideLoading();
    }
} // End of async processBatch function

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
