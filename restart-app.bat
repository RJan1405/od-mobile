@echo off
echo ============================================
echo   Odnix Mobile - Quick Restart
echo ============================================
echo.

REM Set Android SDK path
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

echo Restarting app...
adb shell am force-stop com.odnix
timeout /t 1 /nobreak >nul
adb shell am start -n com.odnix/.MainActivity

echo.
echo ✓ App restarted!
echo.
timeout /t 2 /nobreak >nul
