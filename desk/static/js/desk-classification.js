/**
 * ZND Desk - Classification Logic
 * 분류 모달 및 일괄 분류 기능
 */

/**
 * 8. Classification
 */
let currentClassifyingArticleId = null;
let currentBatchCandidates = [];


/**
 * Fetch previous edition article counts (for context display)
 */
async function fetchPreviousEditionCounts() {
    try {
        const res = await fetchAPI('/api/publisher/editions?limit=3');
        if (res.success && res.editions && res.editions.length > 0) {
            return {
                prev1: res.editions[0]?.article_count || 0,
                prev2: res.editions[1]?.article_count || 0,
                prev1_code: res.editions[0]?.edition_code || res.editions[0]?.id || null,
                prev2_code: res.editions[1]?.edition_code || res.editions[1]?.id || null,
                prev1_name: res.editions[0]?.edition_name || res.editions[0]?.name || '이전 1회차',
                prev2_name: res.editions[1]?.edition_name || res.editions[1]?.name || '이전 2회차'
            };
        }
    } catch (e) {
        console.warn('Failed to fetch previous editions:', e);
    }
    return { prev1: 0, prev2: 0, prev1_code: null, prev2_code: null };
}

/**
 * Toggle edition context inclusion in prompt
 * Uses same approach as the existing Context button (regenerates full prompt)
 */
async function toggleEditionContext(editionKey) {
    const toggleEl = document.getElementById(`toggle-${editionKey}`);
    if (!toggleEl) return;

    const included = window._classifyEditionIncluded || {};
    const editionData = window._classifyEditionData || {};

    // Initialize storage for context articles
    if (!window._classifyContextArticles) {
        window._classifyContextArticles = { prev1: [], prev2: [] };
    }

    // Toggle state
    included[editionKey] = !included[editionKey];
    window._classifyEditionIncluded = included;

    // Update UI
    if (included[editionKey]) {
        // Show loading state
        toggleEl.style.opacity = '0.8';
        toggleEl.querySelector('div:last-child').textContent = '⏳ 로딩...';

        // Fetch articles
        const editionCode = editionKey === 'prev1' ? editionData.prev1_code : editionData.prev2_code;

        if (editionCode) {
            try {
                console.log('[toggleEditionContext] Fetching articles for:', editionCode);
                const res = await fetchAPI(`/api/publisher/edition/${editionCode}`);
                console.log('[toggleEditionContext] API response:', res);

                if (res.success && res.articles && res.articles.length > 0) {
                    // Mark as context and store
                    const contextArticles = res.articles.map(a => ({ ...a, _is_context: true }));
                    window._classifyContextArticles[editionKey] = contextArticles;

                    // Update UI to show success
                    toggleEl.style.opacity = '1';
                    toggleEl.style.border = '2px solid #00ff88';
                    toggleEl.querySelector('div:last-child').textContent = '✅ 포함됨';
                    toggleEl.querySelector('div:last-child').style.color = '#00ff88';

                    // Regenerate prompt with context
                    regeneratePromptWithContext();
                    console.log('[toggleEditionContext] Context added:', editionKey, contextArticles.length, 'articles');
                } else {
                    // No articles found
                    included[editionKey] = false;
                    window._classifyEditionIncluded = included;
                    toggleEl.style.opacity = '0.6';
                    toggleEl.querySelector('div:last-child').textContent = '❌ 기사 없음';
                    toggleEl.querySelector('div:last-child').style.color = '#ff4444';
                }
            } catch (e) {
                console.error('[toggleEditionContext] Failed:', e);
                included[editionKey] = false;
                window._classifyEditionIncluded = included;
                toggleEl.style.opacity = '0.6';
                toggleEl.querySelector('div:last-child').textContent = '❌ 오류';
            }
        }
    } else {
        // Remove context
        window._classifyContextArticles[editionKey] = [];

        toggleEl.style.opacity = '0.6';
        toggleEl.style.border = '2px dashed transparent';
        toggleEl.querySelector('div:last-child').textContent = '➕ 클릭하여 추가';
        toggleEl.querySelector('div:last-child').style.color = '#aaa';

        // Regenerate prompt without this context
        regeneratePromptWithContext();
    }
}

