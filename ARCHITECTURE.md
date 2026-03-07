# Odnix Mobile - Architecture Diagram

## 🏗️ Application Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ODNIX MOBILE APP                              │
│                   (React Native 0.74)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APP ENTRY POINT                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  index.js → App.tsx                                       │  │
│  │  - GestureHandlerRootView                                │  │
│  │  - SafeAreaProvider                                      │  │
│  │  - Load Theme & User                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NAVIGATION LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RootNavigator                                            │  │
│  │  ├── Stack Navigator (Auth/Main)                         │  │
│  │  └── Tab Navigator (Home/Explore/Omzo/Chats/Profile)    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│   SCREENS       │ │  COMPONENTS     │ │  STATE STORES    │
│                 │ │                 │ │                  │
│ • LoginScreen   │ │ • ScribeCard    │ │ • authStore      │
│ • HomeScreen    │ │ • OmzoCard      │ │ • chatStore      │
│ • ChatScreen    │ │ • StoryBar      │ │ • themeStore     │
│ • OmzoScreen    │ │ • Custom UI     │ │ (Zustand)        │
│ • ProfileScreen │ │   Components    │ │                  │
│ • ExploreScreen │ │                 │ │                  │
└─────────────────┘ └─────────────────┘ └──────────────────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                 │
│  ┌─────────────────────────┐  ┌───────────────────────────┐   │
│  │   API Service (HTTP)    │  │  WebSocket Service        │   │
│  │   ─────────────────     │  │  ─────────────────        │   │
│  │  • Login/Logout         │  │  • Chat Messages          │   │
│  │  • Get Profile          │  │  • Notifications          │   │
│  │  • Fetch Scribes        │  │  • Typing Indicators      │   │
│  │  • Send Messages        │  │  • Real-time Updates      │   │
│  │  • Upload Media         │  │  • Auto Reconnect         │   │
│  │  • Search               │  │                           │   │
│  │  • Axios + Interceptors │  │  • Native WebSocket       │   │
│  └─────────────────────────┘  └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DJANGO BACKEND                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                       │  │
│  │  ────────────────────                                     │  │
│  │  • /api/login/                                           │  │
│  │  • /api/profile/                                         │  │
│  │  • /api/chats/                                           │  │
│  │  • /api/explore-feed/                                    │  │
│  │  • /api/omzo/batch/                                      │  │
│  │  • ... (30+ endpoints)                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  WebSocket Channels                                       │  │
│  │  ─────────────────────                                    │  │
│  │  • ws/chat/<id>/                                         │  │
│  │  • ws/notify/                                            │  │
│  │  • ws/sidebar/                                           │  │
│  │  • ws/call/<id>/                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite)                             │
│  • Users, Messages, Chats, Scribes, Omzos, Stories, etc.       │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow

### User Login Flow

```
LoginScreen → authStore.login() → api.login() → Django /api/login/
     ↓                                                    ↓
Set user data ←─────────── Store session ←──────── Return user data
     ↓
Navigate to Main App
```

### Real-time Chat Flow

```
ChatScreen → Connect WebSocket → ws/chat/<id>/ → Django Channels
     ↓                                                   ↓
Display messages ←────── Receive event ←───────── Broadcast message
     ↓
Send message → websocket.send() → Django → Save DB → Broadcast
```

### Feed Loading Flow

```
HomeScreen → api.getExploreFeed() → Django /api/explore-feed/
     ↓                                        ↓
Display scribes ←──────────────────── Return paginated results
     ↓
Load more (infinite scroll) → Next page → ...
```

### Omzo Playback Flow

```
OmzoScreen → api.getOmzoBatch() → Django /api/omzo/batch/
     ↓                                      ↓
OmzoCard (Video Player) ←────────── Return video URLs
     ↓
Track view → api.trackOmzoView() → Update view count
```

## 🔄 State Management Flow

```
┌──────────────┐
│   Component  │
└──────┬───────┘
       │ useStore()
       ▼
┌──────────────┐
│  Zustand     │◄────┐
│  Store       │     │
└──────┬───────┘     │
       │             │
       │ Action      │ Update
       ▼             │
┌──────────────┐     │
│  API/Service │─────┘
└──────────────┘
```

### Example: Like a Scribe

```
1. User taps heart icon
   ↓
2. ScribeCard calls handleLike()
   ↓
3. api.toggleLike(scribeId)
   ↓
4. Django updates database
   ↓
5. Return success
   ↓
6. Update local state (optimistic update)
   ↓
7. UI reflects change immediately
```

## 🎨 Component Hierarchy

```
App
└── RootNavigator
    ├── LoginScreen (if not authenticated)
    └── MainTabs (if authenticated)
        ├── HomeScreen
        │   ├── StoryBar
        │   └── ScribeCard (list)
        ├── ExploreScreen
        ├── OmzoScreen
        │   └── OmzoCard (vertical list)
        ├── ChatListScreen
        └── ProfileScreen
```

## 🔐 Authentication Flow

```
┌─────────────┐
│ App Startup │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Load saved user data │
│ from AsyncStorage    │
└──────┬───────────────┘
       │
       ├─── User found? ───┐
       │                   │
     Yes                  No
       │                   │
       ▼                   ▼
┌──────────────┐    ┌─────────────┐
│ Verify with  │    │ Show Login  │
│ Django       │    │ Screen      │
└──────┬───────┘    └─────────────┘
       │
    Valid?
       │
       ├─── Yes ──► Show Main App
       │
       └─── No ──► Show Login Screen
```

## 📡 WebSocket Architecture

```
┌──────────────────┐
│  WebSocket       │
│  Service         │
├──────────────────┤
│ • connectToChat  │────┐
│ • connectNotify  │    │
│ • connectSidebar │    │
│ • Auto-reconnect │    │
└──────────────────┘    │
                        ▼
              ┌─────────────────┐
              │  Socket Manager │
              ├─────────────────┤
              │  Chat #1: ws1   │
              │  Chat #2: ws2   │
              │  Notify: ws3    │
              │  Sidebar: ws4   │
              └─────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Event Handlers │
              ├─────────────────┤
              │  • message.new  │
              │  • typing       │
              │  • notify.*     │
              └─────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  State Updates  │
              │  (Stores)       │
              └─────────────────┘
```

## 🎯 Key Design Patterns

1. **Container/Presentational Pattern**
   - Screens = Containers (logic)
   - Components = Presentational (UI)

2. **Service Layer Pattern**
   - Centralized API/WebSocket logic
   - Consistent error handling

3. **Store Pattern (Zustand)**
   - Centralized state management
   - Actions + State in one place

4. **Observer Pattern**
   - WebSocket event listeners
   - State subscribers

5. **Singleton Pattern**
   - API service instance
   - WebSocket service instance

---

This architecture provides:

- ✅ Separation of concerns
- ✅ Scalability
- ✅ Maintainability
- ✅ Testability
- ✅ Real-time capabilities
- ✅ Type safety (TypeScript)
