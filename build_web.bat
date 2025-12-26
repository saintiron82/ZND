@echo off
chcp 65001 > nul
cd /d "%~dp0web"

echo ========================================
echo  ZND Web Build with Auto Version Bump
echo ========================================

:: 현재 버전 읽기
for /f "tokens=2 delims=:," %%a in ('findstr "\"version\"" package.json') do (
    set RAW_VERSION=%%a
    goto :found_version
)
:found_version

:: 따옴표와 공백 제거
set "RAW_VERSION=%RAW_VERSION:"=%"
set "RAW_VERSION=%RAW_VERSION: =%"

echo 현재 버전: %RAW_VERSION%

:: 빌드 실행
echo [*] npm run build 실행 중...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [✗] 빌드 실패! 버전이 업데이트되지 않았습니다.
    pause
    exit /b %ERRORLEVEL%
)

:: 빌드 성공 시 버전 업데이트 진행

:: 버전 분리 (x.y.z)
for /f "tokens=1,2,3 delims=." %%a in ("%RAW_VERSION%") do (
    set MAJOR=%%a
    set MINOR=%%b
    set PATCH=%%c
)

:: Patch 버전 +1
set /a NEW_PATCH=%PATCH%+1
set NEW_VERSION=%MAJOR%.%MINOR%.%NEW_PATCH%

echo.
echo [✓] 빌드 성공! 버전을 업데이트합니다...
echo %RAW_VERSION% → %NEW_VERSION%

:: package.json 업데이트 (BOM 없이 UTF-8로 저장)
powershell -Command "$c=(Get-Content 'package.json' -Raw) -replace '\"version\": \"%RAW_VERSION%\"', '\"version\": \"%NEW_VERSION%\"'; [System.IO.File]::WriteAllText('package.json', $c, (New-Object System.Text.UTF8Encoding $False))"

echo.
echo [✓] package.json 업데이트 완료
echo ========================================
echo  완료! v%NEW_VERSION%
echo ========================================

pause
