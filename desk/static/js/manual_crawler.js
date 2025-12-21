// [JS] manual_crawler.js V3.1
console.log('🚀 [JS] manual_crawler.js Loaded');

// Global state
let currentLinks = [];
let currentLinkIndex = -1;
let currentTargetId = '';
let loadedContents = {}; // url -> content data
let articleIdMap = {};   // articleId -> url (for hash-based matching)

// 실시간 최종 카드 미리보기 업데이트
function updateFinalCardPreview() {
    const url = document.getElementById('url').value;
    const jsonStr = document.getElementById('jsonInput').value;
    const originalTitle = document.getElementById('originalTitle').value;

    if (!jsonStr.trim()) {
        document.getElementById('finalCardPreview').textContent = '평가 JSON을 입력하면 최종 저장될 형태가 여기에 표시됩니다.';
        document.getElementById('cardStatus').textContent = '';
        document.getElementById('jsonSummary').textContent = '평가 JSON을 붙여넣으면 요약이 표시됩니다.';
        return;
    }

    try {
        let jsonData = JSON.parse(jsonStr);
        jsonData = normalizeFieldNames(jsonData);

        // Auto-extract if LLM sent schema format
        if (jsonData.properties && jsonData.type === 'object') {
            jsonData = jsonData.properties;
        }

        // Article ID validation
        const originalData = loadedContents[url] || {};
        const expectedId = originalData.article_id;
        const receivedId = jsonData.article_id;

        if (expectedId && receivedId && expectedId !== receivedId) {
            document.getElementById('cardStatus').textContent = '⚠️ ID 불일치!';
            document.getElementById('cardStatus').style.color = '#dc3545';
            document.getElementById('jsonSummary').textContent = `❌ ID 불일치: 예상 ${expectedId}, 받은 ${receivedId}`;
            document.getElementById('finalCardPreview').textContent = `JSON의 article_id(${receivedId})가 현재 기사(${expectedId})와 일치하지 않습니다.\n\n다른 기사의 결과를 붙여넣은 것 같습니다.`;
            return;
        }

        // Generate final card by merging original content + evaluation
        const finalCard = {
            ...originalData,
            ...jsonData,
            url: url,
            source_id: currentTargetId,
            original_title: originalTitle
        };

        // Remove internal fields
        delete finalCard.article_id;

        document.getElementById('finalCardPreview').textContent = JSON.stringify(finalCard, null, 2);

        // Display ZS and IS prominently
        const zs = finalCard.zero_echo_score;
        const is = finalCard.impact_score;
        const statusText = `ZS: ${zs !== undefined ? zs : '?'} | IS: ${is !== undefined ? is : '?'}`;
        document.getElementById('cardStatus').textContent = statusText;
        document.getElementById('cardStatus').style.color = (zs !== undefined && is !== undefined) ? '#28a745' : '#e0a800';

        // Display summary
        const summary = finalCard.summary || jsonData.summary || '';
        document.getElementById('jsonSummary').textContent = summary || '(summary 없음)';
    } catch (e) {
        document.getElementById('finalCardPreview').textContent = 'JSON 파싱 에러: ' + e.message;
        document.getElementById('cardStatus').textContent = '✗ 에러';
        document.getElementById('cardStatus').style.color = '#dc3545';
    }
}

// 점수 검증 및 자동 반영
function verifyAndApply() {
    const jsonStr = document.getElementById('jsonInput').value;
    if (!jsonStr.trim()) {
        document.getElementById('verifyResult').innerHTML = '평가 JSON을 먼저 입력하세요.';
        return;
    }

    let jsonData = {};
    try {
        jsonData = JSON.parse(jsonStr);
    } catch (e) {
        document.getElementById('verifyResult').innerHTML = '<span style="color:red">Invalid JSON: ' + e.message + '</span>';
        return;
    }

    // Auto-extract if LLM sent schema format
    if (jsonData.properties && jsonData.type === 'object') {
        jsonData = jsonData.properties;
    }

    jsonData = normalizeFieldNames(jsonData);

    const resultDiv = document.getElementById('verifyResult');
    resultDiv.innerHTML = 'Verifying...';

    fetch('/api/verify_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
    })
        .then(res => res.json())
        .then(res => {
            if (res.error) {
                resultDiv.innerHTML = `<span style="color:red">Error: ${res.error}</span>`;
            } else {
                const zsMatch = res.match;
                const zsMatchText = zsMatch ? '✓' : '✗';
                const zsMatchColor = zsMatch ? '#28a745' : '#dc3545';

                const isMatch = res.impact_match;
                const isMatchText = isMatch ? '✓' : '✗';
                const isMatchColor = isMatch ? '#28a745' : '#dc3545';

                let html = `<div style="display:flex; gap:15px; margin-bottom:8px;">`;
                html += `<div><strong>ZS</strong> <span style="color:${zsMatchColor}">${zsMatchText}</span> ${res.calculated_zs}</div>`;
                html += `<div><strong>IS</strong> <span style="color:${isMatchColor}">${isMatchText}</span> ${res.breakdown?.impact_calc || 'N/A'}</div>`;
                html += `</div>`;

                html += `<div style="font-size:0.85em; color:#666;">`;
                html += `기록: ZS=${jsonData.zero_echo_score || 'N/A'} | IS=${jsonData.impact_score || 'N/A'}`;
                html += `</div>`;

                // --- V1.0 Schema Breakdown ---
                if (res.breakdown?.schema === 'V1.0') {
                    html += `<div style="margin-top:10px; font-size:0.8em; background:#fff3cd; padding:8px; border-radius:4px;">`;
                    html += `<strong>📊 V1.0 Schema</strong><br>`;
                    // IS Components
                    const isComp = res.breakdown.is_components || {};
                    const iwAnalysis = isComp.IW_Analysis || {};
                    const ieAnalysis = isComp.IE_Analysis || {};
                    html += `<div style="margin-top:5px;"><b>IS 구성:</b> Tier=${iwAnalysis.Tier_Score || 0}, Gap=${iwAnalysis.Gap_Score || 0}, IW=${iwAnalysis.IW_Total || 0}</div>`;
                    html += `<div><b>IE 구성:</b> Scope=${ieAnalysis.Scope_Total || 0}, Crit=${ieAnalysis.Criticality_Total || 0}, IE=${ieAnalysis.IE_Total || 0}</div>`;
                    // ZES Metrics
                    const zesMetrics = res.breakdown.zes_metrics || {};
                    html += `<div style="margin-top:5px;"><b>ZES 메트릭:</b></div>`;
                    html += `<div>Signal(S): T1=${zesMetrics.Signal?.T1 || 0}, T2=${zesMetrics.Signal?.T2 || 0}, T3=${zesMetrics.Signal?.T3 || 0} → Avg=${zesMetrics.Signal?.S_Avg || 0}</div>`;
                    html += `<div>Noise(N): P1=${zesMetrics.Noise?.P1 || 0}, P2=${zesMetrics.Noise?.P2 || 0}, P3=${zesMetrics.Noise?.P3 || 0} → Avg=${zesMetrics.Noise?.N_Avg || 0}</div>`;
                    html += `<div>Utility(U): V1=${zesMetrics.Utility?.V1 || 0}, V2=${zesMetrics.Utility?.V2 || 0}, V3=${zesMetrics.Utility?.V3 || 0} → Avg=${zesMetrics.Utility?.U_Avg || 0}</div>`;
                    html += `<div>Fine_Adj=${zesMetrics.Fine_Adjustment || 0} → ZS_Raw=${zesMetrics.ZS_Raw || 0}</div>`;
                    html += `</div>`;
                }
                // --- V0.9 Schema Breakdown ---
                else if (res.breakdown?.schema === 'V0.9') {
                    html += `<div style="margin-top:10px; font-size:0.8em; background:#e7f1ff; padding:8px; border-radius:4px;">`;
                    html += `<strong>📊 V0.9 Schema</strong><br>`;
                    // IS Components
                    const isComp = res.breakdown.is_components || {};
                    html += `<div style="margin-top:5px;"><b>IS 구성:</b> IW=${isComp.IW_Score || 0}, Gap=${isComp.Gap_Score || 0}, Ctx=${isComp.Context_Bonus || 0}, Scope=${isComp.Scope_Total || 0}, Crit=${isComp.Criticality_Total || 0}, Adj=${isComp.Adjustment_Score || 0}</div>`;
                    // ZES Vector
                    const zesVec = res.breakdown.zes_vector || {};
                    const posCount = (zesVec.positive || []).length;
                    const negCount = (zesVec.negative || []).length;
                    html += `<div><b>ZES 벡터:</b> Positive(${posCount}), Negative(${negCount})</div>`;
                    html += `</div>`;
                } else if (res.breakdown) {
                    // Legacy Breakdown
                    html += `<div style="margin-top:5px; font-size:0.8em; color:#888;">`;
                    html += `크레딧: -${res.breakdown.credits_sum || 0} | 페널티: +${res.breakdown.penalties_sum || 0}`;
                    html += `</div>`;
                }

                // Auto-apply
                let autoApplied = false;
                if (!zsMatch && res.calculated_zs !== undefined) {
                    jsonData.zero_echo_score = Math.max(0, Math.min(10, res.calculated_zs));
                    autoApplied = true;
                }
                if (!isMatch && res.breakdown?.impact_calc !== undefined) {
                    jsonData.impact_score = Math.max(0, Math.min(10, res.breakdown.impact_calc));
                    autoApplied = true;
                }

                if (autoApplied) {
                    document.getElementById('jsonInput').value = JSON.stringify(jsonData, null, 2);
                    updateFinalCardPreview();
                    html += `<div style="margin-top:5px; color:#e0a800;"><strong>→ 점수 자동 반영!</strong></div>`;
                }

                resultDiv.innerHTML = html;
            }
        })
        .catch(err => {
            resultDiv.innerHTML = `<span style="color:red">Error: ${err}</span>`;
        });
}

