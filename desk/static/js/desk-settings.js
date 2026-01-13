/**
 * ZND Desk - Settings Popup Logic
 * 설정 팝업 (스케줄, Discord, Firebase 사용량)
 */

// =============================================================================
// Settings Popup
// =============================================================================

function initSettingsPopup() {
    // 설정 버튼 클릭 시 팝업 열기
    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
        openSettingsPopup();
    });
}

async function openSettingsPopup() {
    // 팝업 HTML 동적 생성
    let popup = document.getElementById('settings-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'settings-popup';
        popup.className = 'modal';
        popup.innerHTML = `
            <div class="modal-content settings-modal">
                <div class="modal-header">
                    <h2>📅 스케줄</h2>
                    <button id="btn-close-settings" class="btn-close">×</button>
                </div>
                
                <!-- 즉시 수집 섹션 -->
                <section class="settings-section">
                    <h3>🚀 즉시 수집</h3>
                    <div class="instant-collect">
                        <button id="btn-collect-now" class="btn btn-primary btn-lg">📡 지금 즉시 수집하기</button>
                        <span id="collect-status" class="collect-status"></span>
                    </div>
                </section>
                
                <!-- 스케줄 섹션 -->
                <section class="settings-section">
                    <h3>⏰ 예약 스케줄</h3>
                    <div id="schedule-list" class="schedule-list"></div>
                    <button id="btn-add-schedule" class="btn btn-sm">+ 스케줄 추가</button>
                </section>
                
                <!-- Discord 섹션 -->
                <section class="settings-section">
                    <h3>💬 Discord 알림</h3>
                    <div class="discord-status">
                        <span>상태: </span>
                        <span id="discord-status" class="status-badge">확인 중...</span>
                        <button id="btn-test-discord" class="btn btn-sm">📤 테스트 전송</button>
                    </div>
                </section>
                
                <!-- Firebase 사용량 -->
                <section class="settings-section">
                    <h3>🔥 Firebase 사용량</h3>
                    <div class="stats-row">
                        <span>읽기: <strong id="stat-reads">-</strong></span>
                        <span>쓰기: <strong id="stat-writes">-</strong></span>
                        <span>삭제: <strong id="stat-deletes">-</strong></span>
                        <button id="btn-reset-stats" class="btn btn-sm">리셋</button>
                    </div>
                </section>
            </div>
        `;
        document.body.appendChild(popup);

        // 팝업 스타일 추가
        addSettingsStyles();

        // 이벤트 설정
        setupSettingsEvents();
    }

    popup.classList.remove('hidden');
    await loadSettingsData();
}

async function loadSettingsData() {
    // 스케줄 로드
    try {
        const result = await fetchAPI('/api/settings/schedules');
        if (result.success) {
            renderScheduleList(result.schedules);
        }
    } catch (e) {
        console.error('Failed to load schedules:', e);
    }

    // Discord 상태 로드
    try {
        const result = await fetchAPI('/api/settings/discord');
        const statusEl = document.getElementById('discord-status');
        if (result.success && result.webhook_url) {
            statusEl.textContent = '✅ 설정됨';
            statusEl.classList.add('status-ok');
        } else {
            statusEl.textContent = '❌ 미설정';
            statusEl.classList.add('status-error');
        }
    } catch (e) {
        const statusEl = document.getElementById('discord-status');
        statusEl.textContent = '⚠️ 확인 실패';
    }

    // Firebase 사용량 로드
    try {
        const result = await fetchAPI('/api/settings/firebase-stats');
        if (result.success) {
            document.getElementById('stat-reads').textContent = result.stats.reads;
            document.getElementById('stat-writes').textContent = result.stats.writes;
            document.getElementById('stat-deletes').textContent = result.stats.deletes;
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

// KST <-> UTC 변환 함수
function kstToUtcCron(hour, minute) {
    let utcHour = hour - 9;
    if (utcHour < 0) utcHour += 24;
    return `${minute} ${utcHour} * * *`;
}

function utcCronToKst(cron) {
    const parts = cron.split(' ');
    if (parts.length < 2) return { hour: 0, minute: 0, display: '00:00' };
    const minute = parseInt(parts[0]) || 0;
    const utcHour = parseInt(parts[1]) || 0;
    let kstHour = (utcHour + 9) % 24;
    return {
        hour: kstHour,
        minute: minute,
        display: `${String(kstHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    };
}

function renderScheduleList(schedules) {
    const container = document.getElementById('schedule-list');
    if (!container) return;

    container.innerHTML = schedules.map(s => {
        const kst = utcCronToKst(s.cron);
        const discordIcon = s.discord ? '🔔' : '🔕';
        const phasesStr = (s.phases || ['collect', 'extract']).join(', ');
        const phasesBadge = getPhaseBadge(s.phases || ['collect', 'extract']);
        return `
        <div class="schedule-item" data-id="${s.id}" data-cron="${s.cron}" data-discord="${s.discord || false}">
            <label class="toggle">
                <input type="checkbox" class="schedule-toggle" ${s.enabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <div class="schedule-info">
                <span class="schedule-name">${s.name}</span>
                <span class="schedule-phases">${phasesBadge}</span>
            </div>
            <span class="schedule-time">${kst.display} KST</span>
            <span class="schedule-discord" title="디스코드 알림">${discordIcon}</span>
            <button class="btn btn-sm btn-edit" onclick="editSchedule('${s.id}')">✏️</button>
            <button class="btn btn-sm btn-delete" onclick="deleteSchedule('${s.id}')">🗑️</button>
        </div>
    `;
    }).join('');

    // Toggle events
    container.querySelectorAll('.schedule-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const item = e.target.closest('.schedule-item');
            const id = item.dataset.id;
            await fetchAPI(`/api/settings/schedules/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ enabled: e.target.checked })
            });
        });
    });
}