/**
 * Regenerate the full batch prompt with all included context
 */
function regeneratePromptWithContext() {
    const contextArticles = window._classifyContextArticles || { prev1: [], prev2: [] };
    const allContext = [...contextArticles.prev1, ...contextArticles.prev2];

    // Combine: Context first (for LLM reference) + Current batch
    const combined = [...allContext, ...currentBatchCandidates];

    const newPrompt = generateBatchPrompt(combined);
    const promptEl = document.getElementById('classify-prompt');
    if (promptEl) {
        promptEl.value = newPrompt;
    }

    console.log('[regeneratePromptWithContext] Total articles in prompt:', combined.length,
        '(Context:', allContext.length, ', New:', currentBatchCandidates.length, ')');
}

/**
 * Generate context prompt for a previous edition
 */
function generateEditionContextPrompt(articles, editionName) {
    let context = `\n\n=== 참고: ${editionName} 기사 목록 ===\n`;
    articles.forEach((a, i) => {
        const title = a.title_ko || a.title || a._classification?.title_ko || '제목 없음';
        const category = a.category || a._classification?.category || '미분류';
        context += `[${i + 1}] ${title} (${category})\n`;
    });
    context += `=== 참고 끝 ===\n`;
    return context;
}

/**
 * Append context to prompt textarea
 */
function appendToPrompt(text, tag) {
    const promptEl = document.getElementById('classify-prompt');
    if (!promptEl) return;

    // Add tagged content
    const taggedContent = `\n<!-- CONTEXT:${tag} -->${text}<!-- /CONTEXT:${tag} -->`;
    promptEl.value += taggedContent;
}

/**
 * Remove tagged context from prompt
 */
function removeFromPrompt(tag) {
    const promptEl = document.getElementById('classify-prompt');
    if (!promptEl) return;

    // Match the context block including newlines
    const startMarker = `<!-- CONTEXT:${tag} -->`;
    const endMarker = `<!-- /CONTEXT:${tag} -->`;

    const startIdx = promptEl.value.indexOf(startMarker);
    const endIdx = promptEl.value.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
        const before = promptEl.value.substring(0, startIdx);
        const after = promptEl.value.substring(endIdx + endMarker.length);
        // Remove leading newline if present
        promptEl.value = before.replace(/\n$/, '') + after;
        console.log('[removeFromPrompt] Removed context:', tag);
    } else {
        console.log('[removeFromPrompt] Context not found:', tag);
    }
}

// Make global for HTML onclick
window.openClassifyModal = openClassifyModal;

