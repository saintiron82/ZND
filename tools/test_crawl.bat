@echo off

echo Activating virtual environment...
call .venv\Scripts\activate

cd supplier

echo.
echo ========================================
echo   Test Crawler - Single Article Test
echo ========================================
echo.
echo Available sources:
echo   - aitimes
echo   - techcrunch_ai
echo   - venturebeat
echo   - deepmind
echo   - the_decoder
echo   - techneedle
echo.

set /p SOURCE_ID="Enter source ID: "

echo.
echo Starting test for: %SOURCE_ID%
python test_crawler.py %SOURCE_ID%

pause
