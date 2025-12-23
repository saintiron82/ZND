/* ============================================
 * desk_core.js
 * ============================================ */

/* ============================================
 * desk.js - 편집 데스크 JavaScript
 * ============================================ */

let deskData = [];
let curTimezone = 'local'; // 'local' or 'gmt'
let selectedDate = null; // 선택된 날짜 (null = 전체 표시)
let currentDetailFilename = null; // 현재 상세보기 중인 파일명
let isTrashMode = false; // 휴지통 모드 상태

// === Trash Management Functions ===



// === Issue / Publication State ===
let currentViewMode = 'desk'; // 'desk' or a publish_id
let availableIssues = []; // Cached list of issues
let selectedPublishMode = 'new'; // 'new' or 'append'
let pendingPublishFilenames = []; // Filenames to be published

// === Issue Selector Functions ===


// Release a preview issue to production

// 🗑️ 회차 전체 삭제



// === Publish Modal Functions ===




// Override publishAll to use new modal

// 발행 회차에서 선택된 기사를 제거하여 미발행 상태로 변경

// 뷰 모드 변경 시 버튼 표시 업데이트 및 패널 전환

// 현재 회차 삭제 (패널 버튼용)

// ✏️ 회차 번호/이름 수정

// 📋 Desk로 돌아가기

// ☁️ 캐시를 Firebase에 동기화


async function loadDesk() {
    const grid = document.getElementById('articleGrid');

    // [MODIFIED] Default to 'all' (Global Staging View)
    // If selectedDate is null, we assume global view.
    // If selectedDate is set (by clicking sidebar), use that.

    if (!selectedDate) {
        selectedDate = 'all';
        const label = document.getElementById('selectedDateLabel');
        if (label) label.textContent = `📅 전체 미발행 (Global Staging)`;
    }

    grid.innerHTML = '<div class="loading">로딩 중... (전체 미발행 기사 스캔)</div>';

    try {
        const response = await fetch(`/api/desk/list?date=${selectedDate}&include_trash=${isTrashMode}`);
        const data = await response.json();

        if (data.error) {
            grid.innerHTML = `<div class="empty-state">오류: ${data.error}</div>`;
            return;
        }

        deskData = data.articles || [];
        window.unanalyzedCount = data.unanalyzed_count || 0;  // [NEW] API에서 받은 미분석 수
        console.log(`Loaded ${deskData.length} items for date=${selectedDate}, unanalyzed=${window.unanalyzedCount}`);

        renderArticles();
        updateStats();
    } catch (error) {
        grid.innerHTML = `<div class="empty-state">로드 실패: ${error.message}</div>`;
    }
}

function getArticleSchema(article) {
    return (article.impact_evidence && article.impact_evidence.schema_version) || 'Unknown';
}

