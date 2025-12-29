/**
 * ZND Desk - Collection Logic
 * 즉시 수집 기능
 */

/**
 * 6. Immediate Collection
 * "즉시 수집" 버튼 핸들러 - 독립 프로그래스바 표시
 */
async function collectNow() {
    const btn = document.getElementById('btn-collect');
    if (!btn) return;

    if (!confirm('지금 즉시 뉴스 수집을 시작하시겠습니까? (약 1분 소요)')) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ 수집중...';
    btn.disabled = true;

    // Show floating progress bar
    showCollectionProgress();

    try {
        const res = await fetch('/api/collector/run', { method: 'POST' });
        const data = await res.json();

        hideCollectionProgress();

        if (data.success) {
            // Show success message briefly
            showCollectionResult(`✅ 수집 완료! (수집: ${data.collected}건, 추출: ${data.extracted}건)`);

            // Auto-refresh list after 1 second
            setTimeout(() => {
                if (typeof loadArticles === 'function') {
                    loadArticles(); // Board
                } else if (typeof PublisherV2 !== 'undefined' && PublisherV2.loadDraftArticles) {
                    PublisherV2.loadDraftArticles(); // Publisher
                } else if (window.location.pathname === '/board' || window.location.pathname === '/analyzer') {
                    window.location.reload();
                }
            }, 1000);
        } else {
            showCollectionResult('❌ 수집 실패: ' + data.error, true);
        }
    } catch (e) {
        hideCollectionProgress();
        showCollectionResult('❌ 네트워크 오류: ' + e.message, true);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * 수집 프로그래스 모달 표시 (블로킹 팝업)
 */
function showCollectionProgress(step = 'collect') {
    // Remove existing if any
    hideCollectionProgress();

    const steps = {
        'collect': { icon: '📥', title: '뉴스 수집 중...', desc: '대상 사이트에서 기사를 가져오고 있습니다' },
        'analyze': { icon: '🤖', title: 'AI 분석 중...', desc: '기사 내용을 분석하고 있습니다' },
        'save': { icon: '💾', title: '저장 중...', desc: '데이터를 저장하고 있습니다' },
    };

    const current = steps[step] || steps['collect'];

    const overlay = document.createElement('div');
    overlay.id = 'collection-progress-overlay';
    overlay.innerHTML = `
        <div class="collection-modal-backdrop"></div>
        <div class="collection-modal-box">
            <div class="modal-icon">${current.icon}</div>
            <div class="modal-title">${current.title}</div>
            <div class="modal-progress-bar">
                <div class="modal-progress-fill"></div>
            </div>
            <div class="modal-desc">${current.desc}</div>
            <div class="modal-steps">
                <span class="${step === 'collect' ? 'active' : ''}">📥 수집</span>
                <span class="arrow">→</span>
                <span class="${step === 'analyze' ? 'active' : ''}">🤖 분석</span>
                <span class="arrow">→</span>
                <span class="${step === 'save' ? 'active' : ''}">💾 저장</span>
            </div>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.id = 'collection-progress-style';
    style.textContent = `
        #collection-progress-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .collection-modal-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
        }
        .collection-modal-box {
            position: relative;
            background: var(--bg-secondary, #1a1a2e);
            border: 2px solid var(--accent-primary, #00d4ff);
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            box-shadow: 0 8px 40px rgba(0, 212, 255, 0.4);
            animation: modalFadeIn 0.3s ease;
        }
        @keyframes modalFadeIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .modal-icon {
            font-size: 48px;
            margin-bottom: 16px;
            animation: bounce 1s ease infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .modal-title {
            font-size: 24px;
            font-weight: bold;
            color: var(--text-primary, #fff);
            margin-bottom: 20px;
        }
        .modal-progress-bar {
            width: 300px;
            height: 8px;
            background: var(--bg-tertiary, #252545);
            border-radius: 4px;
            overflow: hidden;
            margin: 0 auto 16px;
        }
        .modal-progress-fill {
            width: 30%;
            height: 100%;
            background: linear-gradient(90deg, var(--accent-primary, #00d4ff), var(--accent-secondary, #ff6b6b));
            border-radius: 4px;
            animation: progressPulse 1.5s ease-in-out infinite;
        }
        @keyframes progressPulse {
            0% { width: 20%; }
            50% { width: 80%; }
            100% { width: 20%; }
        }
        .modal-desc {
            font-size: 14px;
            color: var(--text-secondary, #888);
            margin-bottom: 24px;
        }
        .modal-steps {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 12px;
            color: var(--text-tertiary, #666);
        }
        .modal-steps span.active {
            color: var(--accent-primary, #00d4ff);
            font-weight: bold;
        }
        .modal-steps .arrow {
            color: var(--text-tertiary, #666);
        }
        .collection-result-modal {
            position: relative;
            background: var(--bg-secondary, #1a1a2e);
            border: 2px solid var(--accent-success, #00ff88);
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            box-shadow: 0 8px 40px rgba(0, 255, 136, 0.4);
            animation: modalFadeIn 0.3s ease;
        }
        .collection-result-modal.error {
            border-color: var(--accent-error, #ff4444);
            box-shadow: 0 8px 40px rgba(255, 68, 68, 0.4);
        }
        .result-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .result-title {
            font-size: 20px;
            font-weight: bold;
            color: var(--text-primary, #fff);
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);
}

/**
 * 수집 단계 업데이트
 */
function updateCollectionStep(step) {
    showCollectionProgress(step);
}

/**
 * 수집 프로그래스바 숨김
 */
function hideCollectionProgress() {
    const overlay = document.getElementById('collection-progress-overlay');
    const style = document.getElementById('collection-progress-style');
    if (overlay) overlay.remove();
    if (style) style.remove();
}

/**
 * 수집 결과 표시 (3초 후 자동 숨김)
 */
function showCollectionResult(message, isError = false) {
    hideCollectionProgress();

    const icon = isError ? '❌' : '✅';

    const overlay = document.createElement('div');
    overlay.id = 'collection-progress-overlay';
    overlay.innerHTML = `
        <div class="collection-modal-backdrop"></div>
        <div class="collection-result-modal ${isError ? 'error' : ''}">
            <div class="result-icon">${icon}</div>
            <div class="result-title">${message}</div>
        </div>
    `;

    // Reuse styles from progress modal (already in head if shown before)
    if (!document.getElementById('collection-progress-style')) {
        const style = document.createElement('style');
        style.id = 'collection-progress-style';
        style.textContent = `
            #collection-progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .collection-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
            }
            .collection-result-modal {
                position: relative;
                background: var(--bg-secondary, #1a1a2e);
                border: 2px solid var(--accent-success, #00ff88);
                border-radius: 16px;
                padding: 40px 60px;
                text-align: center;
                box-shadow: 0 8px 40px rgba(0, 255, 136, 0.4);
                animation: modalFadeIn 0.3s ease;
            }
            @keyframes modalFadeIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .collection-result-modal.error {
                border-color: var(--accent-error, #ff4444);
                box-shadow: 0 8px 40px rgba(255, 68, 68, 0.4);
            }
            .result-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            .result-title {
                font-size: 18px;
                font-weight: bold;
                color: var(--text-primary, #fff);
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    // Auto-hide after 2 seconds
    setTimeout(() => {
        hideCollectionProgress();
    }, 2000);
}

// Export to Global Scope
window.collectNow = collectNow;
window.showCollectionProgress = showCollectionProgress;
window.updateCollectionStep = updateCollectionStep;
window.hideCollectionProgress = hideCollectionProgress;
window.showCollectionResult = showCollectionResult;
