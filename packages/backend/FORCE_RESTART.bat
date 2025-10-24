@echo off
echo Killing all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo.
echo Starting backend...
cd /d "%~dp0"
pnpm dev
