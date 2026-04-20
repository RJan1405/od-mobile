import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/config';
import api from '@/services/api';
import { StorageCleanup } from '@/services/mmkvStorage';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import type { User } from '@/types';


interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    confirmation: FirebaseAuthTypes.ConfirmationResult | null;

    // Actions
    login: (username: string, password: string) => Promise<boolean>;
    checkAvailability: (data: any) => Promise<{ success: boolean; error?: string }>;
    register: (data: any) => Promise<{ success: boolean; requiresOtp?: boolean; userId?: number; phoneNumber?: string }>;
    verifyPhoneOtp: (otp: string, userId?: number, phoneNumber?: string) => Promise<boolean>;
    registerAndSendEmailOtp: (registrationData: any) => Promise<boolean>;
    verifyEmailOtp: (code: string, email: string) => Promise<boolean>;
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
    confirmation: null,

    registerAndSendEmailOtp: async (registrationData: any) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.register(registrationData);
            if (response.success && response.requires_otp) {
                set({ isLoading: false, error: null });
                return true;
            } else {
                set({ error: response.error || 'Failed to send expected email OTP', isLoading: false });
                return false;
            }
        } catch (error: any) {
            set({ error: error.message || 'Failed to register', isLoading: false });
            return false;
        }
    },

    verifyEmailOtp: async (code: string, email: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.verifyEmailOtp(code, email);

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
                    error: response.error || 'Verification failed',
                    isLoading: false,
                });
                return false;
            }
        } catch (error: any) {
            console.error('Email OTP verify error:', error);
            set({
                error: error.message || 'Invalid or expired code',
                isLoading: false
            });
            return false;
        }
    },

    checkAvailability: async (data: any) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.checkAvailability(data);
            if (response.success) {
                set({ isLoading: false });
                return { success: true };
            } else {
                set({ error: response.error || 'Check failed', isLoading: false });
                return { success: false, error: response.error };
            }
        } catch (error: any) {
            set({ error: 'Network error. Please try again.', isLoading: false });
            return { success: false, error: 'Network error' };
        }
    },

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

    register: async (data: any) => {
        set({ isLoading: true, error: null });

        try {
            const response = await api.register(data);

            if (response.success && response.requires_otp) {
                set({ isLoading: false });
                return {
                    success: true,
                    requiresOtp: true,
                    userId: response.user_id,
                    phoneNumber: response.phone_number
                };
            }

            if (response.success && response.user) {
                set({
                    user: response.user,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                });
                return { success: true };
            } else {
                set({
                    error: response.error || 'Registration failed',
                    isLoading: false,
                });
                return { success: false };
            }
        } catch (error) {
            set({
                error: 'Network error. Please try again.',
                isLoading: false,
            });
            return { success: false };
        }
    },

    verifyPhoneOtp: async (otp: string, userId?: number, phoneNumber?: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.verifyPhoneOtp(otp, userId, phoneNumber);

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
                    error: response.error || 'Verification failed',
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
            // Clear MMKV cache on logout (security)
            try {
                StorageCleanup.clearAllData();
            } catch (error) {
                console.error('Failed to clear MMKV cache on logout:', error);
            }

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
