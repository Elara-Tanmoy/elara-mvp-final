# Elara Backend Complete Restart Script
# This will stop all Node processes and restart the backend cleanly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Elara Backend Complete Restart" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill all Node processes
Write-Host "Step 1: Stopping all Node.js processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ All Node processes stopped" -ForegroundColor Green
} catch {
    Write-Host "   ℹ No Node processes running" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# Step 2: Clean build artifacts
Write-Host ""
Write-Host "Step 2: Cleaning build artifacts..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "   ✓ dist/ directory removed" -ForegroundColor Green
} else {
    Write-Host "   ℹ No dist/ directory found" -ForegroundColor Gray
}

if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "   ✓ node_modules cache cleared" -ForegroundColor Green
} else {
    Write-Host "   ℹ No cache directory found" -ForegroundColor Gray
}

# Step 3: Start backend
Write-Host ""
Write-Host "Step 3: Starting backend in dev mode..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IMPORTANT: Look for this message:" -ForegroundColor Cyan
Write-Host "🚀🚀🚀 EnhancedURLScanner initialized with Phase 2 analyzers! 🚀🚀🚀" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Run pnpm dev
& pnpm dev
