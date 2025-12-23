/* ============================================
 * desk_ui.js
 * ============================================ */

function toggleTrashView() {
    const chk = document.getElementById('chkTrashView');
    isTrashMode = chk.checked;

    // UI Updates
    const header = document.querySelector('.header');
    const btnEmpty = document.getElementById('btnEmptyTrash');
    const btnReject = document.getElementById('btnRejectSelected');
    const btnRestore = document.getElementById('btnRestoreSelected');
    const btnDelete = document.getElementById('btnDeleteSelected');

    if (isTrashMode) {
        header.style.background = 'linear-gradient(135deg, #2c0b0e, #1a1a2e)'; // Reddish
        if (btnEmpty) btnEmpty.style.display = 'inline-block';
        if (btnReject) btnReject.style.display = 'none';
        if (btnRestore) btnRestore.style.display = 'inline-block'; // Show Restore in Trash
        if (btnDelete) {
            btnDelete.textContent = '🔥 영구 삭제';
            btnDelete.title = '선택한 항목을 영구적으로 삭제합니다';
            btnDelete.style.background = '#8b0000';
        }
    } else {
        header.style.background = '';
        if (btnEmpty) btnEmpty.style.display = 'none';
        if (btnReject) btnReject.style.display = 'inline-block';
        if (btnRestore) btnRestore.style.display = 'none';
        if (btnDelete) {
            btnDelete.textContent = '❌ 삭제';
            btnDelete.title = '휴지통으로 이동합니다';
            btnDelete.style.background = '#dc3545';
        }
    }

    loadDesk();
}
function toggleTimezone(tz) {
    curTimezone = tz;
    renderArticles();
}
function selectDate(date) {
    // 같은 날짜 클릭 시 선택 해제 (전체 표시)
    if (selectedDate === date) {
        selectedDate = null;
    } else {
        selectedDate = date;
    }

    // 기능 버튼 레이블 업데이트
    const dateLabel = document.getElementById('selectedDateLabel');
    if (selectedDate) {
        dateLabel.textContent = `📅 ${selectedDate}`;
    } else {
        dateLabel.textContent = '📅 날짜를 선택하세요';
    }

    renderArticles();
    updateDateProgress();
}
function scrollToDate(date) {
    // 해당 날짜 헤더로 스크롤
    const headers = document.querySelectorAll('h3');
    for (const h of headers) {
        if (h.textContent.includes(date)) {
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
        }
    }
}
async function showDetail(filename, date) {
    const modal = document.getElementById('detailModal');
    const titleEl = document.getElementById('modalTitle');
    const contentEl = document.getElementById('jsonContent');
    const btnRestore = document.getElementById('btnRestore');
    const btnReject = document.getElementById('btnReject');

    currentDetailFilename = filename; // 현재 파일명 저장
    titleEl.textContent = filename;
    contentEl.textContent = '로딩 중...';
    modal.classList.add('active');

    // 회차 선택 드롭다운 업데이트
    updateAssignIssueDropdown();

    try {
        let targetDate = date;
        if (!targetDate || targetDate === 'all') {
            // Fallback logic if date is missing
            if (selectedDate && selectedDate !== 'all') {
                targetDate = selectedDate;
            } else {
                const now = new Date();
                targetDate = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0');
            }
        }

        const response = await fetch(`/api/desk/file?date=${targetDate}&filename=${filename}`);
        const data = await response.json();

        if (data.error) {
            contentEl.textContent = `오류: ${data.error}`;
        } else {
            contentEl.textContent = JSON.stringify(data, null, 2);

            // 상태 정보 테이블 추가
            const statusInfo = `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #444; font-size: 0.9em; color: #888;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                        <h4 style="margin:0; color: #ccc;">ℹ️ 상태 정보 (Status Info)</h4>
                    </div>
                    
                    <details style="margin-bottom:15px; background:rgba(255,255,255,0.05); padding:8px; border-radius:4px;">
                        <summary style="cursor:pointer; color:#4ecdc4; font-size:0.85em;">❓ 각 상태가 무엇인가요? (도움말)</summary>
                        <ul style="margin:5px 0 0 20px; padding:0; font-size:0.8em; color:#aaa; line-height:1.6;">
                            <li><strong>Current Status</strong>: 현재 기사의 처리 단계 (예: <span style="color:#fff">ANALYZED/reviewed</span>=분석완료).</li>
                            <li><strong>DB Status</strong>: DB에 기록된 최종 운명 (예: <span style="color:#fff">ACCEPTED</span>=발행성공, <span style="color:#fff">REJECTED</span>=폐기).</li>
                            <li><strong>Workflow Flags</strong>:
                                <ul>
                                    <li>✅ <strong>Staged</strong>: Desk 대기열에 등록됨 (발행 대기).</li>
                                    <li>🚀 <strong>Published</strong>: 웹사이트에 실제 송출됨.</li>
                                    <li>🗑️ <strong>Rejected</strong>: 품질 미달로 버려짐.</li>
                                </ul>
                            </li>
                        </ul>
                    </details>

                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 4px; width: 120px;">Current Status:</td>
                            <td style="padding: 4px; color: #4ecdc4;">${data.status || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px;">DB Status:</td>
                            <td style="padding: 4px;">${data.db_status || (data.published ? 'ACCEPTED' : (data.rejected ? 'REJECTED' : '-'))}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px;">Workflow Flags:</td>
                            <td style="padding: 4px;">
                                ${data.saved ? '✅ Staged' : '⬜ Not Staged'} / 
                                ${data.published ? '🚀 Published' : '⬜ Not Published'} / 
                                ${data.rejected ? '🗑️ Rejected' : '⬜ Active'}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 4px;">Issue:</td>
                            <td style="padding: 4px; color: #ffc107;">${data.edition_name || data.publish_id || '미지정'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px;">Timestamps:</td>
                            <td style="padding: 4px; font-size: 0.85em;">
                                Crawled: ${data.crawled_at?.substring(0, 16) || '-'}<br>
                                Staged: ${data.staged_at?.substring(0, 16) || '-'}<br>
                                Published: ${data.published_at?.substring(0, 16) || '-'}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 4px;">File Location:</td>
                            <td style="padding: 4px; font-size: 0.85em;">${data.date_folder ? `cache/${data.date_folder}/${filename}` : 'Unknown'}</td>
                        </tr>
                    </table>
                </div>
            `;

            let statusDiv = document.getElementById('modalStatusInfo');
            if (!statusDiv) {
                statusDiv = document.createElement('div');
                statusDiv.id = 'modalStatusInfo';
                contentEl.parentNode.insertBefore(statusDiv, contentEl.nextSibling);
            }
            statusDiv.innerHTML = statusInfo;

            // 거부 상태에 따라 버튼 표시/숨김
            if (data.rejected) {
                btnRestore.style.display = 'inline-block';
                btnReject.style.display = 'none';
            } else {
                btnRestore.style.display = 'none';
                btnReject.style.display = 'inline-block';
            }

            // 현재 기사의 날짜 폴더 저장 (이동 시 사용)
            window.currentArticleDateFolder = data.date_folder || targetDate;
        }
    } catch (error) {
        contentEl.textContent = `로드 실패: ${error.message}`;
    }
}