function setupSettingsEvents() {
    // 닫기
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
        document.getElementById('settings-popup')?.classList.add('hidden');
    });

    // 배경 클릭으로 닫기
    document.getElementById('settings-popup')?.addEventListener('click', (e) => {
        if (e.target.id === 'settings-popup') {
            e.target.classList.add('hidden');
        }
    });

    // 즉시 수집하기
    document.getElementById('btn-collect-now')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-collect-now');
        const statusEl = document.getElementById('collect-status');

        btn.disabled = true;
        btn.textContent = '⏳ 수집 중...';
        statusEl.textContent = '';

        try {
            const result = await fetchAPI('/api/collector/run', { method: 'POST' });
            if (result.success) {
                statusEl.textContent = `✅ 완료! ${result.collected || 0}개 수집 + ${result.extracted || 0}개 추출`;
                statusEl.className = 'collect-status status-ok';
            } else {
                statusEl.textContent = `❌ 실패: ${result.error || result.message || '알 수 없는 오류'}`;
                statusEl.className = 'collect-status status-error';
            }
        } catch (e) {
            statusEl.textContent = `❌ 오류: ${e.message || '네트워크 오류'}`;
            statusEl.className = 'collect-status status-error';
        } finally {
            btn.disabled = false;
            btn.textContent = '📡 지금 즉시 수집하기';
        }
    });

    // 스케줄 추가
    document.getElementById('btn-add-schedule')?.addEventListener('click', async () => {
        const result = await showScheduleDialog();
        if (result) {
            await fetchAPI('/api/settings/schedules', {
                method: 'POST',
                body: JSON.stringify(result)
            });
            await loadSettingsData();
        }
    });

    // Discord 테스트
    document.getElementById('btn-test-discord')?.addEventListener('click', async () => {
        const result = await fetchAPI('/api/settings/discord/test', { method: 'POST' });
        alert(result.success ? '✅ 전송 성공!' : '❌ 전송 실패: ' + result.error);
    });

    // 통계 리셋
    document.getElementById('btn-reset-stats')?.addEventListener('click', async () => {
        await fetchAPI('/api/settings/firebase-stats/reset', { method: 'POST' });
        await loadSettingsData();
    });
}

async function deleteSchedule(id) {
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return;
    await fetchAPI(`/api/settings/schedules/${id}`, { method: 'DELETE' });
    await loadSettingsData();
}

