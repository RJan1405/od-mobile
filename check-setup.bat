@echo off
echo ============================================
echo  Quick Setup Check for Odnix Mobile
echo ============================================
echo.

echo [1] Your Computer's IP Address:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP=%%a
    set IP=!IP: =!
    echo    %IP%
    goto :gotip
)
:gotip
echo.
echo Use this IP in src/config/index.ts for phone testing
echo.

echo [2] Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo ✗ Java NOT installed
    echo   Install from: https://www.oracle.com/java/technologies/downloads/
) else (
    echo ✓ Java installed
)
echo.

echo [3] Checking Android SDK...
if exist "%LOCALAPPDATA%\Android\Sdk" (
    echo ✓ Android SDK found
) else (
    echo ✗ Android SDK NOT found
    echo   Install Android Studio: https://developer.android.com/studio
)
echo.

echo [4] Checking Node modules...
if exist "node_modules" (
    echo ✓ Dependencies installed
) else (
    echo ✗ Dependencies NOT installed
    echo   Run: npm install
)
echo.

echo [5] Checking Django Backend...
curl -s http://localhost:8000 >nul 2>&1
if errorlevel 1 (
    echo ✗ Django backend NOT running
    echo   Start it: python manage.py runserver 0.0.0.0:8000
) else (
    echo ✓ Django backend is running
)
echo.

echo [6] Checking connected Android devices...
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools
adb devices 2>nul | findstr /C:"device" >nul
if errorlevel 1 (
    echo ✗ No device connected
    echo.
    echo   TO CONNECT YOUR PHONE:
    echo   1. Enable Developer Options (tap Build Number 7 times)
    echo   2. Enable USB Debugging in Developer Options
    echo   3. Connect via USB cable
    echo   4. Accept "Allow USB debugging" popup on phone
    echo.
) else (
    echo ✓ Device connected
)
echo.

echo ============================================
echo  Ready to build?
echo ============================================
echo.
echo If all checks pass, run:
echo   run-on-phone.bat
echo.
echo Or manually:
echo   npm run android
echo.
pause
