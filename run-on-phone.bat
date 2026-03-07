@echo off
echo ============================================
echo  Odnix Mobile - Phone Deployment Script
echo ============================================
echo.

REM Set Android SDK path
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator

echo [1/5] Checking Android SDK...
if not exist "%ANDROID_HOME%" (
    echo ERROR: Android SDK not found!
    echo Please install Android Studio from: https://developer.android.com/studio
    pause
    exit /b 1
)
echo ✓ Android SDK found at: %ANDROID_HOME%
echo.

echo [2/5] Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java not found!
    echo Please install Java JDK from: https://www.oracle.com/java/technologies/downloads/
    pause
    exit /b 1
)
echo ✓ Java installed
echo.

echo [3/5] Checking connected devices...
adb devices
echo.
echo If you don't see your device above:
echo   1. Enable Developer Options on your phone (tap Build Number 7 times)
echo   2. Enable USB Debugging in Developer Options
echo   3. Connect phone via USB cable
echo   4. Accept the "Allow USB debugging" popup on your phone
echo.
echo Press any key when your phone is connected and shows "device" status...
pause >nul

echo [4/5] Verifying device connection...
adb devices | findstr /C:"device" >nul
if errorlevel 1 (
    echo ERROR: No device detected!
    echo Please check the steps above and try again.
    pause
    exit /b 1
)
echo ✓ Device connected
echo.

echo [5/5] Building and installing app...
echo This may take 5-10 minutes on first build...
echo.

call npm run android

if errorlevel 1 (
    echo.
    echo ============================================
    echo  Build FAILED!
    echo ============================================
    echo.
    echo Possible solutions:
    echo   1. Make sure your phone is still connected
    echo   2. Run: cd android; .\gradlew clean
    echo   3. Check that port 8081 is not in use
    echo   4. Restart this script
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  SUCCESS! App installed on your phone
echo ============================================
echo.
echo Next steps:
echo   1. The app should launch automatically
echo   2. Make sure Django backend is running:
echo      python manage.py runserver 0.0.0.0:8000
echo   3. Update IP in src/config/index.ts if needed
echo   4. Test login and features!
echo.
pause
