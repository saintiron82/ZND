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

function renderScheduleList(schedules) {
    const container = document.getElementById('schedule-list');
    if (!container) return;

    container.innerHTML = schedules.map(s => `
        <div class="schedule-item" data-id="${s.id}">
            <label class="toggle">
                <input type="checkbox" class="schedule-toggle" ${s.enabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <span class="schedule-name">${s.name}</span>
            <code class="schedule-cron">${s.cron}</code>
            <button class="btn btn-sm btn-delete" onclick="deleteSchedule('${s.id}')">🗑️</button>
        </div>
    `).join('');

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
        const name = prompt('스케줄 이름:');
        const cron = prompt('Cron 표현식 (예: 30 6 * * *):');
        if (name && cron) {
            await fetchAPI('/api/settings/schedules', {
                method: 'POST',
                body: JSON.stringify({ name, cron })
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
