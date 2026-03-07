# 📱 Connect Your Android Phone - Step by Step Guide

## ✅ Current Status

- ✅ Java 24 installed
- ✅ Android SDK installed
- ✅ Dependencies installed
- ✅ Django backend running on port 8000
- ⏳ **NEXT: Connect your phone**

---

## 📲 STEP 1: Enable Developer Mode on Your Phone

### For Android 11+ (Most common)

1. Open **Settings** on your phone
2. Scroll to **About phone**
3. Find **Build number**
4. **Tap Build number 7 times** rapidly
5. You'll see "You are now a developer!"

### Alternative locations by brand

- **Samsung**: Settings → About phone → Software information → Build number
- **Xiaomi/POCO**: Settings → About phone → MIUI version (tap 7 times)
- **OnePlus**: Settings → About device → Build number
- **Oppo/Realme**: Settings → About device → Version → Build number

---

## 🔓 STEP 2: Enable USB Debugging

1. Go back to main **Settings**
2. Scroll down and tap **Developer options** (or **System** → **Developer options**)
3. Toggle **Developer options** to ON
4. Scroll down and enable **USB debugging**
5. A popup will appear → Tap **OK** to allow USB debugging

### Additional recommended settings

- Enable **Install via USB** (if available)
- Enable **USB debugging (Security settings)** (if available)
- Disable **MIUI optimization** (Xiaomi only, if prompted)

---

## 🔌 STEP 3: Connect Phone to Computer

1. **Use a good quality USB cable** (data cable, not charge-only)
2. Plug USB cable into your phone
3. Plug the other end into your computer
4. On your phone, you'll see a notification:
   - Select **File Transfer** or **MTP** mode
   - NOT "Charging only"

5. A popup will appear: **"Allow USB debugging?"**
   - Check **"Always allow from this computer"**
   - Tap **OK**

---

## ✔️ STEP 4: Verify Connection

Run this command to check if your phone is detected:

```powershell
adb devices
```

You should see something like:

```
List of devices attached
ABC123XYZ    device
```

If you see:

- `unauthorized` → Check your phone for the "Allow USB debugging" popup
- `offline` → Restart ADB: `adb kill-server` then `adb devices`
- Nothing → Try a different USB cable or USB port

---

## 🌐 STEP 5: Configure Backend URL for Your Phone

Your phone needs to connect to the Django backend on your computer.

### Find your computer's IP address

```powershell
ipconfig | Select-String "IPv4"
```

Look for something like: `192.168.1.5` or `192.168.0.10`

### Update the mobile app config

Open: `odnix-mobile/src/config/index.ts`

Change these lines:

```typescript
// OLD (for emulator):
export const BASE_URL = 'http://10.0.2.2:8000';
export const WS_URL = 'ws://10.0.2.2:8000';

// NEW (replace 192.168.1.5 with YOUR computer's IP):
export const BASE_URL = 'http://192.168.1.5:8000';
export const WS_URL = 'ws://192.168.1.5:8000';
```

### Important

- Your phone and computer MUST be on the **same WiFi network**
- Disable any firewalls that might block port 8000

---

## 🚀 STEP 6: Build and Install App

Once your phone is connected, run:

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
npm run android
```

This will:

1. ✅ Build the Android APK
2. ✅ Install it on your phone
3. ✅ Launch the app automatically

**First build takes 5-10 minutes** (downloads Gradle and builds native code)

---

## 🎯 STEP 7: Test the App

1. The app should launch automatically on your phone
2. You'll see the Odnix login screen
3. Try logging in with an existing Django user account
4. Test features:
   - View home feed (scribes)
   - Watch Omzo videos
   - Send chat messages
   - Search for users

---

## 🐛 Troubleshooting

### "adb: device unauthorized"

- Check your phone for the USB debugging popup
- Click "Always allow from this computer" → OK

### "Could not connect to development server"

- Make sure Django backend is running: `python manage.py runserver 0.0.0.0:8000`
- Make sure you updated the IP in `src/config/index.ts`
- Both phone and PC must be on same WiFi

### "INSTALL_FAILED_INSUFFICIENT_STORAGE"

- Free up space on your phone (need ~100MB)

### Build fails with Java errors

- Restart PowerShell (to reload environment variables)
- Run: `cd android; .\gradlew clean`

### App installed but crashes

- Check Django backend logs for errors
- Check React Native Metro bundler for JavaScript errors

---

## 🔄 Quick Commands Reference

```powershell
# Check connected devices
adb devices

# Restart ADB server
adb kill-server
adb start-server

# Uninstall app from phone
adb uninstall com.odnixmobile

# View app logs
adb logcat | Select-String "ReactNativeJS"

# Rebuild and reinstall
cd D:\VulnTech11\react-odnix\odnix-mobile
npm run android

# Check your IP
ipconfig | Select-String "IPv4"
```

---

## ✨ Next Steps After App is Running

1. **Create test accounts** in Django admin
2. **Test all features** on your phone
3. **Share APK** with others (find in `android/app/build/outputs/apk/debug/`)
4. **Build release APK** for production use

---

**Need help?** Check the full documentation in `QUICKSTART.md` and `README.md`
