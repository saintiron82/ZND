@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   ZeroEcho Daily - Cache Clear Tool
echo ========================================
echo.

set "DATA_DIR=%~dp0desk\data"

if "%1"=="" (
    echo 사용법:
    echo   clear_cache.bat [날짜 또는 옵션]
    echo.
    echo 예시:
    echo   clear_cache.bat 2025-12-10    - 특정 날짜 캐시 삭제
    echo   clear_cache.bat today         - 오늘 날짜 캐시 삭제
    echo   clear_cache.bat all           - 모든 날짜 캐시 삭제
    echo.
    goto :eof
)

if /I "%1"=="today" (
    for /f %%i in ('powershell -command "Get-Date -Format 'yyyy-MM-dd'"') do set "TARGET_DATE=%%i"
) else if /I "%1"=="all" (
    echo 모든 daily_summary.json 파일을 삭제합니다...
    for /r "%DATA_DIR%" %%f in (daily_summary.json) do (
        if exist "%%f" (
            del "%%f"
            echo   삭제됨: %%f
        )
    )
    echo.
    echo ✅ 모든 캐시 삭제 완료!
    goto :eof
) else (
    set "TARGET_DATE=%1"
)

set "CACHE_FILE=%DATA_DIR%\%TARGET_DATE%\daily_summary.json"

if exist "%CACHE_FILE%" (
    del "%CACHE_FILE%"
    echo ✅ 캐시 삭제 완료: %CACHE_FILE%
) else (
    echo ⚠️ 캐시 파일이 존재하지 않습니다: %CACHE_FILE%
)

echo.