async function openClassifyModal(article) {
    console.log('openClassifyModal called', article);
    if (!kanbanData) kanbanData = {}; // Safety check

    if (article) {
        currentClassifyingArticleId = article.id || article._header?.article_id;
        const original = article._original || {};
        const title = original.title || '제목 없음';

        // Generate Prompt
        const prompt = generatePrompt(original);

        document.getElementById('classify-prompt').value = prompt;
        document.getElementById('classify-title-input').value = title;
    } else {
        // General Tool Mode (Batch Classification for ANALYZED + CLASSIFIED items)
        currentClassifyingArticleId = null;

        // 분석완료(ANALYZED) + 분류완료(CLASSIFIED) 모두 투입 가능
        const analyzedArticles = kanbanData[ArticleState.ANALYZED]?.articles || [];
        const classifiedArticles = kanbanData[ArticleState.CLASSIFIED]?.articles || [];
        const candidates = [...analyzedArticles, ...classifiedArticles];
        currentBatchCandidates = candidates; // Store global

        if (candidates.length > 0) {
            const prompt = generateBatchPrompt(candidates);
            document.getElementById('classify-prompt').value = prompt;
            // Show detailed stats with breakdown and clickable edition toggles
            const prevEditions = await fetchPreviousEditionCounts();

            // Store edition data for toggle functionality
            window._classifyEditionData = prevEditions;
            window._classifyEditionIncluded = { prev1: false, prev2: false };

            const statsEl = document.getElementById('batch-stats-display');
            if (statsEl) statsEl.innerHTML = `
                <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; align-items: center;">
                    <div style="background: #e17055; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px;">
                        <div style="font-size: 24px; font-weight: bold;">${candidates.length}</div>
                        <div style="font-size: 10px;">🆕 신규 분류대상</div>
                    </div>
                    <div style="background: #00b894; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px;">
                        <div style="font-size: 24px; font-weight: bold;">${classifiedArticles.length}</div>
                        <div style="font-size: 10px;">✅ 분류완료 대기</div>
                    </div>
                    <div id="toggle-prev1" onclick="toggleEditionContext('prev1')" 
                         style="background: #636e72; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px; cursor: pointer; opacity: 0.6; border: 2px dashed transparent; transition: all 0.2s;"
                         title="클릭하여 프롬프트에 포함">
                        <div style="font-size: 24px; font-weight: bold;">${prevEditions.prev1 || 0}</div>
                        <div style="font-size: 10px;">📚 이전 1회차</div>
                        <div style="font-size: 9px; margin-top: 4px; color: #aaa;">➕ 클릭하여 추가</div>
                    </div>
                    <div id="toggle-prev2" onclick="toggleEditionContext('prev2')"
                         style="background: #2d3436; color: white; padding: 10px 16px; border-radius: 8px; text-align: center; min-width: 80px; cursor: pointer; opacity: 0.6; border: 2px dashed transparent; transition: all 0.2s;"
                         title="클릭하여 프롬프트에 포함">
                        <div style="font-size: 24px; font-weight: bold;">${prevEditions.prev2 || 0}</div>
                        <div style="font-size: 10px;">📚 이전 2회차</div>
                        <div style="font-size: 9px; margin-top: 4px; color: #aaa;">➕ 클릭하여 추가</div>
                    </div>
                </div>
                <p style="text-align: center; color: #888; font-size: 11px; margin-top: 10px;">이전 회차 박스를 클릭하면 프롬프트에 컨텍스트가 추가됩니다</p>
            `;
        } else {
            document.getElementById('classify-prompt').value = '분석완료(ANALYZED) 상태의 기사가 없습니다.';
            const statsEl = document.getElementById('batch-stats-display');
            if (statsEl) statsEl.innerHTML = `<p style="text-align:center; color: #888;">분류 대상 없음</p>`;
        }
    }

    // Common Reset
    const resultEl = document.getElementById('classify-result');
    if (resultEl) resultEl.value = '';

    const categorySelect = document.getElementById('classify-category');
    if (categorySelect) categorySelect.value = '';

    document.getElementById('classification-modal').classList.remove('hidden');
}

function generatePrompt(original) {
    return `SOURCE TITLE: ${original.title}
SOURCE TEXT:
${original.text ? original.text.substring(0, 1500).replace(/\s+/g, ' ') : 'No text content.'} ... (truncated)`;
}