function renderArticles() {
    const grid = document.getElementById('articleGrid');

    if (deskData.length === 0) {
        grid.innerHTML = '<div class="empty-state">Desk 데이터가 없습니다.<br>먼저 일괄 분석을 실행해주세요.</div>';
        return;
    }

    // Group ALL data first
    const grouped = {};
    deskData.forEach(article => {
        const dateRaw = article.crawled_at || article.cached_at || article.saved_at || 'Unknown';
        let dateKey = 'Unknown';

        if (dateRaw !== 'Unknown') {
            const d = new Date(dateRaw);
            if (curTimezone === 'gmt') {
                dateKey = d.toISOString().split('T')[0];
            } else {
                // Local YYYY-MM-DD
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dateKey = `${year}-${month}-${day}`;
            }
        }

        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(article);
    });

    // Sort Dates Descending
    let sortedDates = Object.keys(grouped).sort().reverse();

    // 선택된 날짜가 있으면 해당 날짜만 표시
    if (selectedDate && grouped[selectedDate]) {
        sortedDates = [selectedDate];
    }

    let html = '';

    sortedDates.forEach(date => {
        const allArticles = grouped[date];

        // Show all articles (no schema filter)
        let visibleArticles = allArticles.slice();

        // 카테고리 순서: 미분류(null) → 각 카테고리 알파벳순 → 중복/거부됨/발행됨
        // 같은 그룹 내에서는 Priority 내림차순
        visibleArticles.sort((a, b) => {
            // 중복/거부됨/발행됨은 맨 뒤로
            const aIsInactive = a.dedup_status === 'duplicate' || a.rejected || a.published;
            const bIsInactive = b.dedup_status === 'duplicate' || b.rejected || b.published;
            if (aIsInactive && !bIsInactive) return 1;
            if (!aIsInactive && bIsInactive) return -1;

            // 미분류(카테고리 없음)를 가장 위로
            const aCat = a.category || '';
            const bCat = b.category || '';
            if (!aCat && bCat) return -1;
            if (aCat && !bCat) return 1;

            // 카테고리 알파벳순
            if (aCat !== bCat) return aCat.localeCompare(bCat);

            // 같은 카테고리 내에서 Priority(IS×0.5 + IS/ZS) 순
            const aIS = a.impact_score || 0;
            const aZS = a.zero_echo_score || 0.1;
            const bIS = b.impact_score || 0;
            const bZS = b.zero_echo_score || 0.1;
            const aPriority = (aIS * 0.5) + (aIS / aZS);
            const bPriority = (bIS * 0.5) + (bIS / bZS);
            return bPriority - aPriority;
        });

        // [TRASH MODE Logic]
        // Normal Mode: Hide rejected/duplicate (Unless specific logic requires showing, but standard view hides them)
        // Trash Mode: Show ONLY rejected (or everything? Usually Trash Mode focuses on Trash)
        // User request: "Trash View" -> Show rejected items.
        // Filter visibleArticles based on mode
        if (isTrashMode) {
            // In trash mode, show REJECTED items.
            // Maybe show everything but emphasize rejected?
            // Usually "Trash View" means "Show me what I threw away".
            visibleArticles = visibleArticles.filter(a => a.rejected);
        } else {
            // In normal mode, HIDE REJECTED items.
            // (API already filters rejected if include_trash=false, but double check)
            visibleArticles = visibleArticles.filter(a => !a.rejected);
        }

        const hiddenCount = allArticles.length - visibleArticles.length;

        // Render Header ALWAYS (User Requirement)
        html += `
                    <div style="width:100%; margin-top:20px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:5px; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin:0; color:#4ecdc4;">📅 ${date} <span style="font-size:0.7em; color:#aaa;">(${visibleArticles.length} 표시 / ${allArticles.length} 전체)</span></h3>
                        <select id="schemaSelect-${date}" class="btn" style="padding: 4px 8px; background: #343a40; color: white; border: 1px solid #6c757d;">
                            <option value="" selected>자동 감지 (Auto)</option>
                            <option value="V0.9-Hybrid">V0.9 (수동/Hybrid)</option>
                            <option value="V1.0">V1.0 (표준)</option>
                            <option value="V0.9">V0.9 (구형/Standard)</option>
                        </select>
                    </div>
                `;

        // Render Articles
        if (visibleArticles.length === 0) {
            html += `<div style="padding:20px; text-align:center; color:#666; font-style:italic; border-bottom:1px dashed #444; margin-bottom:10px;">이 날짜에 표시할 기사가 없습니다. (${hiddenCount}개 숨겨짐)</div>`;
        } else {
            html += visibleArticles.map(article => {
                // 상태 결정: 중복 > 거부됨 > 발행됨 > 대기중
                const isDuplicate = article.dedup_status === 'duplicate';
                let cardClass, statusClass, statusText, canSelect;

                if (isDuplicate) {
                    cardClass = 'duplicate';
                    statusClass = 'duplicate';
                    statusText = '중복';
                    canSelect = false;
                } else if (article.rejected) {
                    cardClass = 'rejected';
                    statusClass = 'rejected';
                    statusText = '거부됨';
                    canSelect = false;
                } else if (article.published) {
                    cardClass = 'published';
                    statusClass = 'published';
                    statusText = '발행됨';
                    // 발행 회차 뷰 모드일 때는 체크박스 활성화 (회차에서 제거 가능)
                    canSelect = currentViewMode !== 'desk';
                } else {
                    // 카테고리별 클래스 매핑
                    const catClassMap = {
                        'AI/ML': 'cat-ai-ml',
                        'Engineering': 'cat-engineering',
                        'Community': 'cat-community',
                        'Business': 'cat-business'
                    };
                    const catClass = article.category ? (catClassMap[article.category] || '') : 'cat-uncategorized';
                    cardClass = catClass;
                    statusClass = 'staged';
                    statusText = article.category ? `📂 ${article.category}` : '⏳ 미분류';
                    canSelect = true;
                }

                const articleId = article.article_id || article.id || article.filename?.replace('.json', '') || '';
                const checkboxHtml = canSelect
                    ? `<input type="checkbox" class="article-checkbox" data-filename="${article.filename || ''}" data-date="${date}" data-article-id="${articleId}" onclick="toggleCheck(event)" onchange="updateSelectedCount()" style="width:18px; height:18px; cursor:pointer;">`
                    : '';

                let schemaVer = getArticleSchema(article);
                let badgeClass = 'schema-unknown';
                let badgeText = schemaVer;

                if (schemaVer === 'V1.0') { badgeClass = 'schema-v1'; }
                else if (schemaVer === 'V0.9') { badgeClass = 'schema-v09'; }
                else if (schemaVer === 'V0.9-Hybrid') { badgeClass = 'schema-hybrid'; badgeText = 'Hybrid'; }
                else if (schemaVer === 'Legacy') { badgeClass = 'schema-legacy'; }

                if (badgeText === 'Unknown') badgeText = '';

                // Time display
                const dateRaw = article.crawled_at || article.cached_at || 'Unknown';
                let timeStr = '';
                if (dateRaw !== 'Unknown') {
                    const d = new Date(dateRaw);
                    if (curTimezone === 'gmt') {
                        // e.g. 15:04:05 (GMT)
                        timeStr = d.toISOString().substring(11, 19) + ' (GMT)';
                    } else {
                        // e.g. 15:04:05
                        timeStr = d.toTimeString().split(' ')[0];
                    }
                }

                return `
                            <div class="article-card ${cardClass}" onclick="showDetail('${article.filename}', '${article.date_folder || date}')">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <div style="display:flex; align-items:center;">
                                        ${badgeText ? `<span class="schema-badge ${badgeClass}">${badgeText}</span>` : ''}
                                        <span style="font-size: 0.75em; color: #888; margin-right:5px;">${timeStr}</span>
                                        <span style="font-size: 0.75em; color: #666;">📎 ${article.article_id || article.filename?.replace('.json', '') || '-'}</span>
                                    </div>
                                    ${checkboxHtml}
                                </div>
                                <div class="article-title">${article.title_ko || article.title || '제목 없음'}</div>
                                <div class="article-summary">${(article.summary || '').slice(0, 150)}...</div>
                                <div class="article-meta">
                                    <span class="score-badge score-is" data-article-id="${article.article_id || article.filename?.replace('.json', '') || ''}">IS: ${article.impact_score?.toFixed(1) || '-'}</span>
                                    <span class="score-badge score-zs" data-article-id="${article.article_id || article.filename?.replace('.json', '') || ''}">ZS: ${article.zero_echo_score?.toFixed(1) || '-'}</span>
                                    <span class="status-badge status-${statusClass}">${statusText}</span>
                                </div>
                                ${article.rejected ? `
                                <div class="card-actions" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; display: flex; justify-content: flex-end; gap: 5px;">
                                    <button onclick="event.stopPropagation(); restoreArticle('${article.filename}')" class="btn" style="background: #28a745; color: white; padding: 4px 8px; font-size: 0.8em;" title="기사를 복구하여 다시 검토합니다">♻️ 복구</button>
                                    <button onclick="event.stopPropagation(); deletePermanent('${article.filename}', '${date}')" class="btn" style="background: #c92a2a; color: white; padding: 4px 8px; font-size: 0.8em;" title="영구 삭제합니다 (재수집 방지)">🔥 영구 삭제</button>
                                </div>
                                ` : ''}
                            </div>
                        `;
            }).join('');
        }
    });

    grid.innerHTML = html;

    // 렌더링 후 커트라인 체크 및 점멸 효과 자동 적용
    updateCutline();
}

