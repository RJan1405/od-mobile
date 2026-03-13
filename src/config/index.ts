import { API_BASE_URL, WS_BASE_URL } from '@env';

// API Configuration
// For Android emulator: Use 10.0.2.2
// For physical phone: Use your computer's local IP (run: ipconfig)
export const API_CONFIG = {
    BASE_URL: API_BASE_URL || 'http://10.0.2.2:8000',
    WS_URL: WS_BASE_URL || 'ws://10.0.2.2:8000',
    TIMEOUT: 30000,
};

// App Configuration
export const APP_CONFIG = {
    APP_NAME: 'Odnix',
    VERSION: '1.0.0',
    ITEMS_PER_PAGE: 20,
    MAX_IMAGE_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
};

// Theme Colors matching React Odnix Frontend
export const THEME_COLORS = {
    // Dark theme (Default - Teal accents)
    dark: {
        primary: '#26D9C6',      // hsl(175 80% 50%)
        secondary: '#BE5FD9',    // hsl(280 70% 60%)
        background: '#0D1117',   // hsl(220 20% 6%)
        surface: '#161B22',      // hsl(220 18% 10%)
        text: '#F8FAFC',         // hsl(210 40% 98%)
        textSecondary: '#8B949E', // hsl(215 20% 55%)
        border: '#30363D',       // hsl(220 15% 20%)
        error: '#E55353',        // hsl(0 75% 55%)
        success: '#3FB950',      // hsl(145 70% 45%)
        accent: '#BE5FD9',       // hsl(280 70% 60%)
    },
    // Light theme
    light: {
        primary: '#0969DA',      // hsl(200 90% 40%)
        secondary: '#8250DF',    // hsl(280 70% 55%)
        background: '#F9FAFB',   // hsl(220 10% 98%)
        surface: '#FFFFFF',      // hsl(0 0% 100%)
        text: '#1F2328',         // hsl(220 10% 12%)
        textSecondary: '#656D76', // hsl(220 10% 36%)
        border: '#D0D7DE',       // hsl(220 10% 86%)
        error: '#D1242F',
        success: '#1A7F37',
        accent: '#8250DF',
    },
    // AMOLED theme (True black)
    amoled: {
        primary: '#26D9C6',
        secondary: '#BE5FD9',
        background: '#000000',   // True black
        surface: '#0D0D0D',      // hsl(0 0% 5%)
        text: '#F8FAFC',
        textSecondary: '#8B949E',
        border: '#262626',       // hsl(0 0% 15%)
        error: '#E55353',
        success: '#3FB950',
        accent: '#BE5FD9',
    },
    // Dracula theme
    dracula: {
        primary: '#50FA7B',      // hsl(135 94% 65%)
        secondary: '#FF79C6',    // hsl(326 100% 74%)
        background: '#282A36',   // hsl(231 15% 13%)
        surface: '#343746',      // hsl(232 14% 18%)
        text: '#F8F8F2',         // hsl(60 30% 96%)
        textSecondary: '#6272A4', // hsl(225 14% 58%)
        border: '#44475A',
        error: '#FF5555',
        success: '#50FA7B',
        accent: '#FF79C6',
    },
    // Nord theme
    nord: {
        primary: '#88C0D0',      // hsl(193 43% 67%)
        secondary: '#B48EAD',    // hsl(311 20% 63%)
        background: '#2E3440',   // hsl(220 16% 16%)
        surface: '#3B4252',      // hsl(220 16% 20%)
        text: '#ECEFF4',         // hsl(218 27% 88%)
        textSecondary: '#81A1C1', // hsl(219 14% 58%)
        border: '#4C566A',
        error: '#BF616A',
        success: '#A3BE8C',
        accent: '#B48EAD',
    },
    // Cyberpunk theme
    cyberpunk: {
        primary: '#FFFF00',      // hsl(55 100% 50%)
        secondary: '#FF1493',    // hsl(320 100% 60%)
        background: '#0D0221',   // hsl(270 50% 5%)
        surface: '#190F33',      // hsl(270 45% 10%)
        text: '#F7F700',         // hsl(60 100% 95%)
        textSecondary: '#A277D9', // hsl(270 20% 55%)
        border: '#3F2A5C',
        error: '#FF1493',
        success: '#00FF41',
        accent: '#FF1493',
    },
    // Synthwave theme
    synthwave: {
        primary: '#FF3864',      // hsl(320 100% 65%)
        secondary: '#00F0FF',    // hsl(180 100% 60%)
        background: '#1A0A2E',   // hsl(260 50% 8%)
        surface: '#231247',      // hsl(260 45% 12%)
        text: '#F5F0F7',         // hsl(300 20% 95%)
        textSecondary: '#A277D9', // hsl(260 20% 55%)
        border: '#3F2A5C',
        error: '#FF3864',
        success: '#00FF41',
        accent: '#00F0FF',
    },
};

// Theme metadata for UI display
export const THEME_INFO: Record<keyof typeof THEME_COLORS, { name: string; description: string; icon: string; isDark: boolean }> = {
    dark: {
        name: 'Dark',
        description: 'Modern dark with teal accents',
        icon: '🌙',
        isDark: true,
    },
    light: {
        name: 'Light',
        description: 'Clean and bright interface',
        icon: '☀️',
        isDark: false,
    },
    amoled: {
        name: 'AMOLED',
        description: 'True black for OLED displays',
        icon: '⚫',
        isDark: true,
    },
    dracula: {
        name: 'Dracula',
        description: 'Purple dark with neon accents',
        icon: '🧛',
        isDark: true,
    },
    nord: {
        name: 'Nord',
        description: 'Cool arctic blue palette',
        icon: '❄️',
        isDark: true,
    },
    cyberpunk: {
        name: 'Cyberpunk',
        description: 'Neon yellow and pink future',
        icon: '🤖',
        isDark: true,
    },
    synthwave: {
        name: 'Synthwave',
        description: 'Retro 80s neon vibes',
        icon: '🌆',
        isDark: true,
    },
};

// Storage Keys
export const STORAGE_KEYS = {
    AUTH_TOKEN: '@odnix_auth_token',
    USER_DATA: '@odnix_user_data',
    THEME: '@odnix_theme',
    NOTIFICATIONS_ENABLED: '@odnix_notifications',
};