function renderScoreBreakdown(article) {
    const analysis = article._analysis || {};
    let impactEvidence = analysis.impact_evidence || {};
    let zsEvidence = analysis.evidence || {};

    // [Fallback] Parse mll_raw if detailed evidence is missing
    const mllRaw = analysis.mll_raw || {};

    // Fallback Parsing Logic (same as before)
    if (Object.keys(impactEvidence).length === 0 && mllRaw.IS_Analysis) {
        impactEvidence = { calculations: mllRaw.IS_Analysis.Calculations };
    }
    if (Object.keys(zsEvidence).length === 0 && mllRaw.ZES_Raw_Metrics) {
        const rawZes = mllRaw.ZES_Raw_Metrics;
        zsEvidence = {
            breakdown: {
                Signal_Components: rawZes.Signal,
                Noise_Components: rawZes.Noise,
                Utility_Multipliers: rawZes.Utility
            }
        };
    }

    if (Object.keys(impactEvidence).length === 0 && Object.keys(zsEvidence).length === 0) return '';

    let html = `
        <div style="margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
        <h4 style="margin-top:0; margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">📊 점수 산출 로직 (Score Breakdown) - V1.0</h4>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
    `;

    // ---------------------------------------------------------
    // 1. IS Breakdown (V1: IW + IE)
    // ---------------------------------------------------------
    const calculations = impactEvidence.calculations || {};
    const iw = calculations.IW_Analysis || {};
    const ie = calculations.IE_Analysis || {};
    const iwInputs = iw.Inputs || {};
    const ieInputs = ie.Inputs || {};

    // Scores
    const tierScore = parseFloat(iw.Tier_Score !== undefined ? iw.Tier_Score : (iw.Scores?.Tier_Score || 0));
    const gapScore = parseFloat(iw.Gap_Score !== undefined ? iw.Gap_Score : (iw.Scores?.Gap_Score || 0));
    const iwTotal = tierScore + gapScore;

    const scopeScore = parseFloat(ie.IE_Score !== undefined ? ie.IE_Score : (ie.Scores?.Scope_Score || 0));
    const valScope = parseFloat(ieInputs.Scope_Matrix_Score || ieInputs.Information_Scope || 0);
    const valCrit = parseFloat(ieInputs.Criticality_Total || ieInputs.Criticality || 0);
    const ieTotal = valScope + valCrit;

    const displayScope = valScope || scopeScore;
    const displayCrit = valCrit;

    if (Object.keys(calculations).length > 0) {
        html += `
            <div style="flex: 1; min-width: 300px; background: #2f3640; padding: 10px; border-radius: 6px;">
                <div style="color: #e1b12c; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom:5px;">
                    Impact Score (IS) = IW + IE
                </div>
                
                <!-- IW Section -->
                <div style="margin-bottom: 10px;">
                    <div style="font-size: 0.85em; color: #aaa; margin-bottom: 4px;">Impact Weight (IW) = Tier + Gap</div>
                    <table style="width: 100%; font-size: 0.9em;">
                        <tr><td>Market Tier (${iwInputs.Pe_Tier || '-'})</td><td style="text-align:right;">${tierScore.toFixed(1)}</td></tr>
                        <tr><td>Gap Score (x${iwInputs.Gap_Multiplier || '-'})</td><td style="text-align:right;">+ ${gapScore.toFixed(1)}</td></tr>
                        <tr style="border-top: 1px dashed #555; font-weight: bold;">
                            <td style="color: #ddd;">IW Total</td>
                            <td style="text-align:right;">= ${iwTotal.toFixed(1)}</td>
                        </tr>
                    </table>
                </div>

                <!-- IE Section -->
                <div style="margin-bottom: 10px;">
                    <div style="font-size: 0.85em; color: #aaa; margin-bottom: 4px;">Impact Echo (IE) = Scope + Criticality</div>
                    <table style="width: 100%; font-size: 0.9em;">
                        <tr><td>Scope</td><td style="text-align:right;">${displayScope.toFixed(1)}</td></tr>
                        <tr><td>Criticality</td><td style="text-align:right;">+ ${displayCrit.toFixed(1)}</td></tr>
                        <tr style="border-top: 1px dashed #555; font-weight: bold;">
                            <td style="color: #ddd;">IE Total</td>
                            <td style="text-align:right;">= ${ieTotal.toFixed(1)}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 10px; border-top: 1px solid #777; padding-top: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight:bold; color: #fff;">Final IS</span>
                    <span style="font-weight:bold; color: #e1b12c; font-size: 1.2em;">${analysis.impact_score?.toFixed(1) ?? '-'}</span>
                </div>
            </div>
        `;
    }

    // ---------------------------------------------------------
    // 2. ZES Breakdown (V1.1: 10 - Weighted, supports nested Items structure)
    // ---------------------------------------------------------
    const breakdown = zsEvidence.breakdown || {};
    const rawSignal = breakdown.Signal || breakdown.Signal_Components || {};
    const rawNoise = breakdown.Noise || breakdown.Noise_Components || {};
    const rawUtil = breakdown.Utility || breakdown.Utility_Multipliers || {};

    // Helper to extract score from nested Items structure or flat structure
    const getScore = (obj, key) => {
        if (!obj) return 0;
        // Check nested Items structure first (new schema v1.1.0)
        if (obj.Items && obj.Items[key]) {
            const item = obj.Items[key];
            return parseFloat(typeof item === 'object' ? item.Score : item) || 0;
        }
        // Fallback to flat structure (legacy)
        const val = obj[key];
        return parseFloat(typeof val === 'object' ? val.Score : val) || 0;
    };

    // Extract individual scores
    const t1 = getScore(rawSignal, 'T1'), t2 = getScore(rawSignal, 'T2'), t3 = getScore(rawSignal, 'T3'), t4 = getScore(rawSignal, 'T4');
    const p1 = getScore(rawNoise, 'P1'), p2 = getScore(rawNoise, 'P2'), p3 = getScore(rawNoise, 'P3'), p4 = getScore(rawNoise, 'P4');
    const v1 = getScore(rawUtil, 'V1'), v2 = getScore(rawUtil, 'V2'), v3 = getScore(rawUtil, 'V3'), v4 = getScore(rawUtil, 'V4');

    if (t1 > 0 || t2 > 0 || t3 > 0 || t4 > 0 || Object.keys(rawSignal).length > 0) {
        // Calculate Boosted Max Aggregation (V1.2.0: MAX + AVG * 0.25)
        const getBoosted = (arr) => {
            const max = Math.max(...arr);
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            return Math.min(10.0, max + avg * 0.25);
        };

        const sAgg = getBoosted([t1, t2, t3, t4]);
        const nAgg = getBoosted([p1, p2, p3, p4]);

        let uAgg = 1.0;
        if (v1 > 0 || v2 > 0 || v3 > 0 || v4 > 0) {
            uAgg = getBoosted([v1, v2, v3, v4]);
        } else if (rawUtil.Combined_Multiplier !== undefined) {
            uAgg = parseFloat(rawUtil.Combined_Multiplier);
        }

        // Calculate Purity (V1.2.1: 허용치 2→1)
        const noisePenalty = Math.max(0, nAgg - 1) / 10;
        const purity = sAgg * (1 - noisePenalty);

        // Quality Score = (Purity × 0.7) + (U × 0.3)
        const qualityScore = (purity * 0.7) + (uAgg * 0.3);

        // ZES = 10 - Quality Score (낮을수록 좋음!)
        const zesCalc = 10 - qualityScore;

        html += `
            <div style="flex: 1; min-width: 300px; background: #2f3640; padding: 10px; border-radius: 6px;">
                <div style="color: #00cec9; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom:5px;">
                    ZS (Zero Echo Score) - v1.2.0 ⬇️낮을수록 좋음
                </div>
                
                <table style="width: 100%; font-size: 0.9em; border-collapse: collapse;">
                    <!-- Components -->
                    <tr style="border-bottom: 1px solid #555;"><th style="text-align:left; color:#aaa;">Factor</th><th style="text-align: center; color:#aaa;">Agg</th><th style="text-align:right; color:#ddd;">Inputs</th></tr>
                    
                    <tr>
                        <td>Signal (S)</td>
                        <td style="text-align:center; font-weight:bold; color: #74b9ff;">${sAgg.toFixed(2)}</td>
                        <td style="text-align:right; font-size: 0.75em; color: #aaa;">T: ${t1}, ${t2}, ${t3}, ${t4}</td>
                    </tr>
                    <tr>
                        <td>Noise (N)</td>
                        <td style="text-align:center; font-weight:bold; color: #ff7675;">${nAgg.toFixed(2)}</td>
                        <td style="text-align:right; font-size: 0.75em; color: #aaa;">P: ${p1}, ${p2}, ${p3}, ${p4}</td>
                    </tr>
                    <tr>
                        <td>Utility (U)</td>
                        <td style="text-align:center; font-weight:bold; color: #a29bfe;">${uAgg.toFixed(2)}</td>
                        <td style="text-align:right; font-size: 0.75em; color: #aaa;">V: ${v1}, ${v2}, ${v3}, ${v4}</td>
                    </tr>
                    <tr style="border-top: 1px dashed #555;">
                        <td>Purity</td>
                        <td colspan="2" style="text-align:right; font-weight:bold; color: #55efc4;">${purity.toFixed(2)} <span style="font-size:0.75em; color:#888;">(S × (1 - penalty))</span></td>
                    </tr>
                    <tr>
                        <td>Quality</td>
                        <td colspan="2" style="text-align:right; font-weight:bold; color: #ffeaa7;">${qualityScore.toFixed(2)} <span style="font-size:0.75em; color:#888;">(Purity×0.7 + U×0.3)</span></td>
                    </tr>
                </table>

                <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.85em; font-family: monospace; color: #dfe6e9;">
                    Formula (v1.2.0):<br>
                    Quality = (Purity × 0.7) + (U × 0.3)<br>
                    <strong>ZS = 10 - Quality</strong> (낮을수록 좋음)
                </div>
                
                <div style="margin-top: 10px; border-top: 1px solid #777; padding-top: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight:bold; color: #fff;">Final ZS</span>
                    <span style="font-weight:bold; color: #00cec9; font-size: 1.2em;">${analysis.zero_echo_score?.toFixed(2) ?? zesCalc.toFixed(2)}</span>
                </div>
            </div>
        `;
    }


    html += `</div></div>`;
    return html;
}