function updateStats() {
    // 전체 통계
    // 미분석: API에서 직접 받음 (카드로는 표시되지 않음)
    const unanalyzed = window.unanalyzedCount || 0;
    const staged = deskData.filter(a => !a.rejected && !a.published && a.dedup_status !== 'duplicate').length;
    const rejected = deskData.filter(a => a.rejected || a.dedup_status === 'duplicate').length;
    const published = deskData.filter(a => a.published).length;

    const unanalyzedEl = document.getElementById('unanalyzedCount');
    if (unanalyzedEl) unanalyzedEl.textContent = unanalyzed;
    document.getElementById('stagedCount').textContent = staged;
    document.getElementById('rejectedCount').textContent = rejected;
    document.getElementById('publishedCount').textContent = published;

    // 날짜별 진행 상황 업데이트
    updateDateProgress();
}

function updateDateProgress() {
    const dateProgressList = document.getElementById('dateProgressList');
    if (!dateProgressList) return;

    // 날짜별로 그룹화
    const grouped = {};
    deskData.forEach(article => {
        const dateRaw = article.crawled_at || article.cached_at || article.saved_at || 'Unknown';
        if (dateRaw === 'Unknown') return;

        const d = new Date(dateRaw);
        let dateStr;
        if (curTimezone === 'gmt') {
            dateStr = d.toISOString().split('T')[0];
        } else {
            dateStr = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
        }

        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(article);
    });

    const sortedDates = Object.keys(grouped).sort().reverse();

    if (sortedDates.length === 0) {
        dateProgressList.innerHTML = '<div style="text-align: center; color: #666; padding: 10px;">데이터 없음</div>';
        return;
    }

    // 카테고리 색상 맵
    const catColors = {
        'AI/ML': '#667eea',
        'Engineering': '#f5576c',
        'Community': '#4facfe',
        'Business': '#43e97b'
    };

    dateProgressList.innerHTML = sortedDates.map(date => {
        const articles = grouped[date];
        const total = articles.length;
        const pending = articles.filter(a => !a.rejected && !a.published && a.dedup_status !== 'duplicate').length;
        const duplicate = articles.filter(a => a.dedup_status === 'duplicate').length;
        const categorized = articles.filter(a => a.category && a.dedup_status !== 'duplicate').length;
        const uncategorized = articles.filter(a => !a.category && !a.rejected && !a.published && a.dedup_status !== 'duplicate').length;

        // 카테고리별 개수
        const catCounts = {};
        articles.filter(a => a.category && a.dedup_status !== 'duplicate').forEach(a => {
            catCounts[a.category] = (catCounts[a.category] || 0) + 1;
        });

        const catBadges = Object.entries(catCounts).map(([cat, count]) =>
            `<span style="background: ${catColors[cat] || '#6c757d'}; color: white; padding: 1px 6px; border-radius: 8px; font-size: 0.7em; margin-right: 3px;">${cat}: ${count}</span>`
        ).join('');

        // 선택 상태 스타일
        const isSelected = selectedDate === date;
        const cardStyle = isSelected
            ? 'background: rgba(78,205,196,0.2); border: 2px solid #4ecdc4; border-radius: 8px; padding: 10px; cursor: pointer;'
            : 'background: rgba(255,255,255,0.03); border: 2px solid transparent; border-radius: 8px; padding: 10px; cursor: pointer;';

        return `
                            <div style="${cardStyle}" onclick="selectDate('${date}')">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                    <span style="font-weight: bold; color: ${isSelected ? '#4ecdc4' : '#fff'};">📅 ${date}</span>
                                    <span style="font-size: 0.8em; color: #888;">${pending}/${total}</span>
                                </div>
                                ${uncategorized > 0 ? `<div style="margin-bottom: 5px;"><span style="background: #ffc107; color: #333; padding: 1px 6px; border-radius: 8px; font-size: 0.7em;">⏳ 미분류: ${uncategorized}</span></div>` : ''}
                                ${catBadges ? `<div style="margin-bottom: 5px;">${catBadges}</div>` : ''}
                                ${duplicate > 0 ? `<div><span style="background: #6c757d; color: white; padding: 1px 6px; border-radius: 8px; font-size: 0.7em;">🗑️ 중복: ${duplicate}</span></div>` : ''}
                            </div>
                        `;
    }).join('');
}



