/**
 * ZND Desk - Raw Viewer Logic
 * 기사 원문(Raw JSON) 보기 모달
 */

/**
 * 7. Raw Viewer
 */
async function showArticleRaw(articleId) {
    if (!articleId) return;

    showLoading();
    try {
        const res = await fetchAPI(`/api/article/${articleId}/raw`);
        if (res.success) {
            const article = res.article;
            const container = document.getElementById('raw-content');
            container.innerHTML = ''; // Clear previous

            // Set ID for reject button
            const rejectBtn = document.getElementById('btn-raw-reject');
            if (rejectBtn) rejectBtn.dataset.id = articleId;

            // [NEW] Set ID for restore button and toggle visibility based on state
            const restoreBtn = document.getElementById('btn-raw-restore');
            if (restoreBtn) {
                restoreBtn.dataset.id = articleId;
                if (article._header?.state === 'REJECTED') {
                    restoreBtn.classList.remove('hidden');
                    rejectBtn?.classList.add('hidden'); // 이미 폐기된 상태면 폐기 버튼 숨김
                } else {
                    restoreBtn.classList.add('hidden');
                    rejectBtn?.classList.remove('hidden');
                }
            }

            // Set ID for classify button
            const classifyBtn = document.getElementById('btn-raw-classify');
            if (classifyBtn) {
                classifyBtn.onclick = () => openClassifyModal(article);
            }

            // Set URL for open button
            const openBtn = document.getElementById('btn-raw-open');
            if (openBtn) {
                const url = article._original?.url;
                openBtn.dataset.url = url || '';
                openBtn.disabled = !url;
            }

            // Display Time Info + Rejection Status
            const timeInfoEl = document.getElementById('raw-time-info');
            if (timeInfoEl) {
                const originalTime = article._original?.published_at ? new Date(article._original.published_at).toLocaleString('ko-KR') : '정보 없음';
                const crawledTime = article._original?.crawled_at ? new Date(article._original.crawled_at).toLocaleString('ko-KR') :
                    (article._header?.created_at ? new Date(article._header.created_at).toLocaleString('ko-KR') : '정보 없음');
                const updatedTime = article._header?.updated_at ? new Date(article._header.updated_at).toLocaleString('ko-KR') : '정보 없음';

                // 폐기 상태 표시
                let rejectionHtml = '';
                if (article._header?.state === 'REJECTED') {
                    const reason = article._rejection?.reason || 'unknown';
                    const reasonMap = {
                        'cutline': '✂️ 커트라인',
                        'duplicate': '🔄 중복',
                        'manual': '👤 수동 폐기',
                        'unknown': '⛔ 폐기됨'
                    };
                    const rejectedAt = article._rejection?.rejected_at ? new Date(article._rejection.rejected_at).toLocaleString('ko-KR') : '';
                    rejectionHtml = `
                    <div style="background: #ff4444; padding: 8px; border-radius: 4px; margin-top: 10px;">
                        <strong>🗑️ 폐기 사유:</strong> ${reasonMap[reason] || `⛔ ${reason}`}
                        ${rejectedAt ? `<span style="margin-left: 15px; opacity: 0.8;">📅 ${rejectedAt}</span>` : ''}
                    </div>`;
                }

                timeInfoEl.innerHTML = `
                    <div>
                        <strong style="color: #4cd137;">📅 기사 원본:</strong> <span>${originalTime}</span>
                    </div>
                    <div>
                        <strong style="color: #00a8ff;">🕷️ 수집:</strong> <span>${crawledTime}</span>
                    </div>
                    <div>
                        <strong style="color: #fbc531;">⚡ 최근 변경:</strong> <span>${updatedTime}</span>
                    </div>
                    ${rejectionHtml}
                `;
            }

            // [NEW] Score Breakdown Visualization
            const scoreHtml = renderScoreBreakdown(article);
            if (scoreHtml) {
                container.innerHTML += scoreHtml;
            }

            const sections = [
                { key: '_header', label: '1. Header (Meta)', cls: 'section-header' },
                { key: '_original', label: '2. Original (Source)', cls: 'section-original' },
                { key: '_analysis', label: '3. Analysis (AI)', cls: 'section-analysis' },
                { key: '_classification', label: '4. Classification (Desk)', cls: 'section-classification' },
                { key: '_rejection', label: '5. Rejection (폐기)', cls: 'section-rejection' },
                { key: '_publication', label: '6. Publication (Output)', cls: 'section-publication' }
            ];

            // Render defined sections first
            sections.forEach(sec => {
                if (article[sec.key]) {
                    const html = `
                        <div class="json-section ${sec.cls}">
                            <span class="json-key">${sec.label}</span>
                            <div class="json-value">${JSON.stringify(article[sec.key], null, 2)}</div>
                        </div>
                    `;
                    container.innerHTML += html;
                }
            });

            // Render others
            const usedKeys = new Set(sections.map(s => s.key));
            Object.keys(article).forEach(key => {
                if (!usedKeys.has(key)) {
                    const html = `
                        <div class="json-section">
                            <span class="json-key">${key}</span>
                            <div class="json-value">${JSON.stringify(article[key], null, 2)}</div>
                        </div>
                    `;
                    container.innerHTML += html;
                }
            });

            document.getElementById('raw-viewer-modal').classList.remove('hidden');
        } else {
            alert('기사 정보를 불러오지 못했습니다: ' + res.error);
        }
    } catch (e) {
        alert('오류 발생: ' + e.message);
    } finally {
        hideLoading();
    }
}

