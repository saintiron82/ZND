@echo off
setlocal
title ZND Desk Server

:: Move to the script's directory (Project Root)
cd /d "%~dp0"

echo ==========================================
echo       ZND Desk Server Launcher
echo ==========================================
echo 1. Development (Local Data, dev)
echo 2. Release (Live Firestore Data, release)
echo ==========================================
set /p mode="Select Mode (1/2): "

if "%mode%"=="2" (
    set ZND_ENV=release
    echo [INFO] Starting in RELEASE mode...
) else (
    set ZND_ENV=dev
    echo [INFO] Starting in DEV mode...
)

:: Check for virtual environment in multiple locations (fallback order)
set VENV_PATH=
if exist desk\venv (
    set VENV_PATH=desk\venv
) else if exist desk\.venv (
    set VENV_PATH=desk\.venv
) else if exist venv (
    set VENV_PATH=venv
) else if exist .venv (
    set VENV_PATH=.venv
)

if "%VENV_PATH%"=="" (
    echo [ERROR] Virtual environment not found!
    echo Searched locations: desk\venv, desk\.venv, venv, .venv
    echo Please ensure you have set up the python environment.
    pause
    exit /b
)

echo [ZED] Found virtual environment at: %VENV_PATH%
echo [ZED] Activating virtual environment...
call %VENV_PATH%\Scripts\activate

where python
python --version

:: Kill any existing process on port 5500
echo [ZED] Checking for existing services on port 5500...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5500 ^| findstr LISTENING') do (
    echo [ZED] Found existing process PID: %%a - Terminating...
    taskkill /F /PID %%a >nul 2>&1
)
echo [ZED] Port 5500 is now available.

echo [ZED] Moving to desk directory...
cd desk

echo [ZED] Opening browser...
:: Start browser slightly before server to ensure it's ready when window pops up, 
:: though user might need to refresh if server is slow.
start http://localhost:5500

:: desk 폴더 기준으로 venv 경로 재탐색 (폴백 지원)
set DESK_VENV=
if exist .venv (
    set DESK_VENV=.venv
) else if exist venv (
    set DESK_VENV=venv
)

if "%DESK_VENV%"=="" (
    echo [ERROR] Virtual environment not found in desk folder!
    pause
    exit /b
)

echo [ZED] Starting Desk Server... (using %DESK_VENV%)
.\%DESK_VENV%\Scripts\python.exe app.py

pause