function addSettingsStyles() {
    if (document.getElementById('settings-styles')) return;

    const style = document.createElement('style');
    style.id = 'settings-styles';
    style.textContent = `
        .settings-modal {
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        .btn-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--text-secondary);
        }
        .settings-section {
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: var(--bg-card);
            border-radius: 6px;
        }
        .settings-section h3 {
            margin-bottom: 0.75rem;
            font-size: 1rem;
        }
        .schedule-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            background: var(--bg-primary);
            border-radius: 4px;
            margin-bottom: 0.5rem;
        }
        .schedule-cron {
            font-size: 0.8rem;
            background: var(--bg-secondary);
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            margin-left: auto;
        }
        .toggle {
            position: relative;
            width: 40px;
            height: 20px;
            flex-shrink: 0;
        }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle .slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--border-color);
            border-radius: 20px;
            transition: 0.3s;
        }
        .toggle .slider:before {
            position: absolute;
            content: "";
            height: 16px; width: 16px;
            left: 2px; bottom: 2px;
            background: white;
            border-radius: 50%;
            transition: 0.3s;
        }
        .toggle input:checked + .slider { background: var(--accent-success); }
        .toggle input:checked + .slider:before { transform: translateX(20px); }
        .stats-row {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        .btn-sm {
            padding: 0.3rem 0.6rem;
            font-size: 0.8rem;
        }
        .form-group {
            margin-bottom: 0.75rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.3rem;
            font-size: 0.9rem;
        }
        .form-group .input {
            width: 100%;
        }
        .discord-status {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.85rem;
        }
        .status-ok { color: var(--accent-success); }
        .status-error { color: var(--accent-danger); }
        .instant-collect {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
        }
        .btn-lg {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
        }
        .collect-status {
            font-size: 0.9rem;
        }
    `;
    document.head.appendChild(style);
}

// 모든 페이지에서 설정 팝업 초기화
document.addEventListener('DOMContentLoaded', () => {
    initSettingsPopup();
});

// Export to Global Scope
window.initSettingsPopup = initSettingsPopup;
window.openSettingsPopup = openSettingsPopup;
window.deleteSchedule = deleteSchedule;
window.editSchedule = editSchedule;

// =============================================================================
// Helper Functions for Phases
// =============================================================================

const AVAILABLE_PHASES = [
    { id: 'collect', name: '수집', icon: '📡' },
    { id: 'extract', name: '추출', icon: '📄' },
    { id: 'analyze', name: '분석', icon: '🤖', disabled: true },
    { id: 'score', name: '점수', icon: '📊', disabled: true },
    { id: 'classify', name: '분류', icon: '🏷️' },
    { id: 'reject', name: '배제', icon: '🗑️' },
    { id: 'publish', name: '발행', icon: '📤' },
    { id: 'release', name: '릴리즈', icon: '🚀', disabled: true }
];

function getPhaseBadge(phases) {
    if (!phases || phases.length === 0) return '<span class="phase-badge">수집만</span>';

    const icons = phases.map(p => {
        const phase = AVAILABLE_PHASES.find(ap => ap.id === p);
        return phase ? phase.icon : '❓';
    });

    // 간단한 프리셋 이름
    const phasesStr = phases.join(',');
    if (phasesStr === 'collect,extract') return '<span class="phase-badge phase-collect">📡 수집</span>';
    if (phasesStr === 'classify,reject,publish') return '<span class="phase-badge phase-publish">📤 발행</span>';
    if (phases.includes('publish')) return '<span class="phase-badge phase-publish">' + icons.join('') + '</span>';

    return '<span class="phase-badge">' + icons.join('') + '</span>';
}

