/**
 * ZND Desk - Column Menu Utilities
 * 칸반 보드 컬럼별 액션 메뉴 제어
 */

function toggleColumnMenu(state) {
    const menu = document.getElementById(`menu-${state}`);
    if (!menu) return;

    // Close all other menus first
    document.querySelectorAll('.column-menu').forEach(m => {
        if (m.id !== `menu-${state}`) m.classList.add('hidden');
    });

    menu.classList.toggle('hidden');
}

async function columnAction(state, action) {
    // Close menu
    document.getElementById(`menu-${state}`)?.classList.add('hidden');

    // Confirmation
    const actionLabels = {
        'analyze-all': '전체 분석',
        'classify-all': '전체 분류',
        'publish-all': '전체 발행',
        'release-all': '전체 공개',
        'reject-all': '전체 폐기',
        'empty-trash': '휴지통 비우기',
        'restore-all': '전체 복원',
        'recalculate-scores': '점수 재계산'
    };

    if (!confirm(`[${state}] 열의 "${actionLabels[action]}" 작업을 실행하시겠습니까?`)) {
        return;
    }

    showLoading();
    try {
        const result = await fetchAPI('/api/board/column-action', {
            method: 'POST',
            body: JSON.stringify({ state, action })
        });

        if (result.success) {
            alert(`완료: ${result.message || action}`);
            if (typeof loadBoardData === 'function') {
                await loadBoardData();
            } else {
                window.location.reload();
            }
        } else {
            alert('오류: ' + (result.error || '알 수 없는 오류'));
        }
    } catch (err) {
        alert('요청 실패: ' + err.message);
    } finally {
        hideLoading();
    }
}

// Export to Global Scope
window.toggleColumnMenu = toggleColumnMenu;
window.columnAction = columnAction;