// Field name normalization helper
function normalizeFieldNames(data) {
    let normalized = { ...data };

    // --- V1.0.0 Schema: Extract from 'articles' array ---
    if (normalized.articles && Array.isArray(normalized.articles) && normalized.articles.length > 0) {
        const article = normalized.articles[0];
        // Merge article fields into normalized (keeping original fields)
        normalized = { ...normalized, ...article };
        delete normalized.articles;
        console.log(`[Normalize] V1.0.0: Extracted article from 'articles' array: ${article.Article_ID || 'unknown'}`);
    }

    // --- V1.0.0 Schema: Map Meta fields ---
    if (normalized.Meta) {
        const meta = normalized.Meta;
        if (meta.Headline && !normalized.title_ko) {
            normalized.title_ko = meta.Headline;
            console.log(`[Normalize] V1.0.0: Mapped Meta.Headline -> title_ko`);
        }
        if (meta.Summary && !normalized.summary) {
            normalized.summary = meta.Summary;
            console.log(`[Normalize] V1.0.0: Mapped Meta.Summary -> summary`);
        }
    }

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
    initializeDatePicker();
});

// 날짜 선택기 초기화 (오늘 날짜로)
function initializeDatePicker() {
    const dateInput = document.getElementById('dateSelect');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
}

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

// 날짜별 기사 조회
function loadArticlesByDate() {
    const dateInput = document.getElementById('dateSelect');
    const dateStr = dateInput.value;

    if (!dateStr) {
        return alert('날짜를 선택해주세요.');
    }

    const btn = document.querySelector('button[onclick="loadArticlesByDate()"]');
    const originalText = btn.textContent;
    btn.textContent = '로딩 중...';
    btn.disabled = true;

    fetch(`/api/articles_by_date?date=${dateStr}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('오류: ' + data.error);
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            // Clear target selection and reset state
            document.getElementById('targetSelect').value = '';
            currentTargetId = '__DATE__' + dateStr;  // Special marker

            // Convert articles to currentLinks format
            currentLinks = data.articles.map(article => ({
                url: article.url,
                source_id: article.source_id,
                status: article.status,
                cached: true,
                filepath: article.filepath,  // cache file path for direct deletion
                data_file: article.data_file,  // linked data file info
                content: article.content
            }));

            // Also populate loadedContents
            data.articles.forEach(article => {
                loadedContents[article.url] = article.content;
            });

            renderLinks();
            btn.textContent = originalText;
            btn.disabled = false;

            // Show total count
            console.log(`📅 [Date] Loaded ${data.total} articles for ${dateStr}`);
        })
        .catch(err => {
            alert('날짜별 기사 로드 실패: ' + err);
            btn.textContent = originalText;
            btn.disabled = false;
        });
}

// URL로 캐시 준비
function prepareCache() {
    const input = document.getElementById('prepareUrlInput');
    const url = input.value.trim();

    if (!url) {
        return alert('URL을 입력해주세요.');
    }

    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return alert('올바른 URL을 입력해주세요.\n(http:// 또는 https://로 시작해야 합니다)');
    }

    const btn = document.querySelector('button[onclick="prepareCache()"]');
    const originalText = btn.textContent;
    btn.textContent = '크롤링 중...';
    btn.disabled = true;

    fetch(`/api/extract?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
            btn.textContent = originalText;
            btn.disabled = false;

            if (data.error) {
                alert('오류: ' + data.error);
                return;
            }

            // Check if source_id is missing - show modal for selection
            let sourceId = data.source_id;
            if (!sourceId || sourceId.trim() === '') {
                // Show source selection modal
                showSourceModal(url, data);
                return; // Will continue in confirmSourceSelection
            }

            // Complete the cache preparation
            completeCachePrepare(url, data, sourceId);
        })
        .catch(err => {
            btn.textContent = originalText;
            btn.disabled = false;
            alert('캐시 준비 실패: ' + err);
        });
}

// Pending cache data for modal
let pendingCacheUrl = null;
let pendingCacheData = null;

function showSourceModal(url, data) {
    pendingCacheUrl = url;
    pendingCacheData = data;

    // Populate dropdown with sources from targets
    const select = document.getElementById('sourceSelect');
    select.innerHTML = '<option value="">-- 소스 선택 --</option>';

    // Get sources from loaded targets
    fetch('/api/targets')
        .then(res => res.json())
        .then(targets => {
            // Get unique source IDs
            const sources = [...new Set(targets.map(t => t.id))];
            sources.forEach(src => {
                const option = document.createElement('option');
                option.value = src;
                option.textContent = src;
                select.appendChild(option);
            });
            // Add "other" option for manual entry
            const otherOption = document.createElement('option');
            otherOption.value = '__OTHER__';
            otherOption.textContent = '기타 (직접 입력)';
            select.appendChild(otherOption);
        });

    // Show modal
    document.getElementById('sourceModal').style.display = 'flex';
}