// Close Raw Viewer
document.getElementById('btn-raw-close')?.addEventListener('click', () => {
    document.getElementById('raw-viewer-modal').classList.add('hidden');
});

document.getElementById('btn-raw-reject')?.addEventListener('click', async (e) => {
    const articleId = e.target.dataset.id;
    if (!articleId) return;

    if (!confirm('이 기사를 정말 폐기(Trash)하시겠습니까?')) return;

    showLoading();
    try {
        const result = await fetchAPI('/api/board/move', {
            method: 'POST',
            body: JSON.stringify({
                article_id: articleId,
                to_state: ArticleState.REJECTED
            })
        });

        if (result.success) {
            alert('폐기되었습니다.');
            document.getElementById('raw-viewer-modal').classList.add('hidden');
            if (typeof loadBoardData === 'function') loadBoardData();
        } else {
            alert('폐기 실패: ' + result.error);
        }
    } catch (e) {
        alert('오류: ' + e.message);
    } finally {
        hideLoading();
    }
});

// [NEW] Restore Article (복원)
document.getElementById('btn-raw-restore')?.addEventListener('click', async (e) => {
    const articleId = e.target.dataset.id;
    if (!articleId) return;

    if (!confirm('이 기사를 복원하시겠습니까?')) return;

    showLoading();
    try {
        const result = await fetchAPI('/api/publisher/restore', {
            method: 'POST',
            body: JSON.stringify({ article_ids: [articleId] })
        });

        if (result.success && result.results?.[0]?.success) {
            const restoredTo = result.results[0].restored_to || 'CLASSIFIED';
            alert(`복원 완료 (${restoredTo} 상태로)`);
            document.getElementById('raw-viewer-modal').classList.add('hidden');
            if (typeof loadBoardData === 'function') loadBoardData();
            if (typeof PublisherV2 !== 'undefined' && PublisherV2.loadDraftArticles) PublisherV2.loadDraftArticles();
        } else {
            alert('복원 실패: ' + (result.error || result.results?.[0]?.error || 'Unknown'));
        }
    } catch (e) {
        alert('오류: ' + e.message);
    } finally {
        hideLoading();
    }
});

document.getElementById('btn-raw-open')?.addEventListener('click', (e) => {
    const url = e.target.dataset.url;
    if (url) {
        window.open(url, '_blank');
    } else {
        alert('이 기사에는 원본 URL 정보가 없습니다.');
    }
});

// Reset Publication (발행 초기화) - 잘못된 발행 상태 복구
document.getElementById('btn-raw-reset-pub')?.addEventListener('click', async () => {
    const rejectBtn = document.getElementById('btn-raw-reject');
    const articleId = rejectBtn?.dataset?.id;
    if (!articleId) return;

    if (!confirm('이 기사의 발행 정보를 초기화하고 CLASSIFIED 상태로 되돌리시겠습니까?\n\n(잘못된 발행 상태를 복구할 때 사용합니다)')) return;

    showLoading();
    try {
        const result = await fetchAPI(`/api/article/${articleId}/reset-publication`, {
            method: 'POST'
        });

        if (result.success) {
            alert('발행 정보가 초기화되었습니다. 다시 발행할 수 있습니다.');
            document.getElementById('raw-viewer-modal').classList.add('hidden');
            if (typeof loadBoardData === 'function') loadBoardData();
            if (typeof PublisherV2 !== 'undefined' && PublisherV2.loadDraftArticles) PublisherV2.loadDraftArticles();
        } else {
            alert('초기화 실패: ' + result.error);
        }
    } catch (e) {
        alert('오류: ' + e.message);
    } finally {
        hideLoading();
    }
});

document.getElementById('raw-viewer-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'raw-viewer-modal') {
        e.target.classList.add('hidden');
    }
});

// Export to Global Scope
window.showArticleRaw = showArticleRaw;
