@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title ZED 재배포 도구

:: 스크립트 디렉토리로 이동
cd /d "%~dp0"

echo ============================================
echo           ZED 재배포 도구
echo ============================================
echo.

:: Git 브랜치 이름 입력 받기
set /p BRANCH_NAME="배포할 Git 브랜치 이름을 입력하세요: "

if "%BRANCH_NAME%"=="" (
    echo [오류] 브랜치 이름이 입력되지 않았습니다!
    pause
    exit /b 1
)

echo.
echo [정보] 입력된 브랜치: %BRANCH_NAME%
echo.

:: 빌드 옵션 선택
set /p DO_BUILD="npm 빌드를 수행하시겠습니까? (Y/N, 기본값: N): "
if /i "%DO_BUILD%"=="" set DO_BUILD=N

echo.

:: 확인 프롬프트
echo ============================================
echo   브랜치: %BRANCH_NAME%
echo   빌드: %DO_BUILD%
echo ============================================
set /p CONFIRM="이 설정으로 재배포를 진행하시겠습니까? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo [취소] 재배포가 취소되었습니다.
    pause
    exit /b 0
)

echo.
echo ============================================
echo [1/4] PM2 서버 중지 중...
echo ============================================

:: PM2로 관리되는 앱들 중지
pm2 stop zed-web 2>nul
if %errorlevel% neq 0 (
    echo [경고] zed-web이 PM2에서 실행 중이 아닙니다.
) else (
    echo [완료] zed-web 중지됨
)

pm2 stop zed-crawler 2>nul
if %errorlevel% neq 0 (
    echo [경고] zed-crawler가 PM2에서 실행 중이 아닙니다.
) else (
    echo [완료] zed-crawler 중지됨
)

echo.
echo ============================================
echo [2/4] Git 브랜치 전환 및 Pull...
echo ============================================

:: 현재 변경사항 stash (선택적)
echo [정보] 로컬 변경사항 임시 저장 중...
git stash

:: 브랜치 전환
echo [정보] 브랜치 전환 중: %BRANCH_NAME%
git checkout %BRANCH_NAME%
if %errorlevel% neq 0 (
    echo [오류] 브랜치 전환 실패! 브랜치 이름을 확인하세요.
    echo [정보] stash 복구 중...
    git stash pop 2>nul
    pause
    exit /b 1
)

:: 최신 코드 Pull
echo [정보] 최신 코드 Pull 중...
git pull origin %BRANCH_NAME%
if %errorlevel% neq 0 (
    echo [경고] Pull 중 문제가 발생했습니다. 계속 진행합니다.
)

echo.
echo ============================================
echo [3/4] 웹 빌드...
echo ============================================

:: 빌드 옵션에 따라 분기
if /i "%DO_BUILD%"=="Y" (
    cd web
    echo [정보] npm 의존성 설치 중...
    call npm install
    if %errorlevel% neq 0 (
        echo [경고] npm install 중 문제가 발생했습니다.
    )

    echo [정보] Next.js 빌드 중...
    call npm run build
    if %errorlevel% neq 0 (
        echo [오류] 빌드 실패!
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [완료] 빌드 완료
) else (
    echo [스킵] 빌드를 건너뜁니다.
)

echo.
echo ============================================
echo [4/4] PM2 서버 재시작...
echo ============================================

:: PM2로 앱들 재시작
pm2 start zed-web 2>nul
if %errorlevel% neq 0 (
    echo [정보] zed-web을 새로 등록합니다...
    pm2 start ecosystem.config.js --only zed-web
)
echo [완료] zed-web 시작됨

pm2 start zed-crawler 2>nul
if %errorlevel% neq 0 (
    echo [정보] zed-crawler를 새로 등록합니다...
    pm2 start ecosystem.config.js --only zed-crawler
)
echo [완료] zed-crawler 시작됨

:: PM2 상태 저장
echo [정보] PM2 상태 저장 중...
pm2 save

echo.
echo ============================================
echo [완료] 재배포가 완료되었습니다!
echo ============================================
echo.
echo 현재 PM2 상태:
pm2 status

echo.
pause
