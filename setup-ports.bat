@echo off
echo Setting up port forwarding...

REM Set Android SDK path
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

adb reverse tcp:8081 tcp:8081
adb reverse tcp:8000 tcp:8000

echo.
echo ✓ Port forwarding configured!
echo   - Metro: 8081
echo   - Django: 8000
echo.
timeout /t 2 /nobreak >nul
