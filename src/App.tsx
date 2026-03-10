import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { THEME_INFO } from '@/config';

import websocket from '@/services/websocket';
import { navigationRef } from '@/navigation/RootNavigator';

function GlobalCallHandler() {
    const { user, isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (!isAuthenticated) return;

        console.log('Registering global call listener for user:', user?.id);
        const unsubscribe = websocket.connectToNotifications((data) => {
            console.log('Notification received:', data.type);
            if (data.type === 'incoming.call') {
                const { from_user_id, chat_id, audioOnly, from_full_name, from_avatar } = data;

                // Navigate to Call screen
                if (navigationRef.isReady()) {
                    const callUser = {
                        id: from_user_id,
                        full_name: from_full_name,
                        profile_picture_url: from_avatar,
                    };

                    navigationRef.navigate(audioOnly ? 'VoiceCall' : 'VideoCall' as any, {
                        user: callUser,
                        chatId: chat_id,
                        isIncoming: true,
                    } as any);
                }
            }
        });

        return () => {
            unsubscribe();
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
    }, []);

    const themeInfo = THEME_INFO[theme];

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar
                    barStyle={themeInfo.isDark ? 'light-content' : 'dark-content'}
                    backgroundColor={colors.background}
                />
                <GlobalCallHandler />
                <RootNavigator />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

export default App;
