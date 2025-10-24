@echo off
echo ======================================
echo Stopping existing Node processes...
echo ======================================
taskkill /F /IM node.exe 2>nul
timeout /t 2

echo.
echo ======================================
echo Cleaning build artifacts...
echo ======================================
if exist dist rmdir /s /q dist
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo.
echo ======================================
echo Recompiling TypeScript...
echo ======================================
call pnpm build

echo.
echo ======================================
echo Starting backend in dev mode...
echo ======================================
call pnpm dev
