# Shortcuts Created! 🎉

I've created **5 automated shortcuts** for you:

## Main Shortcuts

### 1. **start-app.bat** ⭐ (Most Important)

**What it does:**

- Checks if your phone is connected
- Starts Metro Bundler (in new window)
- Starts Django Server (in new window)  
- Sets up port forwarding (8081 & 8000)
- Launches the app on your phone

**How to use:**

1. Connect your phone via USB
2. Double-click `start-app.bat`
3. Wait 10-15 seconds
4. Done! App is running

---

### 2. **restart-app.bat**

**What it does:** Quickly restarts the app

**When to use:** When you want to restart the app but Metro/Django are already running

**How to use:** Double-click `restart-app.bat`

---

### 3. **reload-app.bat**

**What it does:** Hot reloads the app after code changes

**When to use:** After you make changes to the React Native code

**How to use:** Double-click `reload-app.bat`

---

### 4. **setup-ports.bat**

**What it does:** Re-establishes port forwarding

**When to use:** If you see "Could not connect to development server"

**How to use:** Double-click `setup-ports.bat`

---

### 5. **start-app.ps1** (PowerShell version)

Same as `start-app.bat` but with colored output

**How to use:** Right-click → Run with PowerShell

---

## Daily Workflow

### First Time (or after restart)

1. Double-click **start-app.bat**
2. Wait for it to finish
3. Start coding!

### After Making Code Changes

1. Double-click **reload-app.bat**
2. App updates instantly

### If App Crashes

1. Double-click **restart-app.bat**

### If You See "Network Error"

1. Double-click **setup-ports.bat**
2. Then double-click **reload-app.bat**

---

## What Happens Behind the Scenes

The `start-app.bat` script does all these steps automatically:

```
✓ Check device connection
✓ Setup adb reverse tcp:8081 tcp:8081
✓ Setup adb reverse tcp:8000 tcp:8000
✓ Start: npx react-native start
✓ Start: python manage.py runserver 0.0.0.0:8000
✓ Launch: adb shell am start -n com.odnix/.MainActivity
```

---

## Troubleshooting

**"No device connected" error:**

- Make sure USB debugging is enabled
- Try a different USB cable or port
- Run `adb devices` in PowerShell to check

**Scripts won't run:**

- Make sure you're in the `odnix-mobile` folder
- Check that Android SDK is installed

**Metro or Django won't start:**

- Close any existing Metro/Django windows
- Try running `start-app.bat` again

---

## Manual Method

If you prefer, you can still run everything manually as documented in `START_APP_ON_MOBILE.md`

---

**Enjoy your automated workflow! 🚀**