function generateBatchPrompt(articles) {
    let text = ``;

    articles.forEach((art, idx) => {
        const isContext = art._is_context;
        const titleRef = isContext ? `[PRE-CLASSIFIED / REFERENCE] ${art.title}` : `[TARGET] ${art.title}`;

        text += `[Article ${idx + 1}]\n`;
        text += `ID: ${art.article_id || art.id}\n`;
        text += `Title: ${titleRef}\n`;
        text += `Summary: ${art.summary || 'No summary'}\n`;
        const is = art.impact_score ?? 0;
        const zs = art.zero_echo_score ?? 5;
        const basePriority = is + (10 - zs);
        const priority = isContext ? (basePriority + 100).toFixed(1) : basePriority.toFixed(1);
        text += `IS: ${art.impact_score ?? '-'} / ZS: ${art.zero_echo_score ?? '-'} / Priority: ${priority}\n`;
        if (isContext) {
            text += `Category: ${art.category || 'Unknown'}\n`;
            text += `State: PUBLISHED/REFERENCE\n`;
        }
        text += `--------------------------------------------------\n`;
    });

    return text;
}

// Global variable to store last parsed classification result
let lastParsedClassification = null;

/**
 * Parse classification JSON result and compute stats
 * @param {string} text - JSON text from textarea
 * @returns {object|null} - Parsed result with stats, or null if invalid
 */
