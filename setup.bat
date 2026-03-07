@echo off
echo Setting up Odnix Mobile App...
echo.

REM Check Node.js
echo Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Please install Node.js 18+
    exit /b 1
)
node --version

REM Check npm
echo Checking npm version...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo npm not found. Please install npm
    exit /b 1
)
npm --version

REM Install dependencies
echo.
echo Installing dependencies...
call npm install

REM Check for Android
echo.
echo Checking Android environment...
if defined ANDROID_HOME (
    echo Android SDK found at: %ANDROID_HOME%
) else (
    echo ANDROID_HOME not set. Please configure Android SDK
)

REM Setup complete
echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Ensure Django backend is running on http://127.0.0.1:8000
echo 2. Update src/config/index.ts with your backend IP if using physical device
echo 3. Run 'npm run android' to start the app
echo.
echo For detailed instructions, see QUICKSTART.md
pause
