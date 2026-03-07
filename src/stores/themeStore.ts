import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, THEME_COLORS } from '@/config';

type ThemeType = keyof typeof THEME_COLORS;

interface ThemeState {
    theme: ThemeType;
    colors: typeof THEME_COLORS.dark;

    // Actions
    setTheme: (theme: ThemeType) => Promise<void>;
    loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
    theme: 'dark',
    colors: THEME_COLORS.dark,

    setTheme: async (theme: ThemeType) => {
        set({
            theme,
            colors: THEME_COLORS[theme],
        });
        await AsyncStorage.setItem(STORAGE_KEYS.THEME, theme);
    },

    loadTheme: async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
            if (savedTheme && savedTheme in THEME_COLORS) {
                const theme = savedTheme as ThemeType;
                set({
                    theme,
                    colors: THEME_COLORS[theme],
                });
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    },
}));