function parseClassificationResult(text) {
    try {
        const objStart = text.indexOf('{');
        const objEnd = text.lastIndexOf('}');

        if (objStart < 0 || objEnd <= objStart) return null;

        const parsedData = JSON.parse(text.substring(objStart, objEnd + 1));

        if (!parsedData.results || !Array.isArray(parsedData.results) || parsedData.results.length === 0) {
            return null;
        }

        // Get target and context IDs
        const targetIdSet = new Set((currentBatchCandidates || [])
            .filter(a => !a._is_context)
            .map(a => a.article_id || a.id));

        const contextIdSet = new Set((currentBatchCandidates || [])
            .filter(a => a._is_context)
            .map(a => a.article_id || a.id));

        // Collect classified IDs and build tasks
        const classifiedIds = new Set();
        const allTasks = [];
        const targetTasks = [];
        const stats = {};

        parsedData.results.forEach(group => {
            const category = group.category || 'Unknown';
            (group.article_ids || []).forEach(id => {
                classifiedIds.add(id);
                allTasks.push({ article_id: id, category });

                if (targetIdSet.has(id)) {
                    targetTasks.push({ article_id: id, category });
                    stats[category] = (stats[category] || 0) + 1;
                }
            });
        });

        // Find duplicates
        const duplicateIds = [...targetIdSet].filter(id => !classifiedIds.has(id));

        return {
            valid: true,
            targetCount: targetIdSet.size,
            contextCount: contextIdSet.size,
            totalPromptArticles: targetIdSet.size + contextIdSet.size,
            targetClassified: targetTasks.length,
            duplicateCount: duplicateIds.length,
            duplicateIds,
            targetTasks,
            stats
        };
    } catch (e) {
        console.error('[parseClassificationResult] Error:', e);
        return null;
    }
}


