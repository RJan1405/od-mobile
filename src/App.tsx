import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { THEME_INFO } from '@/config';

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
                <RootNavigator />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

export default App;
