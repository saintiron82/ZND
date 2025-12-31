@echo off
cd web
rmdir /s /q .next
timeout /t 2
set NODE_TLS_REJECT_UNAUTHORIZED=0
set NEXT_PUBLIC_ZND_ENV=release
npm run dev
pause
