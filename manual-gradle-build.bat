@echo off
echo ============================================
echo  Manual Gradle 8.3 Setup and Build
echo ============================================
echo.

echo [Step 1] Downloading Gradle 8.3 manually...
echo Please download this file in your browser:
echo https://services.gradle.org/distributions/gradle-8.3-all.zip
echo.
echo Save it to: %USERPROFILE%\.gradle\wrapper\dists\gradle-8.3-all\
echo.
pause

echo.
echo [Step 2] Extracting Gradle...
echo After download completes:
echo 1. Create folder: %USERPROFILE%\.gradle\wrapper\dists\gradle-8.3-all\RANDOM_HASH
echo 2. Extract gradle-8.3-all.zip into that folder
echo.
pause

echo.
echo [Step 3] Building app...
cd /d D:\VulnTech11\react-odnix\odnix-mobile
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%

echo Starting build with manually downloaded Gradle...
call npm run android

pause
