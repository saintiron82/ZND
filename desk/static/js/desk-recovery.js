/**
 * ZND Desk - Orphans Recovery
 * 발행 이력이 끊긴 기사를 찾아 복구하는 기능
 */

async function checkOrphans() {
    showLoading();
    try {
        const result = await fetchAPI('/api/board/orphans');

        if (result.success) {
            if (result.count === 0) {
                alert('✅ 발행이력없는 기사가 없습니다!');
            } else {
                const confirmed = confirm(
                    `🔧 발행이력없는 기사 ${result.count}개 발견\n\n` +
                    `발행대기(CLASSIFIED) 상태로 복구하시겠습니까?\n\n` +
                    `(유효한 발행 회차: ${result.valid_editions.length}개)`
                );

                if (confirmed) {
                    await recoverOrphans();
                }
            }
        } else {
            showError(result.error);
        }
    } catch (e) {
        showError(e.message);
    } finally {
        hideLoading();
    }
}

async function recoverOrphans() {
    showLoading();
    try {
        const result = await fetchAPI('/api/board/recover-orphans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recover_all: true })
        });

        if (result.success) {
            alert(`✅ ${result.recovered_count}개 기사 복구 완료!`);
            // loadBoardData는 global scope에 있어야 함 (desk-board.js 혹은 desk.js)
            if (typeof loadBoardData === 'function') {
                loadBoardData();
            } else {
                window.location.reload();
            }
        } else {
            showError(result.error);
        }
    } catch (e) {
        showError(e.message);
    } finally {
        hideLoading();
    }
}

// Export to Global Scope
window.checkOrphans = checkOrphans;
window.recoverOrphans = recoverOrphans;