// Add Context (Recent History)
document.getElementById('btn-add-context')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-add-context');
    const promptEl = document.getElementById('classify-prompt');

    if (btn.disabled) return;

    const originalText = btn.textContent;
    btn.textContent = '⏳ 불러오는 중...';
    btn.disabled = true;

    try {
        const res = await fetchAPI('/api/board/context/recent?limit=2');
        if (res.success && res.articles.length > 0) {
            // Mark context articles
            const contextArticles = res.articles.map(a => ({ ...a, _is_context: true }));

            // Combine with current batch (Context first for LLM reference)
            const combined = [...contextArticles, ...currentBatchCandidates];

            const newPrompt = generateBatchPrompt(combined);
            promptEl.value = newPrompt;

            // Update stats display with counts
            const statsEl = document.getElementById('batch-stats-display');
            if (statsEl) statsEl.innerHTML = `
                <div style="display: flex; gap: 15px; justify-content: center; align-items: center;">
                    <div style="background: #0984e3; color: white; padding: 12px 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold;">${currentBatchCandidates.length}</div>
                        <div style="font-size: 11px;">🎯 분류 대상</div>
                    </div>
                    <div style="background: #00b894; color: white; padding: 12px 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold;">${contextArticles.length}</div>
                        <div style="font-size: 11px;">📚 참고(2회차)</div>
                    </div>
                </div>
                <p style="text-align: center; color: #00b894; font-size: 11px; margin-top: 10px;">✅ 참고 데이터 포함됨</p>
            `;

            btn.textContent = '✅ 추가됨';

        } else {
            alert('추가할 과거 기사 정보가 없습니다.');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        alert('오류: ' + e.message);
        btn.textContent = originalText;
        btn.disabled = false;
    }
});


// Copy Prompt
document.getElementById('btn-copy-prompt')?.addEventListener('click', () => {
    const prompt = document.getElementById('classify-prompt');
    prompt.select();
    document.execCommand('copy');

    const btn = document.getElementById('btn-copy-prompt');
    const originalText = btn.textContent;
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = originalText, 2000);
});

// Auto-Parse Result on Input & Show Stats (uses shared parseClassificationResult)
document.getElementById('classify-result')?.addEventListener('input', (e) => {
    try {
        const text = e.target.value;

        // Use shared parsing function
        const parsed = parseClassificationResult(text);
        lastParsedClassification = parsed;  // Store for confirm handler

        if (parsed) {
            let html = `<div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
                <div style="background: #636e72; color: white; padding: 10px 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold;">${parsed.totalPromptArticles}</div>
                    <div style="font-size: 11px;">프롬프트 총 기사</div>
                    <div style="font-size: 9px; color: #ddd;">(대상: ${parsed.targetCount} + 참고: ${parsed.contextCount})</div>
                </div>
                <div style="background: #00b894; color: white; padding: 10px 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold;">${parsed.targetClassified}</div>
                    <div style="font-size: 11px;">분류됨</div>
                </div>
                <div style="background: #d63031; color: white; padding: 10px 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold;">${parsed.duplicateCount}</div>
                    <div style="font-size: 11px;">중복 폐기</div>
                </div>
            </div>`;

            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">`;
            for (const [cat, count] of Object.entries(parsed.stats)) {
                html += `<div style="background: #2d3436; padding: 6px; border-radius: 4px; border: 1px solid #636e72; text-align: center; font-size: 12px;">
                    <strong style="color: #74b9ff;">${cat}</strong>: ${count}
                </div>`;
            }
            html += `</div>`;

            document.getElementById('batch-stats-display').innerHTML = html;
            return;
        }

        // Fallback: Old array format
        const jsonStart = text.indexOf('[');
        const jsonEnd = text.lastIndexOf(']');

        let data = [];
        if (jsonStart >= 0 && jsonEnd >= 0) {
            data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
        }

        // Render Stats (old format)
        if (Array.isArray(data) && data.length > 0) {
            const total = data.length;
            const stats = {};
            let duplicates = 0;

            data.forEach(item => {
                const cat = item.category || 'Unknown';
                if (cat === 'REJECTED' || cat === 'DUPLICATE' || item.is_duplicate) {
                    duplicates++;
                } else {
                    stats[cat] = (stats[cat] || 0) + 1;
                }
            });

            let html = `<div style="display: flex; gap: 20px; justify-content: center; margin-bottom: 15px;">
                <div style="background: #00b894; color: white; padding: 10px 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${total}</div>
                    <div style="font-size: 12px;">Total Input</div>
                </div>
                <div style="background: #0984e3; color: white; padding: 10px 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${total - duplicates}</div>
                    <div style="font-size: 12px;">Classified</div>
                </div>
                <div style="background: #d63031; color: white; padding: 10px 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${duplicates}</div>
                    <div style="font-size: 12px;">Rejected/Dup</div>
                </div>
            </div>`;

            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;">`;
            for (const [cat, count] of Object.entries(stats)) {
                html += `<div style="background: #2d3436; padding: 8px; border-radius: 4px; border: 1px solid #636e72; text-align: center;">
                    <strong style="color: #74b9ff;">${cat}</strong>: ${count}
                </div>`;
            }
            html += `</div>`;

            document.getElementById('batch-stats-display').innerHTML = html;
        }

    } catch (err) {
        // Ignore parse errors while typing
        // console.error(err);
    }
});