// ==== 커트라인 기능 ====





















async function resetDedupStatus() {
    if (!confirm('⚠️ 모든 기사의 중복/카테고리 정보를 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }

    try {
        const now = new Date();
        const today = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');

        const response = await fetch('/api/desk/reset_dedup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: today })
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ 초기화 완료!\n\n${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}

// ==== 중복 체크용 JSON 기능 ====
let currentDedupDate = null;
let currentDedupArticles = [];





// 카테고리별 그룹화 렌더링
function renderDedupedArticles(date, categoryResults) {
    const grid = document.getElementById('articleGrid');

    // 해당 날짜 기사만 필터
    const dateArticles = deskData.filter(article => {
        const dateRaw = article.crawled_at || article.cached_at || article.saved_at || 'Unknown';
        if (dateRaw === 'Unknown') return false;

        const d = new Date(dateRaw);
        let articleDate;
        if (curTimezone === 'gmt') {
            articleDate = d.toISOString().split('T')[0];
        } else {
            articleDate = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
        }
        return articleDate === date;
    });

    // 카테고리 색상 맵
    const catColors = {
        'AI/ML': 'cat-ai-ml',
        'Engineering': 'cat-engineering',
        'Community': 'cat-community',
        'Business': 'cat-business'
    };

    let html = '';

    // 헤더
    html += `
                <div style="width:100%; margin-top:20px; margin-bottom:10px; border-bottom:2px solid #ffc107; padding-bottom:10px;">
                    <h3 style="margin:0; color:#ffc107;">🔍 중복 제거 결과 - ${date}</h3>
                    <div style="font-size:0.85em; color:#aaa; margin-top:5px;">Priority 기준 정렬 | 중복 기사는 하단에 표시됩니다</div>
                </div>
            `;

    // 카테고리별 렌더링
    categoryResults.forEach(catGroup => {
        const category = catGroup.category;
        const catClass = catColors[category] || 'cat-default';
        const catArticleIds = new Set(catGroup.article_ids || []);

        // 해당 카테고리 기사 필터 및 Priority 정렬
        const catArticles = dateArticles
            .filter(a => {
                // article_id를 JSON에서 보낸 것과 동일한 방식으로 추출
                const articleId = a.article_id || (() => {
                    const parts = a.filename?.replace('.json', '').split('_') || [];
                    return parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
                })();
                return catArticleIds.has(articleId);
            })
            .sort((a, b) => (b._priority || 0) - (a._priority || 0));

        if (catArticles.length === 0) return;

        // 카테고리 헤더
        html += `
                    <div class="category-group-header" style="background: linear-gradient(135deg, rgba(255,193,7,0.2), rgba(255,193,7,0.05));">
                        <div>
                            <span class="category-badge ${catClass}">${category}</span>
                            <span style="color:#ccc; font-size:0.9em;">${catArticles.length}개 기사</span>
                        </div>
                        <button class="btn" style="padding: 4px 8px; font-size: 0.8em; background: #4ecdc4; color: white;" 
                                onclick="selectCategory('${category}', '${date}')">☑️ 모두 선택</button>
                    </div>
                `;

        // 기사 카드들
        html += catArticles.map(article => renderArticleCard(article, date, catClass)).join('');
    });

    // 중복 기사 섹션
    const duplicateArticles = dateArticles
        .filter(a => a._dedup_duplicate && !a.rejected && !a.published)
        .sort((a, b) => (b._priority || 0) - (a._priority || 0));

    if (duplicateArticles.length > 0) {
        html += `
                    <div class="category-group-header" style="background: rgba(108,117,125,0.2); margin-top: 30px; display:flex; justify-content:space-between;">
                        <div>
                            <span class="category-badge cat-default">🗑️ 중복 제거됨</span>
                            <span style="color:#888; font-size:0.9em;">${duplicateArticles.length}개 기사</span>
                        </div>
                        <button class="btn" style="padding: 4px 8px; font-size: 0.8em; background: #dc3545; color: white;" 
                                onclick="deleteDuplicateArticles('${date}')">🔥 일괄 삭제</button>
                    </div>
                `;

        html += duplicateArticles.map(article => renderArticleCard(article, date, 'duplicate', true)).join('');
    }

    grid.innerHTML = html;
    updateSelectedCount();
}

// 개별 기사 카드 렌더링 (재사용 가능)
function renderArticleCard(article, date, extraClass = '', isDuplicate = false) {
    const cardClass = isDuplicate ? 'duplicate' : (article.rejected ? 'rejected' : (article.published ? 'published' : ''));
    const canSelect = !isDuplicate && !article.rejected && !article.published;
    const checkboxHtml = canSelect
        ? `<input type="checkbox" class="article-checkbox" data-filename="${article.filename}" data-date="${date}" checked onclick="toggleCheck(event)" onchange="updateSelectedCount()" style="width:18px; height:18px; cursor:pointer;">`
        : '';

    const priority = article._priority?.toFixed(2) || '-';
    const is = article.impact_score?.toFixed(1) || '-';
    const zs = article.zero_echo_score?.toFixed(1) || '-';

    return `
                <div class="article-card ${cardClass} ${extraClass}" onclick="showDetail('${article.filename}', '${article.date_folder || date}')">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="font-size: 0.75em; color: #ffc107; font-weight:bold;">P:${priority}</span>
                            <span style="font-size: 0.75em; color: #666;">📎 ${article.article_id || '-'}</span>
                        </div>
                        ${checkboxHtml}
                    </div>
                    <div class="article-title">${article.title_ko || article.title || '제목 없음'}</div>
                    <div class="article-summary">${(article.summary || '').slice(0, 100)}...</div>
                    <div class="article-meta">
                        <span class="score-badge score-is">IS: ${is}</span>
                        <span class="score-badge score-zs">ZS: ${zs}</span>
                    </div>
                </div>
            `;
}

// 카테고리 기사 전체 선택
function selectCategory(category, date) {
    // 해당 카테고리에 속한 기사들의 체크박스 모두 선택
    deskData.forEach(article => {
        if (article._dedup_category === category) {
            const cb = document.querySelector(`.article-checkbox[data-filename="${article.filename}"]`);
            if (cb) cb.checked = true;
        }
    });
    updateSelectedCount();
}

// ⚙️ 발행 설정 로드 (다음 호수 등)
async function loadPublicationConfig() {
    try {
        const resp = await fetch('/api/publication/config');
        const result = await resp.json();
        if (result.success && result.config) {
            const nextIssue = result.config.next_issue_number || 1;
            const display = document.getElementById('nextIssueNumberDisplay');
            if (display) {
                display.textContent = nextIssue + '호';
                display.dataset.issueNumber = nextIssue;
            }
            console.log('⚙️ Publication config loaded:', result.config);
        }
    } catch (e) {
        console.warn('Config load failed:', e);
    }
}

// ============================================
// 🕐 자동 크롤링 스케줄 관리
// ============================================




// 스케줄 관리 모달 열기/닫기



async function addSchedule(name, cron) {
    try {
        const resp = await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cron, enabled: true })
        });
        const result = await resp.json();
        if (result.success) {
            loadSchedules();
        } else {
            alert('추가 실패: ' + result.error);
        }
    } catch (e) {
        alert('오류: ' + e.message);
    }
}


async function updateSchedule(scheduleId, name, cron) {
    try {
        const resp = await fetch(`/api/schedule/${scheduleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cron })
        });
        const result = await resp.json();
        if (result.success) {
            loadSchedules();
        } else {
            alert('수정 실패: ' + result.error);
        }
    } catch (e) {
        alert('오류: ' + e.message);
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    // 커트라인 기본값 로드
    try {
        const settingsResp = await fetch('/api/desk/settings');
        const settings = await settingsResp.json();
        if (settings.success) {
            const isSlider = document.getElementById('cutlineIS');
            const zsSlider = document.getElementById('cutlineZS');
            const isValue = document.getElementById('cutlineISValue');
            const zsValue = document.getElementById('cutlineZSValue');

            if (isSlider && settings.cutline_is_default) {
                isSlider.value = settings.cutline_is_default;
                if (isValue) isValue.textContent = settings.cutline_is_default.toFixed(1);
            }
            if (zsSlider && settings.cutline_zs_default) {
                zsSlider.value = settings.cutline_zs_default;
                if (zsValue) zsValue.textContent = settings.cutline_zs_default.toFixed(1);
            }
            console.log('✂️ Cutline defaults loaded:', settings);
        }
    } catch (e) {
        console.warn('Cutline settings load failed:', e);
    }

    await refreshIssueList();
    await loadPublicationConfig(); // 설정 로드 추가
    await loadDesk();

    // 🔥 Firebase 통계 로드
    await loadFirebaseStats();
});

// ============================================
// 🔥 Firebase 사용량 통계
// ============================================

async function loadFirebaseStats() {
    try {
        const resp = await fetch('/api/firebase/stats');
        const result = await resp.json();
        if (result.success && result.stats) {
            updateFirebaseStatsUI(result.stats);
        }
    } catch (e) {
        console.warn('Firebase stats load failed:', e);
    }
}

function updateFirebaseStatsUI(stats) {
    const reads = document.getElementById('fbStatReads');
    const writes = document.getElementById('fbStatWrites');
    const deletes = document.getElementById('fbStatDeletes');
    const total = document.getElementById('fbStatTotal');

    if (reads) reads.textContent = stats.reads || 0;
    if (writes) writes.textContent = stats.writes || 0;
    if (deletes) deletes.textContent = stats.deletes || 0;
    if (total) total.textContent = stats.total || 0;
}

async function resetFirebaseStats() {
    if (!confirm('🔥 Firebase 사용량 통계를 리셋하시겠습니까?')) return;

    try {
        const resp = await fetch('/api/firebase/stats/reset', { method: 'POST' });
        const result = await resp.json();
        if (result.success) {
            updateFirebaseStatsUI(result.stats);
            console.log('🔄 Firebase stats reset');
        }
    } catch (e) {
        console.warn('Firebase stats reset failed:', e);
    }
}