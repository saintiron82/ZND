/* ============================================
 * desk_dedup.js
 * ============================================ */

async function resetDedupByDate(date) {
    if (!confirm(`⚠️ [${date}] 기사들의 중복/카테고리 정보를 초기화하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch('/api/desk/reset_dedup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: date })
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ [${date}] 중복 초기화 완료!\n\n${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
function toggleDateGroup(date) {
    let selector = `.article-checkbox[data-date="${date}"]`;

    // [MODIFIED] If date is 'all' (Global View), select ALL checkboxes regardless of date
    if (date === 'all' || !date) {
        selector = '.article-checkbox';
    }

    const checkboxes = document.querySelectorAll(selector);
    if (checkboxes.length === 0) return; // Nothing to toggle

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateSelectedCount();
}
function clearDateGroup(date) {
    let selector = `.article-checkbox[data-date="${date}"]`;
    if (date === 'all' || !date) {
        selector = '.article-checkbox';
    }
    const checkboxes = document.querySelectorAll(selector);
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectedCount();
}
async function recalculateGroup(date) {
    // [MODIFIED] Use global deskData to include ALL loaded articles (Visible on screen)
    // regardless of status (e.g. duplicates, published, etc. if loaded).
    // This replaces querySelectorAll which missed items without checkboxes.
    if (!deskData || deskData.length === 0) {
        alert('재계산할 기사가 없습니다.');
        return;
    }

    const filenames = deskData.map(a => a.filename);

    const schemaSelect = document.getElementById(`schemaSelect-${date}`);
    const selectedSchema = schemaSelect ? schemaSelect.value : null;

    if (filenames.length === 0) {
        alert('재계산할 가능한 기사가 이 그룹에 없습니다 (필터링됨?).');
        return;
    }

    let msg = `[${date}] 그룹의 ${filenames.length}개 기사 점수를 재계산하시겠습니까?`;
    if (selectedSchema) msg += `\n(적용 스키마: ${selectedSchema})`;

    if (!confirm(msg)) {
        return;
    }

    try {
        document.getElementById('articleGrid').innerHTML = '<div class="loading">점수 재계산 중...</div>';

        const response = await fetch('/api/desk/recalculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: date,  // [FIX] 선택된 날짜 사용 (하드코딩 제거)
                filenames: filenames,
                schema_version: selectedSchema
            })
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ 재계산 완료: ${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
            loadDesk();
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
        loadDesk();
    }
}
async function openDedupModal(date) {
    currentDedupDate = date;
    const modal = document.getElementById('dedupModal');
    const dateLabel = document.getElementById('dedupDateLabel');
    const contentEl = document.getElementById('dedupJsonContent');
    const pasteArea = document.getElementById('dedupPasteArea');

    dateLabel.textContent = `날짜: ${date}`;
    pasteArea.value = '';
    contentEl.textContent = '로딩 중...';
    modal.classList.add('active');

    // 카테고리 목록 로드
    let categories = [];
    try {
        const catResp = await fetch('/api/dedup_categories');
        const catData = await catResp.json();
        categories = catData.categories || [];
    } catch (e) {
        console.error('카테고리 로드 실패:', e);
        categories = ["AI/ML", "Cloud/Infra", "Security", "Business", "Hardware", "Software", "Research", "Policy", "Startup", "Other"];
    }

    // 해당 날짜의 기사들 필터링 (대기 중인 것만)
    // [FIX] date가 'all'이면 날짜 필터링 없이 전체 기사 처리
    currentDedupArticles = deskData.filter(article => {
        // 거부됨/발행됨은 제외
        if (article.rejected || article.published) return false;

        // 'all'이면 모든 날짜 포함
        if (date === 'all') return true;

        // 특정 날짜 선택 시 해당 날짜만 필터링
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

    // 간결한 JSON 생성 (Priority = IS×0.5 + IS/ZS 기준 내림차순 정렬)
    const articles = currentDedupArticles
        .map(article => {
            const is = article.impact_score || 0;
            const zs = article.zero_echo_score || 0.1; // 0으로 나누기 방지
            const priority = (is * 0.5) + (is / zs);
            return {
                id: article.article_id || article.filename?.replace('.json', '') || '-',
                title: article.title_ko || article.title || '',
                summary: article.summary || '',
                IS: is.toFixed(1),
                ZS: zs.toFixed(1),
                Priority: priority.toFixed(2)
            };
        })
        .sort((a, b) => parseFloat(b.Priority) - parseFloat(a.Priority));

    // categories + articles 구조로 출력
    const dedupOutput = {
        categories: categories,
        articles: articles
    };

    contentEl.textContent = JSON.stringify(dedupOutput, null, 2);

    // 복사 버튼 초기화
    const copyBtn = document.getElementById('btnCopyDedup');
    copyBtn.textContent = '📋 복사';
    copyBtn.classList.remove('copied');
}
function closeDedupModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('dedupModal').classList.remove('active');
    currentDedupDate = null;
    currentDedupArticles = [];
}
async function copyDedupJson() {
    const contentEl = document.getElementById('dedupJsonContent');
    const copyBtn = document.getElementById('btnCopyDedup');

    try {
        await navigator.clipboard.writeText(contentEl.textContent);
        copyBtn.textContent = '✅ 복사됨!';
        copyBtn.classList.add('copied');

        setTimeout(() => {
            copyBtn.textContent = '📋 복사';
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = contentEl.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        copyBtn.textContent = '✅ 복사됨!';
        copyBtn.classList.add('copied');

        setTimeout(() => {
            copyBtn.textContent = '📋 복사';
            copyBtn.classList.remove('copied');
        }, 2000);
    }
}
async function applyDedupResult() {
    const pasteArea = document.getElementById('dedupPasteArea');
    const rawInput = pasteArea.value.trim();

    if (!rawInput) {
        alert('붙여넣기 영역이 비어있습니다.');
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(rawInput);
    } catch (e) {
        alert('JSON 파싱 오류: ' + e.message);
        return;
    }

    // 새 형식: { results: [{ category, article_ids }, ...] }
    // 구 형식: [{ id, category }, ...]
    let survivorIds = new Set();
    let categoryMap = {}; // article_id -> category

    if (parsed.results && Array.isArray(parsed.results)) {
        // 새 형식 처리
        parsed.results.forEach(group => {
            const category = group.category || 'Unknown';
            const ids = group.article_ids || [];
            ids.forEach(id => {
                survivorIds.add(id);
                categoryMap[id] = category;
            });
        });
    } else if (Array.isArray(parsed)) {
        // 구 형식 호환 처리
        parsed.forEach(item => {
            const id = item.id || item.article_id;
            if (id) {
                survivorIds.add(id);
                if (item.category) categoryMap[id] = item.category;
            }
        });
    } else {
        alert('지원하지 않는 형식입니다.');
        return;
    }

    if (survivorIds.size === 0) {
        alert('살아남은 기사 ID가 없습니다.');
        return;
    }

    // 보낸 기사(currentDedupArticles)만 카테고리와 중복 정보 반영
    let selectedCount = 0;
    let duplicateCount = 0;

    currentDedupArticles.forEach(article => {
        // article_id를 JSON에서 보낸 것과 동일한 방식으로 추출
        // 우선순위: article.article_id > filename에서 추출
        const articleId = article.article_id || (() => {
            const parts = article.filename?.replace('.json', '').split('_') || [];
            return parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
        })();

        console.log(`[Dedup] ID 매칭: articleId="${articleId}", survivorIds has it: ${survivorIds.has(articleId)}`);

        if (survivorIds.has(articleId)) {
            article._dedup_category = categoryMap[articleId] || null;
            article._dedup_duplicate = false;
            selectedCount++;
        } else {
            article._dedup_duplicate = true;
            article._dedup_category = null;
            duplicateCount++;
        }

        // Priority 계산
        const is = article.impact_score || 0;
        const zs = article.zero_echo_score || 0.1;
        article._priority = (is * 0.5) + (is / zs);
    });

    // 서버에 카테고리 정보 저장
    try {
        // 보낸 기사 ID 목록 추출
        const sentIds = currentDedupArticles.map(a =>
            a.article_id || (() => {
                const parts = a.filename?.replace('.json', '').split('_') || [];
                return parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
            })()
        );

        const saveResp = await fetch('/api/desk/update_categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: currentDedupDate,
                results: parsed.results || [],
                sent_ids: sentIds  // LLM에 보낸 기사 ID 목록
            })
        });
        const saveResult = await saveResp.json();
        if (saveResult.success) {
            console.log(`📂 카테고리 저장 완료: ${saveResult.message}`);
        } else {
            console.error('카테고리 저장 실패:', saveResult.error);
        }
    } catch (e) {
        console.error('카테고리 저장 API 오류:', e);
    }

    // 날짜 저장 (closeDedupModal에서 null로 초기화되기 전에)
    const targetDate = currentDedupDate;

    // 모달 닫기
    closeDedupModal();

    // 서버에서 다시 불러와서 통일된 렌더링 사용
    await loadDesk();

    // 결과 메시지
    let message = `✅ 중복 제거 완료!\n\n선택됨: ${selectedCount}개\n중복 처리: ${duplicateCount}개`;

    // 카테고리별 개수 표시
    if (parsed.results) {
        const categoryStats = parsed.results.map(g => `${g.category}: ${g.article_ids?.length || 0}개`).join('\n');
        message += `\n\n📂 카테고리별 배분:\n${categoryStats}`;
    }

    alert(message);
}
