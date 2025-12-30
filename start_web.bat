@echo off
cd web
rmdir /s /q .next
timeout /t 2
set NODE_TLS_REJECT_UNAUTHORIZED=0
npm run dev
pause
