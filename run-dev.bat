@echo off
title YUSRO Launcher
echo ========================================================
echo        MEMULAI SEMUA LAYANAN WEBSITE-YUSRO
echo ========================================================
echo.

:: 1. Pastikan Docker Database Aktif
echo [1/4] Menyalakan PostgreSQL Database (Docker)...
docker compose -f docker-compose.dev.yml up -d db
echo Database siap!
echo.

:: 2. Jalankan Backend (Port 3000)
echo [2/4] Menjalankan Backend NestJS...
start "YUSRO - Backend (Port 3000)" cmd /k "cd /d %~dp0backend && npm run start:dev"

:: 3. Jalankan ML Service (Port 8000)
echo [3/4] Menjalankan ML Service Python...
start "YUSRO - ML Service (Port 8000)" cmd /k "cd /d %~dp0ml-service && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

:: 4. Jalankan Frontend (Port 5173)
echo [4/4] Menjalankan Frontend React Vite...
start "YUSRO - Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo SEMUA LAYANAN TELAH BERJALAN!
echo - Frontend   : http://localhost:5173
echo - Backend    : http://localhost:3000
echo - ML Service : http://localhost:8000
echo ========================================================
echo Jendela ini dapat ditutup. Layanan berjalan di jendela masing-masing.
pause