function closeSourceModal() {
    document.getElementById('sourceModal').style.display = 'none';
    pendingCacheUrl = null;
    pendingCacheData = null;

    // Reset button
    const btn = document.querySelector('button[onclick="prepareCache()"]');
    if (btn) {
        btn.textContent = '📥 캐시 준비';
        btn.disabled = false;
    }
}

function confirmSourceSelection() {
    const select = document.getElementById('sourceSelect');
    let sourceId = select.value;

    if (!sourceId) {
        alert('소스를 선택해주세요.');
        return;
    }

    // Handle "other" option
    if (sourceId === '__OTHER__') {
        sourceId = prompt('소스 ID를 직접 입력해주세요 (예: naver, daum):');
        if (!sourceId || sourceId.trim() === '') {
            alert('소스 ID가 필요합니다.');
            return;
        }
        sourceId = sourceId.trim().toLowerCase();
    }

    // Close modal
    document.getElementById('sourceModal').style.display = 'none';

    // Update cache with source_id
    pendingCacheData.source_id = sourceId;
    fetch('/api/update_cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pendingCacheUrl, content: { source_id: sourceId } })
    });

    // Complete the preparation
    completeCachePrepare(pendingCacheUrl, pendingCacheData, sourceId);

    pendingCacheUrl = null;
    pendingCacheData = null;
}

function completeCachePrepare(url, data, sourceId) {
    // Reset button
    const btn = document.querySelector('button[onclick="prepareCache()"]');
    if (btn) {
        btn.textContent = '📥 캐시 준비';
        btn.disabled = false;
    }

    // Create item
    const newItem = {
        url: url,
        source_id: sourceId,
        status: 'NEW',
        cached: true,
        content: data
    };

    // Add to beginning of list
    currentLinks.unshift(newItem);
    loadedContents[url] = data;

    // Clear input
    document.getElementById('prepareUrlInput').value = '';

    // Render and select the new item
    renderLinks();
    loadArticle(0);

    console.log(`📥 [Prepare Cache] Success: ${url} (source: ${sourceId})`);
    alert(`캐시 준비 완료!\nSource: ${sourceId}\nTitle: ${data.title || 'N/A'}`);
}

