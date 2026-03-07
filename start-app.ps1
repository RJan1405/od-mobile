# Odnix Mobile - PowerShell Quick Start Script

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Odnix Mobile - Quick Start Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Set Android SDK path
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

# Step 1: Check device connection
Write-Host "[1/6] Checking device connection..." -ForegroundColor Yellow
$devices = adb devices
if ($devices -notmatch "device$") {
    Write-Host "ERROR: No device connected!" -ForegroundColor Red
    Write-Host "Please connect your phone via USB and enable USB debugging." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✓ Device connected" -ForegroundColor Green
Write-Host ""

# Step 2: Setup port forwarding
Write-Host "[2/6] Setting up port forwarding..." -ForegroundColor Yellow
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:8000 tcp:8000 | Out-Null
Write-Host "✓ Port forwarding configured (8081 for Metro, 8000 for Django)" -ForegroundColor Green
Write-Host ""

# Step 3: Start Metro Bundler
Write-Host "[3/6] Starting Metro Bundler..." -ForegroundColor Yellow
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; Write-Host 'Starting Metro Bundler...' -ForegroundColor Cyan; npx react-native start"
Start-Sleep -Seconds 3
Write-Host "✓ Metro Bundler started in new window" -ForegroundColor Green
Write-Host ""

# Step 4: Start Django Server
Write-Host "[4/6] Starting Django Server..." -ForegroundColor Yellow
$djangoPath = Split-Path -Parent $scriptPath
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$djangoPath'; Write-Host 'Starting Django Server...' -ForegroundColor Cyan; python manage.py runserver 0.0.0.0:8000"
Start-Sleep -Seconds 3
Write-Host "✓ Django Server started in new window" -ForegroundColor Green
Write-Host ""

# Step 5: Wait for servers
Write-Host "[5/6] Waiting for servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "✓ Servers ready" -ForegroundColor Green
Write-Host ""

# Step 6: Launch app
Write-Host "[6/6] Launching app on device..." -ForegroundColor Yellow
adb shell am force-stop com.odnix | Out-Null
Start-Sleep -Seconds 1
adb shell am start -n com.odnix/.MainActivity | Out-Null
Write-Host "✓ App launched!" -ForegroundColor Green
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All Done! Your app is running." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Two new windows opened:" -ForegroundColor White
Write-Host " 1. Metro Bundler (port 8081)" -ForegroundColor White
Write-Host " 2. Django Server (port 8000)" -ForegroundColor White
Write-Host ""
Write-Host "Keep those windows open while using the app." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close this window"
