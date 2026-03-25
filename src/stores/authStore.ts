import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/config';
import api from '@/services/api';
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
    sendFirebaseOtp: (phone: string) => Promise<boolean>;
    verifyFirebaseOtp: (code: string, registrationData: any) => Promise<boolean>;
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

    sendFirebaseOtp: async (phone: string) => {
        set({ isLoading: true, error: null });
        try {
            // Use the namespaced API — suppressing deprecation warnings
            // until we can fully migrate to react-native-firebase v23 modular API.
            const firebaseAuth = require('@react-native-firebase/auth');
            // The package exports the auth() factory as either default or the module itself
            const authFactory = firebaseAuth.default ?? firebaseAuth;
            if (typeof authFactory !== 'function') {
                throw new Error('Firebase Auth native module not available. Please rebuild the app.');
            }
            const confirmation = await authFactory().signInWithPhoneNumber(phone);
            set({ confirmation, isLoading: false });
            return true;
        } catch (error: any) {
            console.error('Firebase SMS send error:', error);
            set({ 
                error: error.message || 'Failed to send SMS code', 
                isLoading: false 
            });
            return false;
        }
    },

    verifyFirebaseOtp: async (code: string, registrationData: any) => {
        set({ isLoading: true, error: null });
        try {
            const { confirmation } = get();
            if (!confirmation) {
                set({ error: 'No active confirmation session', isLoading: false });
                return false;
            }

            // 1. Confirm the code with Firebase
            const userCredential = await confirmation.confirm(code);
            if (!userCredential?.user) {
                set({ error: 'Firebase verification failed', isLoading: false });
                return false;
            }

            // 2. Get the IdToken — use the instance method on the user object
            const idToken = await userCredential.user.getIdToken();

            // 3. Register user in our backend
            const response = await api.firebaseRegister(idToken, registrationData);

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
                    error: response.error || 'Backend registration failed',
                    isLoading: false,
                });
                return false;
            }
        } catch (error: any) {
            console.error('Firebase OTP verify error:', error);
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