// 회차 선택 드롭다운 업데이트
function updateAssignIssueDropdown() {
    const select = document.getElementById('assignIssueSelect');
    if (!select) return;

    // 기존 옵션 제거 (첫 번째 제외)
    while (select.options.length > 1) {
        select.remove(1);
    }

    // "새 회차로 발행" 옵션 추가
    const newOpt = document.createElement('option');
    newOpt.value = 'new';
    newOpt.textContent = '📑 새 회차로 발행';
    select.appendChild(newOpt);

    // 기존 회차 목록 추가
    if (availableIssues && availableIssues.length > 0) {
        availableIssues.forEach(issue => {
            const opt = document.createElement('option');
            opt.value = issue.id;
            opt.textContent = `📌 ${issue.edition_name}에 추가`;
            select.appendChild(opt);
        });
    }
}

// 현재 기사를 선택한 회차로 이동/발행
async function assignCurrentToIssue() {
    const select = document.getElementById('assignIssueSelect');
    const targetValue = select.value;

    if (!targetValue) {
        alert('회차를 선택해주세요.');
        return;
    }

    if (!currentDetailFilename) {
        alert('기사가 선택되지 않았습니다.');
        return;
    }

    const payload = {
        filenames: [currentDetailFilename],
        mode: targetValue === 'new' ? 'new' : 'append'
    };

    if (targetValue !== 'new') {
        payload.target_publish_id = targetValue;
    }

    try {
        const resp = await fetch('/api/desk/publish_selected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await resp.json();

        if (result.success) {
            alert(`✅ ${result.message}`);
            closeModal();
            await refreshIssueList();
            await loadDesk();
            await loadFirebaseStats();
        } else {
            alert(`❌ 실패: ${result.error}`);
        }
    } catch (e) {
        alert(`❌ 오류: ${e.message}`);
    }
}
function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('detailModal').classList.remove('active');
    // Clear the dynamically added status info when closing the modal
    const statusDiv = document.getElementById('modalStatusInfo');
    if (statusDiv) {
        statusDiv.remove();
    }
    currentDetailFilename = null;
}
function toggleCheck(event, filename) {
    event.stopPropagation();
}
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.article-checkbox:checked');
    const count = checkboxes.length;
    const btn = document.querySelector('.btn-publish');
    btn.textContent = count > 0 ? `🚀 선택 발행 (${count})` : '🚀 선택 발행';
}
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.article-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateSelectedCount();
}
