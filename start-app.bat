@echo off
echo ============================================
echo   Odnix Mobile - Quick Start Script
echo ============================================
echo.

REM Set Android SDK path
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

echo [1/6] Checking device connection...
adb devices | findstr /C:"device" >nul
if errorlevel 1 (
    echo ERROR: No device connected!
    echo Please connect your phone via USB and enable USB debugging.
    pause
    exit /b 1
)
echo ✓ Device connected
echo.

echo [2/6] Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8000 tcp:8000
echo ✓ Port forwarding configured (8081 for Metro, 8000 for Django)
echo.

echo [3/6] Starting Metro Bundler...
start "Metro Bundler" cmd /k "cd /d %~dp0 && echo Starting Metro... && npx react-native start"
timeout /t 3 /nobreak >nul
echo ✓ Metro Bundler started in new window
echo.

echo [4/6] Starting Django Server...
start "Django Server" cmd /k "cd /d %~dp0\.. && echo Starting Django... && python manage.py runserver 0.0.0.0:8000"
timeout /t 3 /nobreak >nul
echo ✓ Django Server started in new window
echo.

echo [5/6] Waiting for servers to initialize...
timeout /t 5 /nobreak >nul
echo ✓ Servers ready
echo.

echo [6/6] Launching app on device...
adb shell am force-stop com.odnix
timeout /t 1 /nobreak >nul
adb shell am start -n com.odnix/.MainActivity
echo ✓ App launched!
echo.

echo ============================================
echo   All Done! Your app is running.
echo ============================================
echo.
echo Two new windows opened:
echo  1. Metro Bundler (port 8081)
echo  2. Django Server (port 8000)
echo.
echo Keep those windows open while using the app.
echo Press any key to close this window...
pause >nul
