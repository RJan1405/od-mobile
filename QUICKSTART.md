# Odnix Mobile - Quick Start Guide

## 🎯 Quick Setup for Development

### 1. Prerequisites Check

Ensure you have:

- ✅ Node.js 18+ installed
- ✅ Android Studio installed
- ✅ Java JDK 17 installed
- ✅ Android SDK configured
- ✅ Odnix Django backend running

### 2. Install Dependencies

```bash
cd odnix-mobile
npm install
```

### 3. Configure Backend Connection

**Option A: Android Emulator (Recommended for testing)**

The config is already set to work with Android emulator. No changes needed!

**Option B: Physical Android Device**

Edit `src/config/index.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://YOUR_PC_IP:8000',  // Replace with your PC's local IP
  WS_URL: 'ws://YOUR_PC_IP:8000',
};
```

To find your local IP:

- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr show`

### 4. Update Django Settings

In your Django `settings.py`, add your mobile device's IP to `ALLOWED_HOSTS`:

```python
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'YOUR_PC_IP', '*']

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://YOUR_PC_IP:8080",  # Add this
]
```

### 5. Start the Backend

```bash
cd react-odnix
python manage.py runserver 0.0.0.0:8000  # Listen on all interfaces
```

### 6. Run the Mobile App

#### Terminal 1: Start Metro Bundler

```bash
cd odnix-mobile
npm start
```

#### Terminal 2: Run Android App

```bash
npm run android
```

## 🔧 Common Issues & Solutions

### Issue: "Unable to connect to backend"

**Solution:**

```bash
# For Android Emulator, forward ports:
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081

# Restart Metro with cache clear:
npm start -- --reset-cache
```

### Issue: "Build failed"

**Solution:**

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Issue: "WebSocket connection failed"

**Solution:**

- Verify Django is running: `http://127.0.0.1:8000/api/profile/`
- Check if WebSocket server is active
- Ensure no firewall blocking port 8000

### Issue: "Metro bundler crashes"

**Solution:**

```bash
# Clear watchman (if on Mac/Linux):
watchman watch-del-all

# Clear Metro cache:
npm start -- --reset-cache
```

## 📱 Testing the App

### Test Accounts

Use existing accounts from your Django backend or create new ones via Django admin.

### Features to Test

1. **Login** - Use existing username/password
2. **Home Feed** - View scribes from followed users
3. **Stories** - Create and view 24-hour stories
4. **Omzo** - Scroll through short videos
5. **Chat** - Send messages (WebSocket real-time)
6. **Profile** - View and edit profile
7. **Search** - Find users and content

## 🎨 Customization

### Change Theme

In the app:

1. Go to Profile tab
2. Tap Settings
3. Select Theme
4. Choose from 25+ options

### Update App Colors

Edit `src/config/index.ts` → `THEME_COLORS`

### Modify API Endpoints

Edit `src/services/api.ts`

## 📊 Development Tools

### React Native Debugger

```bash
# Install
npm install -g react-devtools

# Run
react-devtools
```

### View Logs

```bash
# Android
npx react-native log-android

# Or use adb:
adb logcat | grep "ReactNative"
```

### Performance Monitoring

Press `Cmd/Ctrl + M` → Select "Show Perf Monitor"

## 🚀 Building for Release

### Generate APK

```bash
cd android
./gradlew assembleRelease
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### Install on Device

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

## 📝 Next Steps

1. ✅ Test login functionality
2. ✅ Verify WebSocket connections work (chat)
3. ✅ Test image uploads (profile picture, scribe)
4. ✅ Test video playback (omzo)
5. ✅ Test real-time notifications
6. ✅ Test theme switching
7. ✅ Optimize performance

## 🆘 Need Help?

Check the full README.md for detailed documentation or review:

- `src/services/api.ts` - API integration
- `src/services/websocket.ts` - WebSocket handling
- `src/navigation/RootNavigator.tsx` - App navigation structure

---

**Happy Coding! 🎉**
