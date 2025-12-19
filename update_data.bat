@echo off
echo ========================================
echo   ZND Data Update - release/data 브랜치
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 현재 브랜치 저장...
for /f "tokens=*" %%a in ('git branch --show-current') do set CURRENT_BRANCH=%%a
echo     현재 브랜치: %CURRENT_BRANCH%
echo.

echo [2/3] release/data 브랜치에서 데이터 가져오기...
git fetch origin release/data
if %ERRORLEVEL% neq 0 (
    echo [ERROR] release/data 브랜치를 찾을 수 없습니다.
    echo         먼저 release/data 브랜치를 생성해주세요.
    pause
    exit /b 1
)

echo.
echo [3/3] supplier/data 폴더 업데이트...
git checkout origin/release/data -- supplier/data/
if %ERRORLEVEL% neq 0 (
    echo [ERROR] 데이터 업데이트 실패
    pause
    exit /b 1
)

echo.
echo ========================================
echo   데이터 업데이트 완료!
echo ========================================
echo   현재 브랜치: %CURRENT_BRANCH% (유지됨)
echo   업데이트된 폴더: supplier/data/
echo ========================================
echo.
pause
