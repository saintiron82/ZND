@echo off
setlocal
title ZED Manual Crawler

:: Move to the script's directory (Project Root)
cd /d "%~dp0"

:: Check for virtual environment in multiple locations (fallback order)
set VENV_PATH=
if exist supplier\venv (
    set VENV_PATH=supplier\venv
) else if exist supplier\.venv (
    set VENV_PATH=supplier\.venv
) else if exist venv (
    set VENV_PATH=venv
) else if exist .venv (
    set VENV_PATH=.venv
)

if "%VENV_PATH%"=="" (
    echo [ERROR] Virtual environment not found!
    echo Searched locations: supplier\venv, supplier\.venv, venv, .venv
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

echo [ZED] Moving to supplier directory...
cd supplier

echo [ZED] Opening browser...
:: Start browser slightly before server to ensure it's ready when window pops up, 
:: though user might need to refresh if server is slow.
start http://localhost:5500

echo [ZED] Starting Manual Crawler Server...
python manual_crawler.py

pause
