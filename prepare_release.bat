@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title ZED 배포 준비

:: 스크립트 디렉토리로 이동
cd /d "%~dp0"

echo ============================================
echo           ZED 배포 준비
echo ============================================
echo.

:: 오늘 날짜 가져오기 (형식: YYYY-MM-DD)
for /f "tokens=1-3 delims=/" %%a in ("%date%") do (
    set YEAR=%%a
    set MONTH=%%b
    set DAY=%%c
)
set TODAY=%YEAR%-%MONTH%-%DAY%
set BRANCH_NAME=release/%TODAY%

echo [정보] 오늘 날짜: %TODAY%
echo [정보] 생성할 브랜치: %BRANCH_NAME%
echo.

:: 확인 프롬프트
set /p CONFIRM="이 브랜치로 배포 준비를 시작하시겠습니까? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo [취소] 배포 준비가 취소되었습니다.
    pause
    exit /b 0
)

echo.
echo ============================================
echo [1/4] 현재 변경사항 저장...
echo ============================================

:: 변경사항 확인 및 스태시
git status --porcelain > nul
for /f %%i in ('git status --porcelain') do (
    echo [정보] 변경사항 발견, 스태시 저장 중...
    git stash push -m "배포 준비 전 임시 저장: %TODAY%"
    goto :stash_done
)
echo [정보] 저장할 변경사항 없음
:stash_done

echo.
echo ============================================
echo [2/4] 릴리즈 브랜치 생성...
echo ============================================

:: main 브랜치에서 새 릴리즈 브랜치 생성
echo [정보] main 브랜치로 이동...
git checkout main
if %errorlevel% neq 0 (
    echo [오류] main 브랜치로 전환 실패!
    pause
    exit /b 1
)

echo [정보] 최신 코드 가져오기...
git pull origin main

:: 릴리즈 브랜치가 이미 있는지 확인
git show-ref --verify --quiet refs/heads/%BRANCH_NAME%
if %errorlevel% equ 0 (
    echo [정보] 브랜치가 이미 존재합니다. 체크아웃 중...
    git checkout %BRANCH_NAME%
) else (
    echo [정보] 새 브랜치 생성 중: %BRANCH_NAME%
    git checkout -b %BRANCH_NAME%
)

if %errorlevel% neq 0 (
    echo [오류] 브랜치 생성/전환 실패!
    pause
    exit /b 1
)

echo [완료] 현재 브랜치: %BRANCH_NAME%

echo.
echo ============================================
echo [3/4] Next.js 빌드...
echo ============================================

cd web

echo [정보] npm 의존성 설치 중...
call npm install
if %errorlevel% neq 0 (
    echo [경고] npm install 중 문제가 발생했습니다.
)

echo [정보] Next.js 빌드 중... (시간이 걸릴 수 있습니다)
set NEXT_PUBLIC_ZND_ENV=release
call npm run build
if %errorlevel% neq 0 (
    echo [오류] 빌드 실패!
    cd ..
    pause
    exit /b 1
)

cd ..
echo [완료] 빌드 성공!

echo.
echo ============================================
echo [4/4] 빌드 결과 커밋...
echo ============================================

:: .next 폴더는 .gitignore에 있을 수 있으므로 필요시 추가
git add -A
git commit -m "release: %TODAY% 배포 준비 완료"

if %errorlevel% neq 0 (
    echo [정보] 커밋할 변경사항이 없습니다.
) else (
    echo [완료] 커밋 완료
)

:: 원격에 푸시
echo [정보] 원격 저장소에 푸시 중...
git push -u origin %BRANCH_NAME%

echo.
echo ============================================
echo [완료] 배포 준비가 완료되었습니다!
echo ============================================
echo.
echo   브랜치: %BRANCH_NAME%
echo   상태: 빌드 완료, 푸시 완료
echo.
echo   VM에서 재배포 시:
echo   .\redeploy.bat 실행 후 브랜치명 입력: %BRANCH_NAME%
echo.
pause
