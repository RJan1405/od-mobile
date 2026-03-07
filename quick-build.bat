@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  Odnix Mobile - Quick APK Build
echo ============================================
echo.

REM Set environment
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\build-tools\34.0.0;%PATH%"

echo [1/4] Checking phone connection...
adb devices | findstr /C:"device" >nul
if errorlevel 1 (
    echo ERROR: Phone not detected!
    echo Please connect your phone via USB
    pause
    exit /b 1
)
echo ✓ Phone connected

echo.
echo [2/4] Starting Metro bundler...
cd /d D:\VulnTech11\react-odnix\odnix-mobile
start /B cmd /c "npm start > metro.log 2>&1"
timeout /t 5 >nul

echo.
echo [3/4] Building APK with local Gradle...
cd android
call gradlew.bat assembleDebug --offline --no-daemon 2>nul
if errorlevel 1 (
    echo Offline build failed, trying online...
    call gradlew.bat assembleDebug --no-daemon
)

echo.
echo [4/4] Installing on phone...
adb install -r app\build\outputs\apk\debug\app-debug.apk

if errorlevel 0 (
    echo.
    echo ============================================
    echo  SUCCESS! App installed on your phone!
    echo ============================================
    echo.
    echo Opening the app...
    adb shell am start -n com.odnix/.MainActivity
) else (
    echo.
    echo Installation failed. Trying manual install...
    echo APK location: android\app\build\outputs\apk\debug\app-debug.apk
)

pause
