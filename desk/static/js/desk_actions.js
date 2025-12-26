/* ============================================
 * desk_actions.js
 * ============================================ */

async function deletePermanent(filename, date) {
    if (!confirm('🔥 정말로 영구 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.\nDB에서도 "거부(Rejected)" 처리되어 다시 크롤링되지 않습니다.')) return;

    try {
        const res = await fetch('/api/desk/delete_permanent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, date })
        });
        const data = await res.json();
        if (data.success) {
            // alert('✅ 영구 삭제되었습니다.'); // Too noisy? Maybe just refresh
            loadDesk();
        } else {
            alert('❌ 삭제 실패: ' + data.error);
        }
    } catch (e) {
        alert('❌ 오류: ' + e.message);
    }
}
async function restoreArticle(filename) {
    try {
        const res = await fetch('/api/desk/restore_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: [filename] })
        });
        const data = await res.json();
        if (data.success) {
            loadDesk();
        } else {
            alert('❌ 복구 실패: ' + data.error);
        }
    } catch (e) {
        alert('❌ 오류: ' + e.message);
    }
}
async function restoreSelected() {
    const checkboxes = document.querySelectorAll('.article-checkbox:checked');
    const selectedFiles = Array.from(checkboxes).map(cb => cb.dataset.filename);

    if (selectedFiles.length === 0) {
        alert('복구할 기사를 선택해주세요.');
        return;
    }

    if (!confirm(`♻️ ${selectedFiles.length}개 기사를 복구하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch('/api/desk/restore_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: selectedFiles, date: selectedDate })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 복구 완료!\n\n${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
// [NEW] Helper to check if item is qualified for publishing
function isQualifiedForPublish(item) {
    if (!item.category) return false;
    // Add other checks if needed
    return true;
}

function publishAll() {
    const selected = getSelectedItems();
    if (selected.length === 0) {
        alert('발행할 기사를 선택해주세요.');
        return;
    }

    // [MODIFIED] Validate Classification
    const selectedUrls = new Set(selected.map(s => s.value));
    const selectedObjs = deskData.filter(d => selectedUrls.has(d.url));

    const unqualified = selectedObjs.filter(d => !d.category);

    if (unqualified.length > 0) {
        alert(`⚠️ 다음 ${unqualified.length}개 기사는 '분류(Category)'가 완료되지 않았습니다.\n\n분류를 먼저 완료해주세요.`);
        return;
    }

    // Modal open logic...
    const modal = document.getElementById('publishModal');
    // ... rest of logic
    document.getElementById('publishSelectedCount').textContent = selected.length;
    modal.classList.add('show');
}
function updateCutline() {
    const isValue = parseFloat(document.getElementById('cutlineIS').value);
    const zsValue = parseFloat(document.getElementById('cutlineZS').value);

    document.getElementById('cutlineISValue').textContent = isValue.toFixed(1);
    document.getElementById('cutlineZSValue').textContent = zsValue.toFixed(1);

    // 대상 기사별 조건 저장 (IS/ZS 중 어떤 조건에 해당하는지)
    const targetIS = new Set(); // IS < value 조건 해당
    const targetZS = new Set(); // ZS > value 조건 해당
    let targetCount = 0;

    deskData.forEach(a => {
        if (a.rejected || a.published || a.dedup_status === 'duplicate') return;
        const is = a.impact_score || 0;
        const zs = a.zero_echo_score || 0;
        const articleId = a.article_id || a.filename?.replace('.json', '') || '';

        let isTarget = false;
        if (is < isValue) {
            targetIS.add(articleId);
            isTarget = true;
        }
        if (zs > zsValue) {
            targetZS.add(articleId);
            isTarget = true;
        }
        if (isTarget) targetCount++;
    });

    // 모든 점수 배지에서 cutline-target 클래스 제거 후, 해당 조건에만 추가
    document.querySelectorAll('.score-badge.score-is').forEach(badge => {
        const badgeId = badge.dataset.articleId || '';
        if (targetIS.has(badgeId)) {
            badge.classList.add('cutline-target');
        } else {
            badge.classList.remove('cutline-target');
        }
    });
    document.querySelectorAll('.score-badge.score-zs').forEach(badge => {
        const badgeId = badge.dataset.articleId || '';
        if (targetZS.has(badgeId)) {
            badge.classList.add('cutline-target');
        } else {
            badge.classList.remove('cutline-target');
        }
    });

    const preview = document.getElementById('cutlinePreview');
    const countSpan = document.getElementById('cutlineCount');
    if (preview && countSpan) {
        if (targetCount > 0) {
            preview.style.display = 'block';
            countSpan.textContent = targetCount;
        } else {
            preview.style.display = 'none';
        }
    }
}
async function applyCutline() {
    const isValue = parseFloat(document.getElementById('cutlineIS').value);
    const zsValue = parseFloat(document.getElementById('cutlineZS').value);

    // 대상 기사 찾기
    const targets = deskData.filter(a => {
        if (a.rejected || a.published || a.dedup_status === 'duplicate') return false;
        const is = a.impact_score || 0;
        const zs = a.zero_echo_score || 0;
        return is < isValue || zs > zsValue;
    });

    if (targets.length === 0) {
        alert('커트라인 대상이 없습니다.');
        return;
    }

    if (!confirm(`⚠️ ${targets.length}개 기사를 커트라인 처리(거부)하시겠습니까?\n\n조건:\n• IS < ${isValue.toFixed(1)}\n• ZS > ${zsValue.toFixed(1)}`)) {
        return;
    }

    try {
        const filenames = targets.map(a => a.filename);
        const response = await fetch('/api/desk/reject_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames })
        });

        const result = await response.json();
        if (result.success) {
            alert(`✅ ${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
function resetCutline() {
    document.getElementById('cutlineIS').value = 3.0;
    document.getElementById('cutlineZS').value = 7.0;
    updateCutline();
}
async function unpublishSelected() {
    // 발행된 기사의 체크박스는 disabled지만, 특별히 발행됨 상태 기사들을 찾음
    const publishedFiles = deskData
        .filter(a => a.published)
        .map(a => a.filename);

    if (publishedFiles.length === 0) {
        alert('발행된 기사가 없습니다.');
        return;
    }

    const choice = confirm(
        `🔄 발행 취소\n\n` +
        `발행된 ${publishedFiles.length}개 기사를 발행 취소하시겠습니까?\n\n` +
        `- 데이터 파일이 삭제됩니다\n` +
        `- 캐시 상태가 리셋됩니다\n` +
        `- 재발행이 가능해집니다`
    );

    if (!choice) return;

    // Firestore 삭제 옵션
    const deleteFirestore = confirm(
        `🔥 Firestore에서도 삭제하시겠습니까?\n\n` +
        `- 예: DB에서도 삭제 (완전 취소)\n` +
        `- 아니오: 로컬 파일만 삭제`
    );

    try {
        const response = await fetch('/api/desk/unpublish_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filenames: publishedFiles,
                delete_firestore: deleteFirestore
            })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 발행 취소 완료!\n\n${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패\n\n${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
async function rejectSelected() {
    const checkboxes = document.querySelectorAll('.article-checkbox:checked');
    const selectedFiles = Array.from(checkboxes).map(cb => cb.dataset.filename);

    if (selectedFiles.length === 0) {
        alert('무시할 기사를 선택해주세요.');
        return;
    }

    if (!confirm(`${selectedFiles.length}개 기사를 무시 처리하시겠습니까?`)) {
        return;
    }

    try {
        const response = await fetch('/api/desk/reject_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: selectedFiles })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 무시 처리 완료!\n\n${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패\n\n${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
async function deleteSelected() {
    const checkboxes = document.querySelectorAll('.article-checkbox:checked');
    const selectedFiles = Array.from(checkboxes).map(cb => cb.dataset.filename);

    if (selectedFiles.length === 0) {
        alert('선택된 기사가 없습니다.');
        return;
    }

    // [TRASH LOGIC]
    // If NOT in Trash Mode -> Move to Trash (Reject)
    // If IN Trash Mode -> Permanent Delete
    if (!isTrashMode) {
        if (!confirm(`🗑️ ${selectedFiles.length}개 기사를 휴지통으로 이동하시겠습니까?`)) {
            return;
        }
        try {
            const response = await fetch('/api/desk/reject_selected', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filenames: selectedFiles })
            });
            const result = await response.json();
            if (result.success) {
                alert(`✅ 휴지통으로 이동되었습니다.`);
                loadDesk();
            } else {
                alert(`❌ 이동 실패: ${result.error}`);
            }
        } catch (error) {
            alert(`❌ 오류: ${error.message}`);
        }
    } else {
        // PERMANENT DELETE
        if (!confirm(`🔥 ${selectedFiles.length}개 기사를 '영구 삭제' 하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!`)) {
            return;
        }
        try {
            let deleted = 0;
            // Loop for parallel delete
            const promises = selectedFiles.map(filename =>
                fetch('/api/desk/delete_file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: filename, date: selectedDate })
                }).then(res => res.json())
            );

            const results = await Promise.all(promises);
            deleted = results.filter(r => r.success).length;

            alert(`✅ 영구 삭제 완료: ${deleted}개`);
            loadDesk();
        } catch (error) {
            alert(`❌ 오류: ${error.message}`);
        }
    }
}
async function deleteFromDB() {
    const checkboxes = document.querySelectorAll('.article-checkbox:checked');
    const selectedArticles = Array.from(checkboxes).map(cb => {
        const filename = cb.dataset.filename;
        const article = deskData.find(a => a.filename === filename);
        return article ? { filename, url: article.url, article_id: article.article_id } : null;
    }).filter(a => a);

    if (selectedArticles.length === 0) {
        alert('DB에서 삭제할 기사를 선택해주세요.');
        return;
    }

    const confirmMsg = `🔥 경고: Firestore DB에서 ${selectedArticles.length}개 기사를 완전히 삭제합니다!\n\n` +
        `이 작업은 되돌릴 수 없으며, 로컬 파일은 유지됩니다.\n\n` +
        `정말 삭제하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch('/api/desk/delete_from_db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles: selectedArticles })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ DB 삭제 완료!\n\n삭제: ${result.deleted}개, 실패: ${result.failed}개`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
async function rejectCurrentArticle() {
    if (!currentDetailFilename) return;

    if (!confirm(`⚠️ "${currentDetailFilename}"을(를) 무시 처리하시겠습니까?`)) return;

    try {
        const response = await fetch('/api/desk/reject_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: [currentDetailFilename] })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 무시 처리 완료!`);
            closeModal();
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
async function restoreCurrentArticle() {
    if (!currentDetailFilename) return;

    if (!confirm(`♻️ "${currentDetailFilename}"을(를) 복구하시겠습니까?`)) return;

    try {
        const response = await fetch('/api/desk/restore_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: [currentDetailFilename], date: selectedDate })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 복구 완료!`);
            closeModal();
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
async function deleteCurrentArticle() {
    if (!currentDetailFilename) return;

    if (!confirm(`⚠️ "${currentDetailFilename}"을(를) 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!`)) return;

    try {
        const response = await fetch('/api/desk/delete_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: currentDetailFilename, date: selectedDate })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 삭제 완료!`);
            closeModal();
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
async function clearCacheByDate(date) {
    if (!date) {
        alert('날짜를 먼저 선택해주세요.');
        return;
    }

    if (!confirm(`⚠️ [${date}] 캐시를 삭제하시겠습니까?\n\n캐시 삭제 후에는 해당 날짜의 기사를 다시 분석해야 합니다.`)) {
        return;
    }

    try {
        const response = await fetch('/api/desk/clear_cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: date })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ 캐시 삭제 완료!\n\n${result.message}`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}
async function rejectGroup(date) {
    const checkboxes = document.querySelectorAll(`.article-checkbox[data-date="${date}"]`);
    // Only Visible
    const filenames = Array.from(checkboxes).map(cb => cb.dataset.filename);

    if (filenames.length === 0) {
        alert('거부할 가능한 기사가 이 그룹에 없습니다 (필터링됨?).');
        return;
    }

    if (!confirm(`⚠️ [${date}] 그룹의 ${filenames.length}개 기사를 모두 '거부(Reject)' 처리하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    try {
        document.getElementById('articleGrid').innerHTML = '<div class="loading">일괄 거부 처리 중...</div>';

        const response = await fetch('/api/desk/reject_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filenames: filenames
            })
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ 처리 완료: ${result.message}`);
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

async function deleteDuplicateArticles(date) {
    // [MODIFIED] Bulk Move Duplicates to Trash
    let targets = [];
    if (date === 'all' || !date) {
        targets = deskData.filter(a => a.dedup_status === 'duplicate');
    } else {
        targets = deskData.filter(a => a.dedup_status === 'duplicate' && (a.date_folder === date || a.crawled_at?.startsWith(date)));
    }

    if (targets.length === 0) {
        alert('삭제할 중복 기사가 없습니다.');
        return;
    }

    if (!confirm(`🗑️ ${targets.length}개의 중복 기사를 휴지통으로 이동하시겠습니까?`)) {
        return;
    }

    try {
        const filenames = targets.map(a => a.filename);

        // Use Reject (Soft Delete)
        const response = await fetch('/api/desk/reject_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: filenames })
        });
        const result = await response.json();

        if (result.success) {
            alert(`✅ ${result.message}\n(중복 기사가 휴지통으로 이동되었습니다)`);
            loadDesk();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ 오류: ${error.message}`);
    }
}

async function emptyTrash() {
    if (!isTrashMode) {
        alert('휴지통 모드에서만 사용할 수 있습니다.');
        return;
    }

    // Get all items in current view (Trash view shows rejected items)
    const trashItems = deskData.filter(a => a.rejected);

    if (trashItems.length === 0) {
        alert('휴지통이 비어있습니다.');
        return;
    }

    if (!confirm(`🔥 휴지통을 비우시겠습니까? (총 ${trashItems.length}개)\n\n모든 '거부됨(Rejected)' 기사가 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다!`)) {
        return;
    }

    try {
        let deleted = 0;
        document.getElementById('articleGrid').innerHTML = '<div class="loading">휴지통 비우는 중... (대량 삭제는 시간이 걸릴 수 있습니다)</div>';

        // Loop is safer for file deletions
        for (const item of trashItems) {
            const response = await fetch('/api/desk/delete_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: item.filename, date: item.date_folder || selectedDate })
            });
            const res = await response.json();
            if (res.success) deleted++;
        }

        alert(`✅ 휴지통 비우기 완료: ${deleted}개 삭제됨.`);
        loadDesk();
    } catch (e) {
        alert(`❌ 오류: ${e.message}`);
        loadDesk();
    }
}
