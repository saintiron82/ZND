@echo off
REM ============================================
REM sync_push.bat - 캐시 + 히스토리 자동 동기화
REM 오후 11시 자동 실행용
REM ============================================

cd /d "%~dp0"
cd ..

echo [%date% %time%] 캐시 동기화 시작... >> logs\sync.log

python scripts\sync.py push --all >> logs\sync.log 2>&1

if %errorlevel% equ 0 (
    echo [%date% %time%] 동기화 완료 >> logs\sync.log
) else (
    echo [%date% %time%] 동기화 실패 (에러코드: %errorlevel%) >> logs\sync.log
)
