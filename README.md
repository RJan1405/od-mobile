# Odnix Mobile - React Native App

A full-featured social media mobile application built with React Native for Android, connecting to the Odnix Django backend.

## 🚀 Features

- **Authentication** - Secure login/logout with session management
- **Home Feed** - Infinite scroll feed of scribes (posts) from followed users
- **Stories** - 24-hour ephemeral content with viewing and creation
- **Omzo (Short Videos)** - TikTok-style vertical video feed with infinite scroll
- **Real-time Chat** - WebSocket-powered messaging with typing indicators
- **Profile Management** - View and edit user profiles
- **Search & Explore** - Discover new users and content
- **Notifications** - Real-time push notifications for interactions
- **Multiple Themes** - 25+ customizable theme options

## 📋 Prerequisites

- Node.js >= 18
- React Native development environment set up
- Android Studio (for Android development)
- Java Development Kit (JDK) 17
- Android SDK
- Odnix Django backend running on `http://127.0.0.1:8000`

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd odnix-mobile
npm install
```

### 2. Install iOS Pods (macOS only)

```bash
cd ios
pod install
cd ..
```

### 3. Configure Backend URL

Edit `src/config/index.ts` and update the API URLs:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://YOUR_BACKEND_IP:8000',  // Update this
  WS_URL: 'ws://YOUR_BACKEND_IP:8000',      // Update this
  TIMEOUT: 30000,
};
```

**For Android emulator:** Use `http://10.0.2.2:8000` to access localhost
**For physical device:** Use your computer's local IP address

## 🏃‍♂️ Running the App

### Start Metro Bundler

```bash
npm start
```

### Run on Android

```bash
npm run android
```

### Run on iOS (macOS only)

```bash
npm run ios
```

## 📁 Project Structure

```
odnix-mobile/
├── android/              # Android native code
├── ios/                  # iOS native code (if needed)
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ScribeCard.tsx
│   │   ├── OmzoCard.tsx
│   │   └── StoryBar.tsx
│   ├── config/           # App configuration
│   │   └── index.ts
│   ├── navigation/       # Navigation setup
│   │   └── RootNavigator.tsx
│   ├── screens/          # Screen components
│   │   ├── Auth/
│   │   ├── Home/
│   │   ├── Chat/
│   │   ├── Omzo/
│   │   ├── Profile/
│   │   └── ...
│   ├── services/         # API & WebSocket services
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── stores/           # Zustand state management
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   └── themeStore.ts
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   └── App.tsx           # Root component
├── package.json
├── tsconfig.json
└── README.md
```

## 🎨 Key Technologies

- **React Native 0.74** - Latest stable version
- **TypeScript** - Type-safe development
- **React Navigation** - Navigation and routing
- **Zustand** - Lightweight state management
- **Axios** - HTTP client for API calls
- **WebSocket** - Real-time communication
- **React Native Video** - Video playback
- **React Native Fast Image** - Optimized image loading
- **React Native Linear Gradient** - Gradient UI elements
- **React Native Vector Icons** - Icon library

## 🔐 Authentication

The app uses session-based authentication matching the Django backend:

1. Login sends credentials to `/api/login/`
2. Server returns user data and sets session cookie
3. Session persists across app restarts
4. WebSocket connections authenticated via session

## 📡 Real-time Features

WebSocket connections for:

- **Chat Messages** - `ws/chat/{chatId}/`
- **Notifications** - `ws/notify/`
- **Chat List Updates** - `ws/sidebar/`
- **Call Signaling** - `ws/call/{chatId}/`

All WebSocket connections automatically reconnect on disconnect.

## 🎭 Theme System

25+ themes available:

- Light themes (Lavender, Rose, Mint, Peach, Sky)
- Dark themes (Dark, Midnight, AMOLED, Dracula, Nord, Tokyo Night, Synthwave, Cyberpunk)
- Nature themes (Forest, Ocean, Sunset, Aurora, Desert)
- Professional themes (Charcoal, Slate, Graphite, Mocha)
- Vibrant themes (Neon, Coral, Amber, Emerald, Sapphire)

Theme persists across app sessions.

## 📱 Screens Overview

### Main Tabs

- **Home** - Feed of scribes with stories bar
- **Explore** - Discover users and content
- **Omzo** - Vertical video feed
- **Chats** - Message conversations
- **Profile** - User profile and settings

### Additional Screens

- **Chat** - Individual conversation view
- **Create Scribe** - Post creation
- **Create Story** - Story creation
- **Story View** - View stories
- **Notifications** - Activity feed
- **Settings** - App preferences

## 🔧 Development

### Enable Developer Menu

- Android: Shake device or `Ctrl+M` (Windows/Linux) or `Cmd+M` (macOS)
- iOS: Shake device or `Cmd+D`

### Debug Mode

```bash
# Android
adb reverse tcp:8000 tcp:8000  # Forward backend port
adb reverse tcp:8081 tcp:8081  # Forward Metro bundler

# Start with debugging
npm start -- --reset-cache
```

### Build Release APK

```bash
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

## 🐛 Troubleshooting

### Metro Bundler Issues

```bash
npx react-native start --reset-cache
```

### Android Build Errors

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### WebSocket Connection Refused

- Ensure Django backend is running
- Check `API_CONFIG` URLs in `src/config/index.ts`
- For Android emulator, use `10.0.2.2` instead of `localhost`

### Image/Video Not Loading

- Check file permissions in `AndroidManifest.xml`
- Ensure media URLs are accessible from mobile device

## 📝 Environment Variables

Create `.env` file in root:

```env
API_BASE_URL=http://10.0.2.2:8000
WS_BASE_URL=ws://10.0.2.2:8000
```

## 🚀 Deployment

### Android

1. Generate release keystore:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore odnix-release.keystore -alias odnix -keyalg RSA -keysize 2048 -validity 10000
```

1. Update `android/gradle.properties`:

```properties
ODNIX_RELEASE_STORE_FILE=odnix-release.keystore
ODNIX_RELEASE_KEY_ALIAS=odnix
ODNIX_RELEASE_STORE_PASSWORD=****
ODNIX_RELEASE_KEY_PASSWORD=****
```

1. Build:

```bash
cd android && ./gradlew assembleRelease
```

## 📄 License

This project is part of the Odnix social media platform.

## 🤝 Contributing

1. Ensure Django backend is running
2. Test on both physical device and emulator
3. Follow TypeScript best practices
4. Maintain existing code style

## 📞 Support

For issues related to:

- Backend API: Check Django server logs
- Mobile app: Check Metro bundler console
- Real-time features: Verify WebSocket connections

---

**Built with ❤️ for the Odnix platform**
