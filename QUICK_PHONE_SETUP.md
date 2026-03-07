# Quick Phone Setup - 2 Minutes

## Step 1: On Your Phone (30 seconds)

1. Settings → About Phone → Tap "Build Number" 7 times
2. Go back → Developer Options → Enable "USB Debugging"

## Step 2: Connect Cable (30 seconds)  

1. Plug USB into phone and computer
2. Phone popup: "Allow USB debugging?" → Tap OK

## Step 3: Verify (30 seconds)

Run in PowerShell:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools"
adb devices
```

Should see: `XXXXXXX    device`

## Step 4: Build & Install (5-10 min first time, 30 sec after)

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
npm run android
```

✅ Done! App launches on your phone automatically.

---

## Or Use the Helper Script

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
cmd /c run-on-phone.bat
```

The script will guide you through each step!
