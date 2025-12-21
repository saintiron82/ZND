@echo off
chcp 65001 >nul
echo ========================================
echo   ZND 발행 기사 정리 도구
echo ========================================
echo.
echo   Noise 기준: ZES 4.0 이상
echo   (발행 기준: ZES 4.0 미만만 유효)
echo.
echo ========================================
echo.
echo [1] 시뮬레이션 (어떤 기사가 삭제될지 확인)
echo [2] 실제 삭제 실행
echo [3] 발행 날짜 목록 보기
echo [4] 특정 날짜만 시뮬레이션
echo [5] 특정 날짜만 삭제
echo [Q] 종료
echo.
echo ========================================

set /p choice="선택하세요 (1-5, Q): "

cd /d "%~dp0\desk"

if "%choice%"=="1" (
    echo.
    echo [시뮬레이션 모드] 삭제될 기사 목록 확인...
    echo.
    python scripts\cleanup_published.py
    goto end
)

if "%choice%"=="2" (
    echo.
    echo ⚠️  경고: 실제로 파일이 삭제됩니다!
    set /p confirm="정말 삭제하시겠습니까? (Y/N): "
    if /i "%confirm%"=="Y" (
        echo.
        python scripts\cleanup_published.py --force
    ) else (
        echo 취소되었습니다.
    )
    goto end
)

if "%choice%"=="3" (
    echo.
    python scripts\cleanup_published.py --list
    goto end
)

if "%choice%"=="4" (
    echo.
    set /p target_date="날짜를 입력하세요 (예: 2025-12-10): "
    echo.
    python scripts\cleanup_published.py --date %target_date%
    goto end
)

if "%choice%"=="5" (
    echo.
    set /p target_date="날짜를 입력하세요 (예: 2025-12-10): "
    echo.
    echo ⚠️  경고: %target_date% 날짜의 Noise 기사가 삭제됩니다!
    set /p confirm="정말 삭제하시겠습니까? (Y/N): "
    if /i "%confirm%"=="Y" (
        echo.
        python scripts\cleanup_published.py --force --date %target_date%
    ) else (
        echo 취소되었습니다.
    )
    goto end
)

if /i "%choice%"=="Q" (
    exit /b 0
)

echo.
echo 잘못된 선택입니다.

:end
echo.
pause