async function showScheduleDialog(existingData = null) {
    return new Promise((resolve) => {
        const isEdit = !!existingData;
        const name = existingData?.name || '';
        const cron = existingData?.cron || '30 21 * * *'; // 06:30 KST = 21:30 UTC
        const kst = utcCronToKst(cron);
        const phases = existingData?.phases || ['collect', 'extract'];
        const description = existingData?.description || '';
        const discord = existingData?.discord || false;

        // 시간 선택 옵션 생성
        let hourOptions = '';
        for (let i = 0; i < 24; i++) {
            hourOptions += `<option value="${i}" ${kst.hour === i ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`;
        }
        let minuteOptions = '';
        for (let i = 0; i < 60; i++) {
            minuteOptions += `<option value="${i}" ${kst.minute === i ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`;
        }

        // 다이얼로그 HTML
        const dialog = document.createElement('div');
        dialog.className = 'modal schedule-dialog';
        dialog.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <h3>${isEdit ? '스케줄 수정' : '새 스케줄 추가'}</h3>
                <div class="form-group">
                    <label>이름</label>
                    <input type="text" id="sched-name" class="input" value="${name}" placeholder="오전 수집">
                </div>
                <div class="form-group">
                    <label>실행 시간 (KST)</label>
                    <div class="time-picker">
                        <select id="sched-hour" class="input time-select">${hourOptions}</select>
                        <span class="time-separator">:</span>
                        <select id="sched-minute" class="input time-select">${minuteOptions}</select>
                        <span class="time-label">KST</span>
                    </div>
                    <small style="color:var(--text-secondary)">한국 시간 기준으로 입력하면 UTC로 자동 변환됩니다.</small>
                </div>
                <div class="form-group">
                    <label class="toggle-label">
                        <span class="toggle">
                            <input type="checkbox" id="sched-discord" ${discord ? 'checked' : ''}>
                            <span class="slider"></span>
                        </span>
                        <span>디스코드 알림</span>
                    </label>
                </div>
                <div class="form-group">
                    <label>실행 단계</label>
                    <div class="phase-selector" id="phase-selector">
                        ${AVAILABLE_PHASES.map(p => `
                            <label class="phase-option ${p.disabled ? 'disabled' : ''}" title="${p.disabled ? '준비 중' : p.name}">
                                <input type="checkbox" value="${p.id}" 
                                    ${phases.includes(p.id) ? 'checked' : ''} 
                                    ${p.disabled ? 'disabled' : ''}>
                                <span>${p.icon} ${p.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label>설명 (선택)</label>
                    <input type="text" id="sched-desc" class="input" value="${description}" placeholder="메모">
                </div>
                <div class="dialog-buttons">
                    <button class="btn" id="sched-cancel">취소</button>
                    <button class="btn btn-primary" id="sched-save">저장</button>
                </div>
            </div>
        `;

        // 스타일 추가
        if (!document.getElementById('schedule-dialog-styles')) {
            const style = document.createElement('style');
            style.id = 'schedule-dialog-styles';
            style.textContent = `
                .schedule-dialog .modal-content { padding: 1.5rem; }
                .phase-selector { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
                .phase-option { 
                    display: flex; align-items: center; gap: 0.3rem;
                    padding: 0.4rem 0.6rem; border-radius: 4px;
                    background: var(--bg-secondary); cursor: pointer;
                    border: 1px solid var(--border-color);
                }
                .phase-option:has(input:checked) { 
                    background: var(--accent-primary); 
                    border-color: var(--accent-primary);
                    color: white;
                }
                .phase-option.disabled { opacity: 0.5; cursor: not-allowed; }
                .phase-option input { display: none; }
                .dialog-buttons { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
                .schedule-info { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
                .schedule-phases { font-size: 0.75rem; }
                .phase-badge { 
                    padding: 0.15rem 0.4rem; border-radius: 3px;
                    background: var(--bg-secondary); font-size: 0.75rem;
                }
                .phase-badge.phase-collect { background: #3498db22; color: #3498db; }
                .phase-badge.phase-publish { background: #2ecc7122; color: #2ecc71; }
                .time-picker { display: flex; align-items: center; gap: 0.5rem; }
                .time-select { width: 70px !important; text-align: center; }
                .time-separator { font-size: 1.3rem; font-weight: bold; }
                .time-label { color: var(--text-secondary); font-size: 0.9rem; }
                .toggle-label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; }
                .schedule-time { 
                    background: var(--accent-primary); color: white;
                    padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;
                }
                .schedule-discord { font-size: 1rem; }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(dialog);

        // 이벤트
        dialog.querySelector('#sched-cancel').onclick = () => {
            dialog.remove();
            resolve(null);
        };

        dialog.querySelector('#sched-save').onclick = () => {
            const selectedPhases = Array.from(dialog.querySelectorAll('#phase-selector input:checked'))
                .map(cb => cb.value);

            const hour = parseInt(dialog.querySelector('#sched-hour').value);
            const minute = parseInt(dialog.querySelector('#sched-minute').value);
            const cronUtc = kstToUtcCron(hour, minute);

            const result = {
                name: dialog.querySelector('#sched-name').value || '새 스케줄',
                cron: cronUtc,
                phases: selectedPhases.length > 0 ? selectedPhases : ['collect', 'extract'],
                description: dialog.querySelector('#sched-desc').value,
                discord: dialog.querySelector('#sched-discord').checked
            };

            dialog.remove();
            resolve(result);
        };

        // 배경 클릭으로 닫기
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                dialog.remove();
                resolve(null);
            }
        };
    });
}

async function editSchedule(id) {
    // 현재 스케줄 데이터 가져오기
    const result = await fetchAPI('/api/settings/schedules');
    if (!result.success) return;

    const schedule = result.schedules.find(s => s.id === id);
    if (!schedule) return;

    const updated = await showScheduleDialog(schedule);
    if (updated) {
        await fetchAPI(`/api/settings/schedules/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updated)
        });
        await loadSettingsData();
    }
}
