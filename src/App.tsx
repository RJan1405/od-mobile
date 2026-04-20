import React, { useEffect, useRef } from 'react';
import { StatusBar, AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import { useUploadStore } from '@/stores/uploadStore';
import { THEME_INFO } from '@/config';
import { usePendingActionsRecovery } from '@/hooks/usePendingActionsRecovery';
import { useInteractionCache } from '@/stores/interactionCache';

import websocket from '@/services/websocket';
import { navigationRef } from '@/navigation/RootNavigator';

function GlobalPresenceHandler() {
    const { user, isAuthenticated } = useAuthStore();
    const { loadChats } = useChatStore();
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        if (!isAuthenticated || !user) return;

        console.log('🌐 Registering global presence for user:', user.id);

        // 1. Maintain Notification Socket
        const unsubscribeNotify = websocket.connectToNotifications((data) => {
            if (data.type === 'incoming.call' && navigationRef.isReady()) {
                const callUser = { id: data.from_user_id, full_name: data.from_full_name, profile_picture_url: data.from_avatar };
                navigationRef.navigate(data.audioOnly ? 'VoiceCall' : 'VideoCall' as any, { user: callUser, chatId: data.chat_id, isIncoming: true } as any);
            }
        });

        // 2. Maintain Sidebar Socket & Presence Heartbeat
        const unsubscribeSidebar = websocket.connectToSidebar((event) => {
            if (event.type === 'new_chat' || (event.type === 'sidebar_update' && event.unread_count > 0)) {
                loadChats();
            }
        });

        // Setup periodic heartbeat (Every 15 seconds for higher reliability)
        const heartbeatInterval = setInterval(() => {
            if (appState.current === 'active') {
                websocket.sendPresence('active');
            }
        }, 15000);

        // Initial burst: send twice with delay to guarantee server catch
        websocket.sendPresence('active');
        const timeout = setTimeout(() => websocket.sendPresence('active'), 5000);

        // Handle App foreground/background
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                console.log('☀️ App focused - sending active status');
                websocket.sendPresence('active');
            } else if (nextAppState.match(/inactive|background/)) {
                console.log('🌙 App backgrounded - sending away status');
                websocket.sendPresence('away');
            }
            appState.current = nextAppState;
        });

        return () => {
            console.log('🔌 Cleaning up global presence');
            clearInterval(heartbeatInterval);
            clearTimeout(timeout);
            subscription.remove();
            unsubscribeNotify();
            unsubscribeSidebar();
        };
    }, [isAuthenticated, user?.id]);

    return null;
}

function App(): React.JSX.Element {
    const { loadUser } = useAuthStore();
    const { loadTheme, colors, theme } = useThemeStore();

    useEffect(() => {
        // Load saved theme and user data on app start
        loadTheme();
        loadUser();

        // Load caches from persistent storage
        useChatStore.getState().loadChatsFromCache();
        useUploadStore.getState().loadFromCache();
        useInteractionCache.getState().loadFromCache();
    }, []);

    const themeInfo = THEME_INFO[theme];

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar
                    barStyle={themeInfo.isDark ? 'light-content' : 'dark-content'}
                    backgroundColor={colors.background}
                />
                <PendingActionsRecoveryHandler />
                <GlobalPresenceHandler />
                <RootNavigator />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

// Component to handle pending actions recovery
function PendingActionsRecoveryHandler() {
    usePendingActionsRecovery();
    return null;
}

export default App;
