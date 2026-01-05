/**
 * ZND Desk - JavaScript
 */

// =============================================================================
// State
// =============================================================================

let selectedArticles = new Set();
let selectionModeState = null; // null or state string (e.g. 'collected')

let articles = [];
let kanbanData = {}; // Cache for Board Data

// =============================================================================
// Common Functions
// [MOVED] → desk-common.js
// =============================================================================

/**
 * Shared function to render article card HTML
 * Used by both Board and Publisher pages
 * @param {object} article - Article data with article_id, title, source_id, impact_score, zero_echo_score, summary
 * @param {object} options - { selectable, selected, showCategory, showSummary, enlarged, onClickHandler }
 * @returns {string} - Card HTML string
 */
function renderArticleCard(article, options = {}) {
    const { selectable = false, selected = false, showCategory = false, showSummary = false, enlarged = false, onClickHandler = null } = options;
    const articleId = article.article_id || article.id;
    const title = article.title || '(No Title)';
    const source = article.source_id || 'unknown';
    const isRaw = article.impact_score ?? null;
    const zsRaw = article.zero_echo_score ?? null;
    const is = isRaw !== null ? isRaw.toFixed(1) : '-';
    const zs = zsRaw !== null ? zsRaw.toFixed(1) : '-';
    const summary = article.summary || '';
    const state = article.state || '';

    // 폐기 기사는 사유 표시, 그 외는 카테고리 표시
    let category = article.category || '';
    if (state === 'REJECTED' || state === 'rejected') {
        const reason = article.rejected_reason || 'unknown';
        const reasonMap = {
            'cutline': '✂️ 커트라인',
            'duplicate': '🔄 중복',
            'manual': '👤 수동 폐기',
            'unknown': '⛔ 폐기됨'
        };
        category = reasonMap[reason] || `⛔ ${reason}`;
    }

    const selectedClass = selected ? 'selected' : '';
    const enlargedClass = enlarged ? 'card-enlarged' : '';
    const checkboxHtml = selectable
        ? `<input type="checkbox" class="card-checkbox" value="${articleId}" ${selected ? 'checked' : ''} onclick="event.stopPropagation()" onchange="if(typeof PublisherV2 !== 'undefined') PublisherV2.toggleDraftSelection('${articleId}', this.checked)">`
        : '';
    const categoryHtml = showCategory && category
        ? `<span class="card-category">${category}</span>`
        : '';
    const summaryHtml = showSummary && summary
        ? `<div class="card-summary">${summary}</div>`
        : '';

    // Awards Rendering
    let awardsHtml = '';
    if (article.awards && article.awards.length > 0) {
        awardsHtml = '<div class="award-badge-container">';
        article.awards.forEach(award => {
            let badgeClass = '';
            let icon = '';

            if (award === "Today's Headline") {
                badgeClass = 'award-headline';
                icon = '🏆';
            } else if (award === "Zero Echo Award") {
                badgeClass = 'award-zeroecho';
                icon = '💎'; // or 🌿
            } else if (award === "Hot Topic") {
                badgeClass = 'award-hottopic';
                icon = '🔥';
            }

            if (badgeClass) {
                awardsHtml += `<span class="award-badge ${badgeClass}">${icon} ${award}</span>`;
            }
        });
        awardsHtml += '</div>';
    }

    // Use custom handler or default showArticleRaw
    const clickHandler = onClickHandler || `showArticleRaw('${articleId}')`;

    return `
        <div class="kanban-card ${selectedClass} ${enlargedClass}" draggable="true" data-id="${articleId}" data-is="${isRaw ?? 0}" data-zs="${zsRaw ?? 10}" onclick="${clickHandler}">
            ${selectable ? `<div class="card-header-row">
                <label class="card-checkbox-label" onclick="event.stopPropagation()">
                    ${checkboxHtml}
                    <span class="checkbox-text">선택</span>
                </label>
                ${categoryHtml}
            </div>` : ''}
            ${awardsHtml}
            <div class="card-title">${title}</div>
            ${summaryHtml}
            <div class="card-meta">
                <span>${source}</span>
                ${!selectable && showCategory ? categoryHtml : ''}
                <div class="card-scores">
                    <span class="score-is" data-value="${isRaw ?? 0}">IS: ${is}</span>
                    <span class="score-zs" data-value="${zsRaw ?? 10}">ZS: ${zs}</span>
                </div>
            </div>
        </div>
    `;
}

// =============================================================================
// Analyzer Page
// [MOVED] → desk-analyzer.js
// =============================================================================

// =============================================================================
// Publisher Page
// [MOVED] → desk-publisher.js
// =============================================================================

// =============================================================================
// Board Page (Kanban)
// [MOVED] → desk-board.js
// =============================================================================

// =============================================================================
// Unlinked Article Recovery Functions
// [MOVED] → desk-recovery.js
// =============================================================================

// =============================================================================
// Column Menu Functions
// [MOVED] → desk-ui-columns.js
// =============================================================================

// =============================================================================
// Settings Popup
// [MOVED] → desk-settings.js
// =============================================================================

/**
 * 6. Immediate Collection
 * [MOVED] → desk-collector.js
 */

/**
 * 7. Raw Viewer
 * [MOVED] → desk-viewer.js
 */

/**
 * 8. Classification
 * [MOVED] → desk-classification.js
 */
