@echo off
setlocal
title ZND Manual Crawler

:: Move to the script's directory (Project Root)
cd /d "%~dp0"

if not exist .venv (
    echo [ERROR] Virtual environment '.venv' not found in project root!
    echo Please ensure you have set up the python environment.
    pause
    exit /b
)

echo [ZND] Activating virtual environment...
call .venv\Scripts\activate

where python
python --version

echo [ZND] Moving to supplier directory...
cd supplier

echo [ZND] Opening browser...
:: Start browser slightly before server to ensure it's ready when window pops up, 
:: though user might need to refresh if server is slow.
start http://localhost:5500

echo [ZND] Starting Manual Crawler Server...
python manual_crawler.py

pause
