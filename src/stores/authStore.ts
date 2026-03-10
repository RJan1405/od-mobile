import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/config';
import api from '@/services/api';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    loadUser: () => Promise<void>;
    updateUser: (user: User) => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
            const response = await api.login(username, password);

            if (response.success && response.user) {
                set({
                    user: response.user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });
                return true;
            } else {
                set({
                    error: response.error || 'Login failed',
                    isLoading: false,
                });
                return false;
            }
        } catch (error) {
            set({
                error: 'Network error. Please try again.',
                isLoading: false,
            });
            return false;
        }
    },

    logout: async () => {
        try {
            await api.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            set({
                user: null,
                isAuthenticated: false,
                error: null,
            });
        }
    },

    loadUser: async () => {
        set({ isLoading: true });

        try {
            const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

            if (userData) {
                const user = JSON.parse(userData);

                // Trust the stored user data (session-based auth with mobile app)
                set({
                    user: user,
                    isAuthenticated: true,
                    isLoading: false,
                });
            } else {
                set({
                    user: null,
                    isAuthenticated: false,
                    isLoading: false
                });
            }
        } catch (error) {
            console.error('Load user error:', error);
            set({
                isLoading: false,
                user: null,
                isAuthenticated: false,
            });
        }
    },

    updateUser: (user: User) => {
        set({ user });
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    },

    clearError: () => set({ error: null }),
}));
