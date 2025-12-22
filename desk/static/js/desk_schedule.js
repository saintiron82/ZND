/* ============================================
 * desk_schedule.js
 * ============================================ */

                async function loadSchedules() {
                    try {
                        const resp = await fetch('/api/schedule');
                        const result = await resp.json();

                        const container = document.getElementById('scheduleList');
                        if (!result.success || !result.schedules || result.schedules.length === 0) {
                            container.innerHTML = '<div style="text-align: center; color: #666; padding: 10px; font-size: 0.85em;">스케줄 없음</div>';
                            return;
                        }

                        container.innerHTML = result.schedules.map(s => {
                            // cron에서 시간 추출 (분 시 * * *)
                            const parts = s.cron.split(' ');
                            const minute = parts[0] || '0';
                            const hour = parts[1] || '0';
                            const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

                            return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; margin-bottom: 8px; 
                                        background: ${s.enabled ? 'rgba(32,201,151,0.15)' : 'rgba(108,117,125,0.15)'}; 
                                        border-radius: 8px; border-left: 4px solid ${s.enabled ? '#20c997' : '#6c757d'};">
                                <div style="flex: 1;">
                                    <div style="font-size: 0.9em; font-weight: bold; color: ${s.enabled ? '#fff' : '#888'};">${s.name}</div>
                                    <div style="font-size: 1.1em; font-weight: bold; color: ${s.enabled ? '#20c997' : '#666'};">⏰ ${timeStr}</div>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="toggleSchedule('${s.id}')" 
                                            style="padding: 5px 10px; font-size: 0.8em; border: none; border-radius: 4px; cursor: pointer;
                                                   background: ${s.enabled ? '#28a745' : '#6c757d'}; color: white;">
                                        ${s.enabled ? 'ON' : 'OFF'}
                                    </button>
                                    <button onclick="editSchedule('${s.id}', '${s.name}', '${hour}', '${minute}')" 
                                            style="padding: 5px 10px; font-size: 0.8em; border: none; border-radius: 4px; cursor: pointer; background: #ffc107; color: #333;">✏️</button>
                                    <button onclick="deleteSchedule('${s.id}')" 
                                            style="padding: 5px 10px; font-size: 0.8em; border: none; border-radius: 4px; cursor: pointer; background: #dc3545; color: white;">🗑️</button>
                                </div>
                            </div>
                        `}).join('');
                    } catch (e) {
                        console.error('Schedule load failed:', e);
                    }
                }
                async function toggleSchedule(scheduleId) {
                    try {
                        const resp = await fetch(`/api/schedule/${scheduleId}/toggle`, { method: 'POST' });
                        const result = await resp.json();
                        if (result.success) {
                            loadSchedules();
                        } else {
                            alert('토글 실패: ' + result.error);
                        }
                    } catch (e) {
                        alert('오류: ' + e.message);
                    }
                }
                async function deleteSchedule(scheduleId) {
                    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return;
                    try {
                        const resp = await fetch(`/api/schedule/${scheduleId}`, { method: 'DELETE' });
                        const result = await resp.json();
                        if (result.success) {
                            loadSchedules();
                        } else {
                            alert('삭제 실패: ' + result.error);
                        }
                    } catch (e) {
                        alert('오류: ' + e.message);
                    }
                }
                function openSchedulePanel() {
                    document.getElementById('scheduleModal').classList.add('active');
                    loadSchedules();
                }
                function closeScheduleModal() {
                    document.getElementById('scheduleModal').classList.remove('active');
                }
                function openAddScheduleDialog() {
                    const name = prompt('스케줄 이름:', '새 스케줄');
                    if (!name) return;
                    const hour = prompt('시 (0-23):', '8');
                    if (hour === null) return;
                    const minute = prompt('분 (0-59):', '30');
                    if (minute === null) return;

                    const cron = `${minute} ${hour} * * *`;
                    addSchedule(name, cron);
                }
                function editSchedule(scheduleId, currentName, currentHour, currentMinute) {
                    const name = prompt('스케줄 이름:', currentName);
                    if (!name) return;
                    const hour = prompt('시 (0-23):', currentHour);
                    if (hour === null) return;
                    const minute = prompt('분 (0-59):', currentMinute);
                    if (minute === null) return;

                    const cron = `${minute} ${hour} * * *`;
                    updateSchedule(scheduleId, name, cron);
                }
                async function runCrawlNow() {
                    if (!confirm('지금 바로 자동 크롤링을 실행하시겠습니까?')) return;
                    try {
                        const resp = await fetch('/api/schedule/run_now', { method: 'POST' });
                        const result = await resp.json();
                        if (result.success) {
                            alert('✅ ' + result.message);
                        } else {
                            alert('실행 실패: ' + result.error);
                        }
                    } catch (e) {
                        alert('오류: ' + e.message);
                    }
                }
