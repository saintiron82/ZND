echo ==========================================
echo       ZND Web Server Launcher
echo ==========================================
echo 1. Development (Local Data, dev)
echo 2. Release (Live Firestore Data, release)
echo ==========================================
set /p mode="Select Mode (1/2): "

if "%mode%"=="2" (
    set NEXT_PUBLIC_ZND_ENV=release
    echo [INFO] Starting in RELEASE mode...
) else (
    set NEXT_PUBLIC_ZND_ENV=dev
    echo [INFO] Starting in DEV mode...
)

cd web
rmdir /s /q .next
timeout /t 2
set NODE_TLS_REJECT_UNAUTHORIZED=0
npm run dev
pause
