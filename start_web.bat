@echo off
cd web
rmdir /s /q .next
timeout /t 2
npm run dev
pause
