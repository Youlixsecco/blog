@echo off
title Blog Server
cd /d "%~dp0backend"

echo ========================================
echo          Blog Server Startup
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo [INFO] Starting server...
echo [INFO] Open http://localhost:3000 in your browser
echo.
start http://localhost:3000
node src/app.js
pause