@echo off
echo Reloading app...

REM Set Android SDK path
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

REM Open dev menu and reload
adb shell input keyevent 82
timeout /t 1 /nobreak >nul
adb shell input text "RR"

echo ✓ Reload triggered!
timeout /t 2 /nobreak >nul
