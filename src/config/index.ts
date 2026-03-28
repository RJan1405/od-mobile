import { API_BASE_URL, WS_BASE_URL } from '@env';

// API Configuration
// For Android emulator: Use 10.0.2.2
// For physical phone: Use your computer's local IP (run: ipconfig)
export const API_CONFIG = {
    BASE_URL: API_BASE_URL || 'http://localhost:8000',
    WS_URL: WS_BASE_URL || 'ws://localhost:8000',
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

// Theme Colors matching React Odnix Frontend (Synced from odnix-flow)
export const THEME_COLORS = {
    light: {
        primary: "#3B82F6",      // Updated to match flow
        secondary: "#F1F5F9",
        background: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#0F1729",
        textSecondary: "#64748B",
        border: "#E2E8F0",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#7C3BED",
    },
    dark: {
        primary: "#60A5FA",
        secondary: "#1F2937",
        background: "#030712",
        surface: "#111827",
        text: "#F1F5F9",
        textSecondary: "#94A3B8",
        border: "#1F2937",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#8B5CF6",
    },
    'tokyo-night': {
        primary: "#30BAE8",
        secondary: "#7953C6",
        background: "#11131D",
        surface: "#1B1D28",
        text: "#E7E9EF",
        textSecondary: "#A3ACB9",
        border: "#272935",
        error: "#F7768E",
        success: "#9ECE6A",
        accent: "#E05281",
    },
    nord: {
        primary: "#87BFCF",
        secondary: "#81A1C1",
        background: "#22272F",
        surface: "#2D3440",
        text: "#D8DEE9",
        textSecondary: "#81A1C1",
        border: "#2F3541",
        error: "#BF616A",
        success: "#A3BE8C",
        accent: "#B48EAD",
    },
    mint: {
        primary: "#27B07D",
        secondary: "#E7EFEB",
        background: "#F6F9F7",
        surface: "#FFFFFF",
        text: "#0F241A",
        textSecondary: "#4D635D",
        border: "#DCE5E0",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#D7428C",
    },
    coral: {
        primary: "#EF6639",
        secondary: "#CC8033",
        background: "#170F0C",
        surface: "#251B18",
        text: "#EFE9E7",
        textSecondary: "#A39794",
        border: "#302521",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#33A6CC",
    },
    slate: {
        primary: "#4D82CB",
        secondary: "#2A3646",
        background: "#161B22",
        surface: "#1B2027",
        text: "#DCE0E5",
        textSecondary: "#8E949E",
        border: "#272D35",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#DDB43C",
    },
    sky: {
        primary: "#189BDC",
        secondary: "#E0E7EB",
        background: "#F5F8F9",
        surface: "#FFFFFF",
        text: "#121A21",
        textSecondary: "#616A73",
        border: "#D9E0E3",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#D14775",
    },
    lavender: {
        primary: "#A670DB",
        secondary: "#B464B4",
        background: "#18141F",
        surface: "#1D1924",
        text: "#E4E2E9",
        textSecondary: "#9E9AA3",
        border: "#312C3A",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#E0BD52",
    },
    mocha: {
        primary: "#CB8C4D",
        secondary: "#8A5A42",
        background: "#171411",
        surface: "#1D1A16",
        text: "#E7E1DA",
        textSecondary: "#A39E98",
        border: "#322E29",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#409FBF",
    },
    amoled: {
        primary: "#3B82F6",
        secondary: "#1F2937",
        background: "#000000",
        surface: "#0D0D0D",
        text: "#FFFFFF",
        textSecondary: "#94A3B8",
        border: "#262626",
        error: "#EF4444",
        success: "#22C55E",
        accent: "#8B5CF6",
    },
};

// Theme metadata for UI display
export const THEME_INFO: Record<keyof typeof THEME_COLORS, { name: string; description: string; icon: string; isDark: boolean }> = {
    light: {
        name: 'Light',
        description: 'Clean and bright interface',
        icon: '☀️',
        isDark: false,
    },
    dark: {
        name: 'Dark',
        description: 'Classic dark mode experience',
        icon: '🌙',
        isDark: true,
    },
    'tokyo-night': {
        name: 'Tokyo Night',
        description: 'Vibrant neon city vibes',
        icon: '🌃',
        isDark: true,
    },
    nord: {
        name: 'Nord',
        description: 'Arctic blue professional look',
        icon: '❄️',
        isDark: true,
    },
    mint: {
        name: 'Mint',
        description: 'Fresh and herbal aesthetic',
        icon: '🌿',
        isDark: false,
    },
    coral: {
        name: 'Coral',
        description: 'Warm ocean sunset tones',
        icon: '🪸',
        isDark: true,
    },
    slate: {
        name: 'Slate',
        description: 'Sleek industrial gray palette',
        icon: '🪨',
        isDark: true,
    },
    sky: {
        name: 'Sky',
        description: 'Airy and light blue theme',
        icon: '🌤️',
        isDark: false,
    },
    lavender: {
        name: 'Lavender',
        description: 'Soft purple and dreamlike',
        icon: '💜',
        isDark: true,
    },
    mocha: {
        name: 'Mocha',
        description: 'Warm coffee and earth tones',
        icon: '☕',
        isDark: true,
    },
    amoled: {
        name: 'AMOLED',
        description: 'Deep black for OLED priority',
        icon: '⚫',
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
