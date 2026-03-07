# How to Start Odnix App on Mobile Device

## 🚀 Quick Start (Recommended)

Just double-click one of these shortcuts:

### **start-app.bat** - Complete Startup

- ✅ Checks device connection
- ✅ Starts Metro Bundler automatically
- ✅ Starts Django Server automatically
- ✅ Sets up port forwarding
- ✅ Launches app on your phone

**Usage:** Double-click `start-app.bat` in File Explorer

### **restart-app.bat** - Quick Restart

- Restarts the app (when Metro & Django are already running)

### **reload-app.bat** - Reload After Code Changes

- Triggers hot reload in the app

### **setup-ports.bat** - Fix Connection Issues

- Re-establishes port forwarding if connection lost

---

## Prerequisites

- Android phone with USB debugging enabled
- USB cable connected to computer
- Android SDK installed (via Android Studio)

## Manual Step-by-Step Guide

### Step 1: Enable USB Debugging on Your Phone

1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times to enable Developer Options
3. Go back to **Settings** → **Developer Options**
4. Enable **USB Debugging**
5. Connect your phone via USB cable
6. Accept the "Allow USB debugging" popup on your phone

---

### Step 2: Open PowerShell in Project Directory

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
```

---

### Step 3: Set Up Android SDK Path

Run these commands in PowerShell:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"
```

---

### Step 4: Verify Device Connection

```powershell
adb devices
```

You should see your device listed with status "device"

---

### Step 5: Start Metro Bundler (Terminal 1)

Open a new PowerShell terminal:

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
npx react-native start
```

Keep this terminal running.

---

### Step 6: Start Django Backend Server (Terminal 2)

Open another PowerShell terminal:

```powershell
cd D:\VulnTech11\react-odnix
python manage.py runserver 0.0.0.0:8000
```

Keep this terminal running.

---

### Step 7: Set Up Port Forwarding (Terminal 3)

Open a third PowerShell terminal and run:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8000 tcp:8000
```

This allows your phone to access:

- Metro bundler on port 8081 (for app code)
- Django server on port 8000 (for backend API)

---

### Step 8: Install and Launch the App

In the same terminal (Terminal 3):

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
npx react-native run-android
```

Or manually restart the app:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
adb shell am force-stop com.odnix
Start-Sleep -Seconds 1
adb shell am start -n com.odnix/.MainActivity
```

---

## Quick Restart Command

After everything is set up, use this one-liner to restart the app:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"; adb shell am force-stop com.odnix; Start-Sleep -Seconds 1; adb shell am start -n com.odnix/.MainActivity
```

---

## Reload App After Code Changes

If Metro and Django are already running, just reload:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
adb shell input keyevent 82    # Opens dev menu
adb shell input text "RR"       # Triggers reload
```

Or shake the phone and tap "Reload" from the dev menu.

---

## Troubleshooting

### "adb is not recognized"

Run:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
```

### "Could not connect to development server"

1. Verify Metro is running (Terminal 1)
2. Set up port forwarding again:

```powershell
adb reverse tcp:8081 tcp:8081
```

### "Network Error" when loading data

1. Verify Django server is running (Terminal 2)
2. Set up port forwarding for backend:

```powershell
adb reverse tcp:8000 tcp:8000
```

### Red screen errors

- Tap "Reload" or press R+R on your keyboard (with Metro terminal focused)
- Or restart the app using the restart command

---

## Summary of Running Services

You should have these 3 terminals open:

| Terminal | Service | Command |
|----------|---------|---------|
| 1 | Metro Bundler | `npx react-native start` |
| 2 | Django Server | `python manage.py runserver 0.0.0.0:8000` |
| 3 | Commands | For running adb commands |

**Port Forwarding** (run once per session):

- `adb reverse tcp:8081 tcp:8081` (Metro)
- `adb reverse tcp:8000 tcp:8000` (Django)

---

## First Time Setup Only

If this is your first time:

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
npm install
cd D:\VulnTech11\react-odnix
pip install -r requirements.txt
python manage.py migrate
```

---

**That's it! Your app should now be running on your phone.** 🎉