// 캐시 파일 검색
function searchCache() {
    const input = document.getElementById('cacheSearchInput');
    const query = input.value.trim();

    if (!query) {
        return alert('검색어를 입력해주세요.');
    }

    const btn = document.querySelector('button[onclick="searchCache()"]');
    const originalText = btn.textContent;
    btn.textContent = '검색 중...';
    btn.disabled = true;

    fetch(`/api/search_cache?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('오류: ' + data.error);
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            if (data.total === 0) {
                alert(`"${query}"에 대한 검색 결과가 없습니다.`);
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            // Display results in link list
            currentTargetId = '__SEARCH__' + query;
            currentLinks = data.results.map(item => ({
                url: item.url || item.path,
                source_id: 'cache',
                status: 'CACHE',
                cached: true,
                filename: item.filename,
                date: item.date
            }));

            renderSearchResults(data.results);
            btn.textContent = originalText;
            btn.disabled = false;

            console.log(`🔍 [Search] Found ${data.total} files for "${query}"`);
        })
        .catch(err => {
            alert('검색 실패: ' + err);
            btn.textContent = originalText;
            btn.disabled = false;
        });
}

// 검색 결과 렌더링 (파일명 중심)
function renderSearchResults(results) {
    const list = document.getElementById('link-list');
    list.innerHTML = '';

    results.forEach((item, index) => {
        const li = document.createElement('li');

        // X 버튼 (캐시 삭제)
        const deleteBtn = `<button onclick="event.stopPropagation(); deleteCacheFile('${item.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${index})" style="background:#dc3545; color:white; border:none; padding:1px 4px; border-radius:3px; font-size:0.6em; margin-right:3px; cursor:pointer;" title="캐시 삭제">✕</button>`;

        // 연결된 data 파일 표시 (있으면 녹색 마크)
        const dataFileMark = item.data_file
            ? `<span style="background:#28a745; color:white; padding:2px 4px; border-radius:3px; font-size:0.6em; margin-right:3px;" title="저장됨: ${item.data_file.filename}">DATA</span>`
            : '';

        li.innerHTML = `
            ${deleteBtn}
            <span style="background:#e83e8c; color:white; padding:2px 6px; border-radius:3px; font-size:0.65em; margin-right:3px;">${item.date}</span>
            ${dataFileMark}
            <span style="word-break:break-all; font-size:0.85em;">${item.filename}</span>
        `;
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.cursor = 'pointer';

        li.onclick = () => {
            // Load the cache file content
            currentLinkIndex = index;
            // Highlight active
            document.querySelectorAll('#link-list li').forEach(l => l.classList.remove('active'));
            li.classList.add('active');

            // Show file info including linked data file
            const dataInfo = item.data_file
                ? `\n\n📁 [연결된 Data 파일]\n파일명: ${item.data_file.filename}\n날짜: ${item.data_file.date}`
                : '\n\n(저장된 Data 파일 없음)';

            document.getElementById('url').value = item.path || item.url || '';
            document.getElementById('previewPane').innerHTML = `
                <h2>${item.title || item.filename}</h2>
                <hr>
                <pre>📦 [캐시 파일]
파일명: ${item.filename}
날짜: ${item.date}
URL: ${item.url || 'N/A'}
Article ID: ${item.article_id || 'N/A'}${dataInfo}</pre>
            `;
        };

        list.appendChild(li);
    });
}

// 캐시 파일 정리 (기초 정보만 유지, 본문 등 제거)
function deleteCacheFile(filepath, index) {
    if (!confirm(`캐시를 정리하시겠습니까?\n(기초 정보만 남기고 본문/제목 등 제거)\n${filepath}`)) return;

    fetch('/api/cleanup_cache_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: filepath })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                // Update visual to show cleaned status
                const listItems = document.querySelectorAll('#link-list li');
                if (listItems[index]) {
                    listItems[index].style.opacity = '0.5';
                    listItems[index].style.textDecoration = 'line-through';
                }
                console.log('[Cache Cleanup] Success:', filepath);
            } else {
                alert('Error: ' + res.error);
            }
        })
        .catch(err => alert('Error cleaning cache: ' + err));
}

// 중복 캐시 찾기
function findDuplicateCaches() {
    const btn = document.querySelector('button[onclick="findDuplicateCaches()"]');
    const originalText = btn.textContent;
    btn.textContent = '검색 중...';
    btn.disabled = true;

    fetch('/api/find_duplicate_caches')
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('오류: ' + data.error);
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            if (data.total_duplicate_urls === 0) {
                alert('중복 캐시가 없습니다! ✅');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }

            // Show duplicates and ask if user wants to clean up
            const msg = `중복 URL: ${data.total_duplicate_urls}개\n삭제 가능한 파일: ${data.total_duplicate_files}개\n\n정리하시겠습니까? (최신 파일만 유지)`;

            if (confirm(msg)) {
                cleanupDuplicateCaches();
            }

            btn.textContent = originalText;
            btn.disabled = false;
        })
        .catch(err => {
            alert('중복 검색 실패: ' + err);
            btn.textContent = originalText;
            btn.disabled = false;
        });
}

// 중복 캐시 정리 (최신 유지, 나머지 삭제)
function cleanupDuplicateCaches() {
    fetch('/api/cleanup_duplicate_caches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                alert(`✅ ${res.deleted_count}개의 중복 캐시 파일을 삭제했습니다.`);
            } else {
                alert('Error: ' + res.error);
            }
        })
        .catch(err => alert('정리 실패: ' + err));
}

// 중복 데이터 찾기 (Processed Articles)
function findDuplicateData() {
    const btn = document.querySelector('button[onclick="findDuplicateData()"]');
    // If button not found (e.g. if we haven't added it to HTML yet), safe fail or just skip UI update
    const originalText = btn ? btn.textContent : '중복 데이터';
    if (btn) {
        btn.textContent = '검색 중...';
        btn.disabled = true;
    }

    fetch('/api/find_duplicate_data')
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('오류: ' + data.error);
                if (btn) {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
                return;
            }

            if (data.total_duplicate_urls === 0) {
                alert('중복 데이터가 없습니다! ✅');
                if (btn) {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
                return;
            }

            // Show duplicates and ask if user wants to clean up
            const msg = `중복 데이터 URL: ${data.total_duplicate_urls}개\n삭제 가능한 파일: ${data.total_duplicate_files}개\n\n정리하시겠습니까? (최신 파일만 유지)`;

            if (confirm(msg)) {
                cleanupDuplicateData();
            }

            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        })
        .catch(err => {
            alert('중복 데이터 검색 실패: ' + err);
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
}

// 중복 데이터 정리
function cleanupDuplicateData() {
    fetch('/api/cleanup_duplicate_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                alert(`✅ ${res.deleted_count}개의 중복 데이터 파일을 삭제했습니다.\n(Manifest 자동 업데이트됨)`);
            } else {
                alert('Error: ' + res.error);
            }
        })
        .catch(err => alert('데이터 정리 실패: ' + err));
}

// 미연결 DATA 파일 찾기 (캐시에서 참조되지 않는 파일)
function findOrphanDataFiles() {
    const btn = document.querySelector('button[onclick="findOrphanDataFiles()"]');
    const originalText = btn.textContent;
    btn.textContent = '검색 중...';
    btn.disabled = true;

    fetch('/api/find_orphan_data_files')
        .then(res => res.json())
        .then(data => {
            btn.textContent = originalText;
            btn.disabled = false;

            if (data.error) {
                alert('오류: ' + data.error);
                return;
            }

            if (data.total === 0) {
                alert(`✅ 모든 DATA 파일이 캐시에서 참조되고 있습니다.\n(캐시 URL: ${data.cached_urls_count}개)`);
                return;
            }

            // Show orphan files and ask if user wants to clean up
            let fileList = data.orphan_files.slice(0, 10).map(f =>
                `📄 ${f.filename} (${f.date})\n   ${f.title || 'No title'}`
            ).join('\n');

            if (data.total > 10) {
                fileList += `\n... 외 ${data.total - 10}개`;
            }

            const msg = `🧹 데이터 정리\n\n미연결 DATA 파일: ${data.total}개\n(캐시에서 참조되지 않는 파일)\n\n${fileList}\n\n삭제하시겠습니까?`;

            if (confirm(msg)) {
                cleanupOrphanDataFiles();
            }
        })
        .catch(err => {
            btn.textContent = originalText;
            btn.disabled = false;
            alert('검색 실패: ' + err);
        });
}

// 미연결 DATA 파일 삭제
function cleanupOrphanDataFiles() {
    fetch('/api/cleanup_orphan_data_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                alert(`✅ ${res.deleted_count}개의 미연결 DATA 파일을 삭제했습니다.\n(daily_summary 자동 업데이트됨)`);
            } else {
                alert('Error: ' + res.error);
            }
        })
        .catch(err => alert('정리 실패: ' + err));
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

            // Pre-load cached content into loadedContents
            currentLinks.forEach(item => {
                if (item.content) {
                    loadedContents[item.url] = item.content;
                }
            });

            renderLinks();
            btn.textContent = '링크 가져오기';
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

        // 상태 마크: 없음 → CACHE(article_id 있음) → JSON(score 있음) → OK(저장완료)
        let stateMark = '';
        const content = item.content || loadedContents[item.url];

        if (item.status === 'ACCEPTED') {
            // 이미 저장 완료됨
            stateMark = '<span style="background:#28a745; color:white; padding:2px 6px; border-radius:3px; font-size:0.65em; margin-right:3px;">OK</span>';
        } else if (content && content.zero_echo_score !== undefined) {
            // JSON 평가 결과가 있음
            stateMark = '<span style="background:#6610f2; color:white; padding:2px 6px; border-radius:3px; font-size:0.65em; margin-right:3px;">JSON</span>';
        } else if (content && content.article_id) {
            // article_id가 있어야 CACHE (제대로 생성된 캐시)
            stateMark = '<span style="background:#17a2b8; color:white; padding:2px 6px; border-radius:3px; font-size:0.65em; margin-right:3px;">CACHE</span>';
        }
        // article_id 없으면 마크 없음 (미생성)

        // Data file link mark (shows if cache is linked to saved data file)
        let dataFileMark = '';
        if (item.data_file) {
            dataFileMark = `<span style="background:#28a745; color:white; padding:2px 4px; border-radius:3px; font-size:0.6em; margin-right:3px;" title="저장됨: ${item.data_file.filename}">DATA</span>`;
        }

        // Reset button (only show if content exists)
        let resetBtn = '';
        if (content || item.cached) {
            resetBtn = `<button onclick="event.stopPropagation(); resetCache(${index})" style="background:#dc3545; color:white; border:none; padding:1px 4px; border-radius:3px; font-size:0.6em; margin-right:3px; cursor:pointer;" title="캐시 삭제">✕</button>`;
        }

        li.innerHTML = `${badge}${stateMark}${dataFileMark}${resetBtn}<span style="word-break:break-all;">${item.url}</span>`;
        li.className = statusClass;
        li.style.display = 'flex';
        li.style.alignItems = 'center';

        li.onclick = () => loadArticle(index);
        if (index === currentLinkIndex) li.classList.add('active');
        list.appendChild(li);
    });
}

// Reset cache for a specific article (cleanup, not delete)
function resetCache(index) {
    const item = currentLinks[index];
    if (!item) return;

    const displayPath = item.filepath || item.url;
    if (!confirm(`캐시를 정리하시겠습니까?\n(기초 정보만 남기고 본문/제목 등 제거)\n${displayPath}`)) return;

    // If filepath exists, use cleanup API (keeps url, article_id, cached_at)
    if (item.filepath) {
        fetch('/api/cleanup_cache_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: item.filepath })
        })
            .then(res => res.json())
            .then(res => {
                if (res.status === 'success') {
                    // Update local state - mark as cleaned
                    delete loadedContents[item.url];
                    item.content = null;
                    item.status = 'CLEANED';
                    renderLinks();
                    console.log('[Cache Cleanup] Success:', item.filepath);
                } else {
                    alert('Error: ' + res.error);
                }
            })
            .catch(err => alert('Error cleaning cache: ' + err));
    } else {
        // Fallback: URL-based cleanup (searches all date folders)
        fetch('/api/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url })
        })
            .then(res => res.json())
            .then(res => {
                if (res.status === 'success') {
                    delete loadedContents[item.url];
                    item.cached = false;
                    item.status = 'NEW';
                    renderLinks();
                    console.log('[Cache Reset] Success (url):', item.url);
                } else {
                    alert('Error: ' + res.error);
                }
            })
            .catch(err => alert('Error resetting cache: ' + err));
    }
}

function loadArticle(index) {
    currentLinkIndex = index;
    renderLinks(); // Update active state

    const item = currentLinks[index];
    const link = item.url;
    document.getElementById('url').value = link;

    // Clear ALL display items when switching articles
    document.getElementById('originalTitle').value = 'Loading...';
    document.getElementById('jsonInput').value = '';
    document.getElementById('previewPane').innerHTML = '<div style="text-align:center; margin-top:50px;">Loading content...</div>';
    document.getElementById('jsonSummary').textContent = '로딩 중...';
    document.getElementById('verifyResult').innerHTML = '점수 검증 버튼을 누르면 결과가 표시됩니다.';
    document.getElementById('finalCardPreview').textContent = '평가 JSON을 입력하면 최종 저장될 형태가 여기에 표시됩니다.';
    document.getElementById('cardStatus').textContent = '';

    // Helper to render
    const render = (data) => {
        document.getElementById('originalTitle').value = data.title || data.original_title || '';

        // Update original link
        document.getElementById('originalLink').href = link;

        // Check if it's existing data (has source_id or scores) OR modified batch data
        if ((data.source_id && data.zero_echo_score !== undefined) || data.zero_echo_score !== undefined) {
            document.getElementById('jsonInput').value = JSON.stringify(data, null, 2);
            document.getElementById('jsonSummary').textContent = data.summary || '(summary 없음)';
            updateFinalCardPreview();
            verifyAndApply();
        } else {
            document.getElementById('jsonInput').value = '';
            document.getElementById('jsonSummary').textContent = '평가 JSON을 붙여넣으면 요약이 표시됩니다.';
            document.getElementById('verifyResult').innerHTML = '점수 검증 버튼을 누르면 결과가 표시됩니다.';
            document.getElementById('finalCardPreview').textContent = '평가 JSON을 입력하면 최종 저장될 형태가 여기에 표시됩니다.';
            document.getElementById('cardStatus').textContent = '';
        }

        // Render preview (simplified for new UI)
        document.getElementById('previewPane').innerHTML = `
            <h2>${data.title || data.title_ko || 'No Title'}</h2>
            <hr>
            <pre id="articleBody">${data.text || data.summary || 'No text content'}</pre>
        `;
    };

    // Check Cache First
    if (loadedContents[link]) {
        render(loadedContents[link]);
        return;
    }

    // Fallback to fetch (this will also save to server cache)
    fetch(`/api/extract?url=${encodeURIComponent(link)}`)
        .then(res => res.json())
        .then(data => {
            loadedContents[link] = data;

            // Update cached flag so CACHE mark shows immediately
            if (currentLinks[currentLinkIndex]) {
                currentLinks[currentLinkIndex].cached = true;
            }
            renderLinks();

            render(data);
        })
        .catch(err => {
            document.getElementById('previewPane').innerHTML = `<div style="color:red">Error loading content: ${err}</div>`;
        });
}

function copyContent() {
    const title = document.querySelector('#previewPane h2').innerText;
    const body = document.getElementById('articleBody').innerText;
    const url = document.getElementById('url').value;

    // Use article_id from cache, or generate from URL hash
    const item = currentLinks[currentLinkIndex];
    const data = item?.content || loadedContents[url];
    const articleId = data?.article_id || getArticleIdFromUrl(url);
    articleIdMap[articleId] = url;

    const content = `--- Article : ${currentLinkIndex + 1}
---article_id : ${articleId}
---Title: ${title}
---Body:
${body}

---`;

    navigator.clipboard.writeText(content).then(() => {
        const btn = document.querySelector('.center-top button');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => btn.textContent = originalText, 1500);
        }
    }).catch(err => {
        alert('Failed to copy: ' + err);
    });
}

function saveArticle() {
    const jsonStr = document.getElementById('jsonInput').value;
    let jsonData = {};

    try {
        // [Unified Parsing] Use normalizeStructToBatch to handle Single/Batch/V1.0/Legacy formats
        const batchData = normalizeStructToBatch(jsonStr);
        if (batchData.length === 0) {
            return alert('JSON에 기사 데이터가 없습니다.');
        }
        // For Single Save, we take the first item
        jsonData = batchData[0];
        console.log('[SaveArticle] Extracted first item from batch/input:', jsonData);
    } catch (e) {
        return alert('Invalid JSON: ' + e.message);
    }

    // [IMPORTANT] Normalize V1.0.0 schema to standard format (Field Mapping)
    // normalizeStructToBatch handles structure, normalizeFieldNames handles keys
    console.log('[SaveArticle] Before normalize fields:', JSON.stringify(jsonData).substring(0, 200));
    jsonData = normalizeFieldNames(jsonData);
    console.log('[SaveArticle] After normalize fields - title_ko:', jsonData.title_ko);
    console.log('[SaveArticle] After normalize fields - summary:', jsonData.summary?.substring(0, 50));

    // Get source_id from multiple sources with fallback
    const url = document.getElementById('url').value;
    const cached = loadedContents[url] || {};
    const currentItem = currentLinks[currentLinkIndex] || {};
    const sourceId = cached.source_id || currentItem.source_id || currentTargetId || '';

    if (!sourceId) {
        return alert('Source ID가 없습니다. 소스를 먼저 선택해주세요.');
    }

    const data = {
        ...jsonData,
        url: url,
        source_id: sourceId,
        original_title: document.getElementById('originalTitle').value
    };

    console.log('[SaveArticle] Final data - title_ko:', data.title_ko);
    console.log('[SaveArticle] Final data - summary:', data.summary?.substring(0, 50));

    if (!data.title_ko || !data.summary) {
        console.error('[SaveArticle] Missing required fields!', { title_ko: data.title_ko, summary: data.summary });
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
                // [NEW] Update cache with saved data + saved status + data_file info
                const savedData = {
                    ...data,
                    saved: true,
                    saved_at: new Date().toISOString(),
                    data_file: res.data_file  // Include the saved data file info
                };
                fetch('/api/update_cache', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: data.url, content: savedData })
                }).catch(err => console.warn('[Cache Update] Failed:', err));

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

    // Auto-extract if LLM sent schema format with properties containing actual values
    if (jsonData.properties && jsonData.type === 'object') {
        console.log('[verifyScore] Detected schema format, extracting properties values...');
        jsonData = jsonData.properties;
    }

    // Normalize field names (handle case variations like zero_Echo_score, Zero_echo_score, etc.)
    jsonData = normalizeFieldNames(jsonData);
    // Update the input with normalized data (cleaned format)
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

function refreshArticle() {
    const url = document.getElementById('url').value;
    if (!url) return alert('No article loaded');

    if (!confirm('🔄 이 기사의 분석 결과를 소거하고 NEW 상태로 되돌리시겠습니까?\\n(캐시 및 히스토리가 삭제됩니다)')) {
        return;
    }

    fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                // Clear local state
                delete loadedContents[url];

                // Reset status to NEW
                if (currentLinks[currentLinkIndex]) {
                    currentLinks[currentLinkIndex].status = 'NEW';
                }

                // Clear UI
                document.getElementById('jsonInput').value = '';
                document.getElementById('verifyResult').style.display = 'none';

                renderLinks();
                alert('✅ 리프레시 완료! 기사가 NEW 상태로 되돌려졌습니다.');

                // Reload article to get fresh content
                loadArticle(currentLinkIndex);
            } else {
                alert('Error: ' + res.error);
            }
        })
        .catch(err => alert('Error: ' + err));
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

// Generate article ID from URL hash (consistent for same URL)
function getArticleIdFromUrl(url) {
    // Simple hash function to match Python's get_url_hash
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 6);
}

function copyAllForPrompt() {
    const keys = Object.keys(loadedContents);
    if (keys.length === 0) return alert('먼저 "일괄 로드"를 실행하세요!');

    // Reset article ID map for this batch
    articleIdMap = {};

    // Build JSON array for V0.9 Input Format
    const inputArray = [];

    currentLinks.forEach((linkItem, index) => {
        const data = loadedContents[linkItem.url];
        if (!data) return;

        const title = data.title || data.title_ko || 'No Title';
        const body = data.text || data.summary || '';

        // Use article_id from cache, or generate from URL hash
        const articleId = data.article_id || getArticleIdFromUrl(linkItem.url);
        articleIdMap[articleId] = linkItem.url;

        inputArray.push({
            "Article_ID": articleId,
            "Title": title,
            "Body": body
        });
    });

    // Format as JSON string
    const jsonStr = JSON.stringify(inputArray, null, 2);

    navigator.clipboard.writeText(jsonStr).then(() => {
        alert(`✅ V0.9 포맷으로 ${inputArray.length}개 기사 입력 JSON을 클립보드에 복사했습니다!`);
    }).catch(err => alert('복사 실패: ' + err));
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

    // V0.9 uses "Article_ID", Legacy uses "article_id"
    const hasArticleIds = results.every(r => r.Article_ID || r.article_id);

    if (!hasArticleIds) {
        if (results.length !== currentLinks.length) {
            if (!confirm(`⚠️ Article_ID가 없어 순서 기반 매칭을 사용합니다.\nLinks: ${currentLinks.length}\nResults: ${results.length}\n\n계속하시겠습니까?`)) {
                return;
            }
        }
    }

    let updatedCount = 0;
    let skippedCount = 0;

    results.forEach((resItem, index) => {
        let url = null;
        // V0.9: Article_ID, Legacy: article_id
        const articleId = resItem.Article_ID || resItem.article_id;

        if (hasArticleIds && articleId) {
            url = articleIdMap[articleId];
            if (!url) {
                console.warn(`Unknown Article_ID: ${articleId}`);
                skippedCount++;
                return;
            }
        } else {
            if (index >= currentLinks.length) return;
            url = currentLinks[index].url;
        }

        if (!loadedContents[url]) loadedContents[url] = { url: url };

        // --- V0.9 Schema Handling ---
        let processedData = {};

        // Meta (title_ko, summary, tags)
        if (resItem.Meta) {
            processedData.title_ko = resItem.Meta.Headline || resItem.Meta.title_ko;
            processedData.summary = resItem.Meta.summary;
            processedData.tags = resItem.Meta.Tag || resItem.Meta.tags || [];
        }

        // Impact Score (IS) Calculation from Impact_Analysis_IS
        if (resItem.Impact_Analysis_IS && resItem.Impact_Analysis_IS.Scores) {
            const scores = resItem.Impact_Analysis_IS.Scores;
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
            processedData.impact_evidence = resItem.Impact_Analysis_IS; // Store full struct for verification
        } else if (resItem.impact_score !== undefined) {
            processedData.impact_score = parseFloat(resItem.impact_score);
        }

        // Zero Echo Score (ZES) Calculation from Evidence_Analysis_ZES (Base 5.0)
        // Formula: ZES = 5 - (Positive + Negative)
        if (resItem.Evidence_Analysis_ZES && resItem.Evidence_Analysis_ZES.ZES_Score_Vector) {
            const vector = resItem.Evidence_Analysis_ZES.ZES_Score_Vector;
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
            processedData.evidence = resItem.Evidence_Analysis_ZES;
        } else if (resItem.zero_echo_score !== undefined) {
            processedData.zero_echo_score = parseFloat(resItem.zero_echo_score);
        }

        // Legacy flat fields fallback (if V0.9 structures not present)
        if (!processedData.title_ko && resItem.title_ko) processedData.title_ko = resItem.title_ko;
        if (!processedData.summary && resItem.summary) processedData.summary = resItem.summary;
        if (!processedData.tags && resItem.tags) processedData.tags = resItem.tags;

        // Store raw analysis for potential re-verification
        processedData.raw_analysis = resItem;

        // Merge into loaded content
        Object.assign(loadedContents[url], processedData);

        // Update server cache
        fetch('/api/update_cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url, content: loadedContents[url] })
        }).catch(err => console.warn('[Cache Update] Failed:', err));

        updatedCount++;
    });

    let message = `✅ ${updatedCount}개 기사에 결과를 적용했습니다.`;
    if (skippedCount > 0) message += `\n⚠️ ${skippedCount}개 건너뜀 (알 수 없는 Article_ID).`;
    message += `\n각 기사를 검토하고 '저장'을 클릭하세요.`;
    alert(message);
    closeBatchModal();
    renderLinks(); // Refresh link list to show updated status

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

// 일괄 로드만 (프롬프트 복사 없이)
function batchLoadOnly() {
    if (currentLinks.length === 0) return alert('링크를 먼저 가져오세요.');

    const uncached = currentLinks.filter(item => !item.cached && !loadedContents[item.url]);
    if (uncached.length === 0) {
        return alert('모든 링크가 이미 캐시되어 있습니다.');
    }

    if (!confirm(`${uncached.length}개 링크를 일괄 로드하시겠습니까?`)) return;

    const urls = uncached.map(item => item.url);

    fetch('/api/extract_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urls })
    })
        .then(res => res.json())
        .then(results => {
            if (!Array.isArray(results)) {
                return alert('Error: ' + (results.error || 'Unknown error'));
            }

            results.forEach(data => {
                loadedContents[data.url] = data;
                // Update cached flag
                const item = currentLinks.find(l => l.url === data.url);
                if (item) {
                    item.cached = true;
                    item.content = data;
                }
            });

            renderLinks();
            alert(`✅ ${results.length}개 링크 일괄 로드 완료!`);
        })
        .catch(err => alert('Error: ' + err));
}

// 로드 & 프롬프트 복사
function loadAndCopy() {
    if (currentLinks.length === 0) return alert('링크를 먼저 가져오세요.');

    const uncached = currentLinks.filter(item => !item.cached && !loadedContents[item.url]);
    const urls = uncached.map(item => item.url);

    // If all cached, build prompt from cache
    const buildPrompt = () => {
        articleIdMap = {}; // Reset
        let bodyText = '';

        currentLinks.forEach((item, idx) => {
            const data = item.content || loadedContents[item.url];
            if (!data) return;

            const title = data.title || data.title_ko || 'No Title';
            const body = data.text || data.summary || '';
            // Use article_id from cache, or generate from URL hash
            const articleId = data.article_id || getArticleIdFromUrl(item.url);
            articleIdMap[articleId] = item.url;

            bodyText += `--- Article : ${idx + 1}\n`;
            bodyText += `---article_id : ${articleId}\n`;
            bodyText += `---Title: ${title}\n`;
            bodyText += `---Body:\n${body}\n\n---\n\n`;
        });

        navigator.clipboard.writeText(bodyText).then(() => {
            alert(`✅ ${currentLinks.length}개 기사 프롬프트 복사 완료!`);
        });
    };

    if (urls.length === 0) {
        // All cached, just copy
        buildPrompt();
        return;
    }

    // Need to load first
    fetch('/api/extract_batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urls })
    })
        .then(res => res.json())
        .then(results => {
            if (!Array.isArray(results)) {
                return alert('Error: ' + (results.error || 'Unknown error'));
            }

            results.forEach(data => {
                loadedContents[data.url] = data;
                const item = currentLinks.find(l => l.url === data.url);
                if (item) {
                    item.cached = true;
                    item.content = data;
                }
            });

            renderLinks();
            buildPrompt();
        })
        .catch(err => alert('Error: ' + err));
}

// ==============================================================================
// 🤖 자동화 파이프라인 함수
// ==============================================================================

const STEP_NAMES = {
    'collect': '1️⃣ 링크 수집',
    'extract': '2️⃣ 콘텐츠 추출',
    'analyze': '3️⃣ MLL 분석',
    'stage': '4️⃣ 조판',
    'publish': '5️⃣ 발행',
    'all': '⚡ ALL (1~4)'
};

async function runAuto(step) {
    const stepName = STEP_NAMES[step] || step;

    // 발행은 확인 필요
    if (step === 'publish') {
        if (!confirm(`⚠️ 발행을 진행하시겠습니까?\n\nStaging의 기사가 실제 프로덕션에 배포됩니다.`)) {
            return;
        }
    }


    // 버튼 비활성화
    const buttons = document.querySelectorAll('.target-select button');
    buttons.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch(`/api/automation/${step}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            // 결과 요약 표시
            let summary = `✅ ${stepName} 완료!\n\n${result.message}`;

            // ALL인 경우 상세 결과 표시
            if (step === 'all' && result.results) {
                summary += '\n\n--- 상세 ---';
                for (const [key, val] of Object.entries(result.results)) {
                    summary += `\n${STEP_NAMES[key] || key}: ${val.message || 'OK'}`;
                }
            }

            alert(summary);
        } else {
            alert(`❌ ${stepName} 실패\n\n${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    } finally {
        // 버튼 다시 활성화
        buttons.forEach(btn => btn.disabled = false);
    }
}

function openStaging() {
    window.open('/staging', '_blank');
}


// ==============================================================================
// ⚡ Hybrid Batch Processing Logic
// ==============================================================================

function openHybridBatchModal() {
    document.getElementById('hybridBatchModal').style.display = 'flex';
    fetchReadyBatches();
}

function closeHybridBatchModal() {
    document.getElementById('hybridBatchModal').style.display = 'none';
}

// 1. Fetch & Render Batch List
function fetchReadyBatches() {
    const list = document.getElementById('batchList');
    list.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">로딩 중...</div>';

    fetch('/api/batch/list_ready')
        .then(res => res.json())
        .then(data => {
            if (data.error) return list.innerHTML = `Error: ${data.error}`;

            if (!data.batches || data.batches.length === 0) {
                list.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">준비된 번들이 없습니다.<br><small>scripts/prepare_daily_batch.py를 실행하세요.</small></div>';
                return;
            }

            list.innerHTML = '';
            data.batches.forEach(batch => {
                const div = document.createElement('div');
                div.style.padding = '10px';
                div.style.borderBottom = '1px solid #eee';
                div.style.cursor = 'pointer';
                div.style.background = '#fff';
                div.style.marginBottom = '5px';
                div.style.borderRadius = '4px';
                div.style.transition = 'background 0.2s';

                div.onmouseover = () => div.style.background = '#e3f2fd';
                div.onmouseout = () => div.style.background = '#fff';
                div.onclick = () => loadBatchContent(batch);

                div.innerHTML = `
                    <div style="font-weight: bold; color: #333;">${batch.date} | ${batch.target_id}</div>
                    <div style="font-size: 0.8em; color: #666; margin-top: 3px;">
                        📄 기사 ${batch.count || '?'}건 | 💾 ${(batch.size / 1024).toFixed(1)} KB
                    </div>
                `;
                list.appendChild(div);
            });
        })
        .catch(err => list.innerHTML = `Error: ${err}`);
}

// 2. Load Selected Batch Content (Export)
let currentBatchFilename = null;

function loadBatchContent(batch) {
    currentBatchFilename = batch.filename;
    document.getElementById('selectedBatchName').textContent = `${batch.date} - ${batch.target_id} (${batch.count}건)`;
    document.getElementById('batchExportContent').value = 'Loading...';

    fetch(`/api/batch/get_content?filename=${batch.filename}`)
        .then(res => res.json())
        .then(data => {
            // We want to format this for the LLM Prompt.
            // Ideally, we provide a structured format.
            // The file saved by script is { target_id, date, articles: [...] }
            // We should extract articles list and clean it up for prompt.

            if (data.articles) {
                // Simplified prompt format
                const promptData = data.articles.map(a => ({
                    id: a.article_id, // Use real ID to avoid ambiguity, or Use loop index 'id' if consistent
                    // User requested "shortening manual work".
                    // If we use article_id (6 chars) it is fine.
                    // Let's use the one saved in file.
                    article_id: a.article_id,
                    content: a.content // Already capped at 3000 chars in script
                }));

                // Pretty print the articles list
                document.getElementById('batchExportContent').value = JSON.stringify(promptData, null, 2);
            } else {
                document.getElementById('batchExportContent').value = JSON.stringify(data, null, 2);
            }
        })
        .catch(err => {
            document.getElementById('batchExportContent').value = 'Error: ' + err;
        });
}

// 3. Copy to Clipboard
function copyBatchExport() {
    const textarea = document.getElementById('batchExportContent');
    if (!textarea.value) return;

    textarea.select();
    document.execCommand('copy');

    const btn = document.querySelector('button[onclick="copyBatchExport()"]');
    const originalText = btn.textContent;
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = originalText, 2000);
}

// Helper: Normalize any input JSON structure to an Array of Articles
function normalizeStructToBatch(jsonStr) {
    let jsonData;
    try {
        // If already an object/array, use it. If string, parse it.
        if (typeof jsonStr === 'string') {
            jsonData = JSON.parse(jsonStr);
        } else {
            jsonData = jsonStr;
        }

        console.log('[NormalizeBatch] Parsed Keys:', Object.keys(jsonData));

        // 1. Priority: V1.0.0 Standard { articles: [...] }
        if (jsonData.articles && Array.isArray(jsonData.articles)) {
            console.log(`[NormalizeBatch] Detected V1.0 'articles' array (${jsonData.articles.length} items)`);
            return jsonData.articles;
        }
        // 2. Legacy/Alternative { results: [...] }
        else if (jsonData.results && Array.isArray(jsonData.results)) {
            console.log(`[NormalizeBatch] Detected Legacy 'results' array (${jsonData.results.length} items)`);
            return jsonData.results;
        }
        // 3. Direct Array [...]
        else if (Array.isArray(jsonData)) {
            console.log(`[NormalizeBatch] Detected Direct Array (${jsonData.length} items)`);
            return jsonData;
        }
        // 4. Single Object -> Wrap in Array
        else if (typeof jsonData === 'object' && jsonData !== null) {
            console.log('[NormalizeBatch] Detected Single Object -> Wrapped in Array');
            return [jsonData];
        }
        else {
            throw new Error(`Unknown structure. Keys: ${Object.keys(jsonData).join(', ')}`);
        }
    } catch (e) {
        throw new Error('JSON Parse/Normalize Error: ' + e.message);
    }
}

// 4. Process Injection
function processBatchInjection() {

    const input = document.getElementById('batchImportContent');
    const status = document.getElementById('importStatus');
    const jsonStr = input.value.trim();

    if (!jsonStr) {
        alert('LLM 결과를 붙여넣어주세요.');
        return;
    }

    let batchData;
    try {
        batchData = normalizeStructToBatch(jsonStr);
    } catch (e) {
        console.error(e);
        alert(e.message);
        return;
    }

    status.textContent = `처리 중... (${batchData.length}건)`;

    fetch('/api/batch/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData)
    })
        .then(res => res.json())
        .then(res => {
            if (res.error) {
                status.textContent = '오류 발생.';
                alert('오류: ' + res.error);
            } else {
                status.textContent = `완료! (성공: ${res.accepted}건)`;
                alert(`✅ 배치 처리 완료!\n\n총 처리: ${res.processed}건\n승인(Saved): ${res.accepted}건\n오류: ${res.errors.length}건`);
                if (res.errors.length > 0) {
                    console.error('Batch Errors:', res.errors);
                    alert('일부 항목 오류 발생 (콘솔 확인)');
                }
                closeHybridBatchModal();
                loadArticlesByDate();
            }
        })
        .catch(err => {
            status.textContent = '통신 오류.';
            alert('통신 오류: ' + err);
        });
}


// ==============================================================================
// 🏭 Batch Management (Typesetting)
// ==============================================================================

function createBatch() {
    if (!confirm('현재 대기 중인(ACCEPTED) 모든 기사로 새로운 1판(Batch)을 조판하시겠습니까?')) {
        return;
    }

    fetch('/api/batch/create', { method: 'POST' })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                alert(`✅ 조판 완료! Batch ID: ${res.batch_id}\n${res.message}`);
                // Open manager to see the new batch
                openBatchManager();
            } else {
                alert('❌ 조판 실패: ' + res.error);
            }
        })
        .catch(err => alert('Error: ' + err));
}

function openBatchManager() {
    // Reuse Hybrid Modal for now, but repurpose it
    const modal = document.getElementById('hybridBatchModal');
    modal.style.display = 'flex';

    // Change Title
    modal.querySelector('h3').textContent = '⚡ 조판 관리자 (Batch Manager)';

    // Hide classic columns and show simple list for now?
    // Or just put the manager in the 'Left Panel' and details in 'Center'?

    // Let's use the layout: Left=List, Center=Details

    const list = document.getElementById('batchList');
    const exportArea = document.getElementById('batchExportContent');
    const importArea = document.getElementById('batchImportContent');
    const centerPanel = list.parentElement.nextElementSibling;

    // Reset Views
    list.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    exportArea.value = ''; // We can use this to show Batch Details
    exportArea.previousElementSibling.querySelector('span').textContent = '📄 배치 상세 (Batch Details)'; // Header

    // Hide Import area for now (Typesetting manager doesn't import... yet)
    // Or maybe we use it for Publish/Discard logs?
    importArea.parentElement.style.display = 'none'; // Hide import box
    // Show a new "Actions" box instead?

    // Inject Batch List
    fetch('/api/batch/list')
        .then(res => res.json())
        .then(data => {
            if (data.error) return list.innerHTML = 'Error: ' + data.error;

            list.innerHTML = '';
            data.batches.forEach(batch => {
                const div = document.createElement('div');
                div.style.padding = '10px';
                div.style.borderBottom = '1px solid #eee';
                div.style.cursor = 'pointer';
                div.style.position = 'relative';

                // Status Badge
                let statusColor = batch.status === 'PUBLISHED' ? '#28a745' : '#ffc107';
                let statusText = batch.status === 'PUBLISHED' ? '발행됨' : '대기중';

                div.innerHTML = `
                    <div style="font-weight:bold;">${batch.batch_id}</div>
                    <div style="font-size:0.8em; color:#555;">${batch.created_at.split('T')[0]} · ${batch.count} articles</div>
                    <span style="position:absolute; top:10px; right:10px; background:${statusColor}; color:white; padding:2px 6px; border-radius:4px; font-size:0.7em;">${statusText}</span>
                `;

                div.onclick = () => showBatchDetails(batch);
                list.appendChild(div);
            });
        })
        .catch(err => list.innerHTML = 'Error: ' + err);
}

function showBatchDetails(batch) {
    document.getElementById('selectedBatchName').textContent = `Batch: ${batch.batch_id}`;

    // Reuse the Textarea to show readable list?
    // Or just JSON for debugging?
    // Let's fetch the actual file content to show title list
    // We don't have an endpoint for 'get_batch_details' yet, but `batch.json` is simple.
    // We can infer details from what we have or add an endpoint.
    // For now, just show metadata.

    const details = [
        `Batch ID: ${batch.batch_id}`,
        `Created: ${batch.created_at}`,
        `Status: ${batch.status}`,
        `Count: ${batch.count}`,
        `Title: ${batch.title || 'N/A'}`
    ].join('\n');

    document.getElementById('batchExportContent').value = details;

    // Add Action Buttons dynamically in the center panel
    let actionContainer = document.getElementById('batchActions');
    if (!actionContainer) {
        actionContainer = document.createElement('div');
        actionContainer.id = 'batchActions';
        actionContainer.style.marginTop = '10px';
        actionContainer.style.padding = '10px';
        actionContainer.style.background = '#f8f9fa';
        actionContainer.style.border = '1px solid #ddd';
        // Insert after textarea
        document.getElementById('batchExportContent').parentElement.appendChild(actionContainer);
    }

    actionContainer.innerHTML = '';

    if (batch.status !== 'PUBLISHED') {
        actionContainer.innerHTML = `
            <button onclick="publishBatch('${batch.batch_id}')" style="background:#28a745; color:white; padding:8px 16px; border:none; border-radius:4px; margin-right:5px; cursor:pointer;">🚀 발행 (Publish)</button>
            <button onclick="discardBatch('${batch.batch_id}')" style="background:#dc3545; color:white; padding:8px 16px; border:none; border-radius:4px; cursor:pointer;">🗑️ 폐기 (Discard)</button>
        `;
    } else {
        actionContainer.innerHTML = `<span style="color:#28a745; font-weight:bold;">✅ 이 배치는 이미 발행되었습니다.</span>`;
    }
}

function publishBatch(batchId) {
    if (!confirm(`Batch ${batchId}를 발행하시겠습니까?\n(상태가 PUBLISHED로 변경됩니다)`)) return;

    fetch('/api/batch/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                alert('✅ 발행 완료!');
                openBatchManager(); // Refresh
            } else {
                alert('Error: ' + res.error);
            }
        })
        .catch(err => alert('Error: ' + err));
}

function discardBatch(batchId) {
    if (!confirm(`Batch ${batchId}를 폐기하시겠습니까?\n⚠️ 포함된 기사들은 다시 '대기(ACCEPTED)' 상태로 돌아갑니다.`)) return;

    fetch('/api/batch/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId })
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                alert('🗑️ 폐기 완료! 기사들이 복구되었습니다.');
                openBatchManager(); // Refresh
            } else {
                alert('Error: ' + res.error);
            }
        })
        .catch(err => alert('Error: ' + err));
}