document.getElementById('btn-classify-confirm')?.addEventListener('click', async () => {

    // Parse JSON from textarea
    const text = document.getElementById('classify-result').value;
    let parsedData = null;

    try {
        // Find JSON object or array
        const objStart = text.indexOf('{');
        const objEnd = text.lastIndexOf('}');
        if (objStart >= 0 && objEnd > objStart) {
            parsedData = JSON.parse(text.substring(objStart, objEnd + 1));
        }
    } catch (e) {
        alert('JSON 파싱 오류: ' + e.message);
        return;
    }

    if (!parsedData) {
        alert('처리할 데이터가 없습니다.');
        return;
    }

    // Use shared parsed result if available, otherwise re-parse
    let parsed = lastParsedClassification;
    if (!parsed) {
        parsed = parseClassificationResult(text);
    }

    if (!parsed || !parsed.valid) {
        alert('results 배열이 비어있거나 유효하지 않습니다.');
        return;
    }

    console.log('[Classify] Using parsed result:', parsed);

    const { targetTasks, duplicateIds, targetClassified, duplicateCount } = parsed;

    if (!confirm(`분류: ${targetClassified}건, 중복 폐기: ${duplicateCount}건을 처리하시겠습니까?`)) return;

    showLoading();
    let successCount = 0;
    let processedDuplicateCount = 0;

    try {
        // 1. Process classifications (only target articles)
        const classifyPromises = targetTasks.map(task =>
            fetchAPI('/api/board/classify', {
                method: 'POST',
                body: JSON.stringify({
                    article_id: task.article_id,
                    category: task.category
                })
            })
        );

        // 2. Process duplicates (reject with duplicate flag)
        const duplicatePromises = duplicateIds.length > 0
            ? [fetchAPI('/api/publisher/reject', {
                method: 'POST',
                body: JSON.stringify({
                    article_ids: duplicateIds,
                    reason: 'duplicate'
                })
            })]
            : [];

        const [classifyResults, ...duplicateResults] = await Promise.all([
            Promise.all(classifyPromises),
            ...duplicatePromises
        ]);

        successCount = classifyResults.filter(r => r.success).length;
        processedDuplicateCount = duplicateResults.length > 0 && duplicateResults[0]?.success
            ? duplicateIds.length : 0;

    } catch (e) {
        console.error(e);
        alert('일괄 처리 중 오류 발생: ' + e.message);
    }

    hideLoading();
    alert(`분류 완료: ${successCount}건 / 중복 폐기: ${processedDuplicateCount}건`);
    closeModal('classification-modal');
    if (typeof loadBoardData === 'function') loadBoardData(); // Refresh
});

document.getElementById('btn-classify-cancel')?.addEventListener('click', () => {
    document.getElementById('classification-modal').classList.add('hidden');
});

// Export to Global Scope
window.openClassifyModal = openClassifyModal;
window.toggleEditionContext = toggleEditionContext;
window.generateBatchPrompt = generateBatchPrompt;
window.renderScoreBreakdown = renderScoreBreakdown;
