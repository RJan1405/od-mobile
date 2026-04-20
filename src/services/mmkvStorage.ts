/**
 * MMKV Storage Service
 * Provides persistent storage for:
 * - Chats and messages
 * - Interactions (likes, saves, comments)
 * - User uploads (scribes and omzos)
 * - Unread counts
 * - Pending actions
 */

import { MMKV } from 'react-native-mmkv';
import type { Chat, Message, Scribe, Omzo } from '@/types';

const storage = new MMKV({
    id: 'odnix-app-storage',
});

const STORAGE_KEYS = {
    // Chats
    CHATS: 'chats',
    CHAT_MESSAGES: (chatId: number) => `chat_messages_${chatId}`,
    UNREAD_COUNTS: (chatId: number) => `unread_count_${chatId}`,
    ALL_UNREAD_COUNTS: 'all_unread_counts',

    // Interactions
    INTERACTIONS: 'interactions',
    INTERACTION: (type: string, id: number | string) => `interaction_${type}_${id}`,

    // User uploads
    MY_SCRIBES: 'my_scribes',
    MY_OMZOS: 'my_omzos',
    SAVED_SCRIBES: 'saved_scribes',
    SAVED_OMZOS: 'saved_omzos',

    // Pending actions
    PENDING_ACTIONS: 'pending_actions',

    // Cache metadata
    LAST_SYNC_TIME: (resource: string) => `last_sync_${resource}`,
};

// ============================================================================
// CHAT & MESSAGE STORAGE
// ============================================================================

export const ChatStorage = {
    // Save all chats
    saveChats: (chats: Chat[]) => {
        try {
            storage.set(STORAGE_KEYS.CHATS, JSON.stringify(chats));
        } catch (error) {
            console.error('❌ Failed to save chats to MMKV:', error);
        }
    },

    // Load all chats
    getChats: (): Chat[] => {
        try {
            const data = storage.getString(STORAGE_KEYS.CHATS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Failed to load chats from MMKV:', error);
            return [];
        }
    },

    // Save messages for a specific chat
    saveMessages: (chatId: number, messages: Message[]) => {
        try {
            storage.set(STORAGE_KEYS.CHAT_MESSAGES(chatId), JSON.stringify(messages));
        } catch (error) {
            console.error(`❌ Failed to save messages for chat ${chatId}:`, error);
        }
    },

    // Load messages for a specific chat
    getMessages: (chatId: number): Message[] => {
        try {
            const data = storage.getString(STORAGE_KEYS.CHAT_MESSAGES(chatId));
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`❌ Failed to load messages for chat ${chatId}:`, error);
            return [];
        }
    },

    // Add a single message (append to existing)
    addMessage: (chatId: number, message: Message) => {
        try {
            const messages = ChatStorage.getMessages(chatId);
            messages.push(message);
            ChatStorage.saveMessages(chatId, messages);
        } catch (error) {
            console.error('❌ Failed to add message:', error);
        }
    },

    // Update a specific message
    updateMessage: (chatId: number, messageId: number, updates: Partial<Message>) => {
        try {
            const messages = ChatStorage.getMessages(chatId);
            const index = messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                messages[index] = { ...messages[index], ...updates };
                ChatStorage.saveMessages(chatId, messages);
            }
        } catch (error) {
            console.error('❌ Failed to update message:', error);
        }
    },

    // Remove a message
    removeMessage: (chatId: number, messageId: number) => {
        try {
            const messages = ChatStorage.getMessages(chatId);
            const filtered = messages.filter(m => m.id !== messageId);
            ChatStorage.saveMessages(chatId, filtered);
        } catch (error) {
            console.error('❌ Failed to remove message:', error);
        }
    },

    // Clear all messages for a chat
    clearMessages: (chatId: number) => {
        try {
            storage.delete(STORAGE_KEYS.CHAT_MESSAGES(chatId));
        } catch (error) {
            console.error(`❌ Failed to clear messages for chat ${chatId}:`, error);
        }
    },

    // Save unread count for a chat
    setUnreadCount: (chatId: number, count: number) => {
        try {
            storage.set(STORAGE_KEYS.UNREAD_COUNTS(chatId), count);
        } catch (error) {
            console.error(`❌ Failed to save unread count for chat ${chatId}:`, error);
        }
    },

    // Get unread count for a chat
    getUnreadCount: (chatId: number): number => {
        try {
            return storage.getNumber(STORAGE_KEYS.UNREAD_COUNTS(chatId)) || 0;
        } catch (error) {
            console.error(`❌ Failed to get unread count for chat ${chatId}:`, error);
            return 0;
        }
    },

    // Get all unread counts as Map
    getAllUnreadCounts: (): Map<number, number> => {
        try {
            const data = storage.getString(STORAGE_KEYS.ALL_UNREAD_COUNTS);
            if (data) {
                const obj = JSON.parse(data);
                return new Map(Object.entries(obj).map(([key, val]) => [parseInt(key), val as number]));
            }
            return new Map();
        } catch (error) {
            console.error('❌ Failed to get all unread counts:', error);
            return new Map();
        }
    },

    // Save all unread counts
    saveAllUnreadCounts: (counts: Map<number, number>) => {
        try {
            const obj = Object.fromEntries(counts);
            storage.set(STORAGE_KEYS.ALL_UNREAD_COUNTS, JSON.stringify(obj));
        } catch (error) {
            console.error('❌ Failed to save all unread counts:', error);
        }
    },

    // Clear all chat data
    clearAllChats: () => {
        try {
            storage.delete(STORAGE_KEYS.CHATS);
            storage.delete(STORAGE_KEYS.ALL_UNREAD_COUNTS);
            // Note: Individual chat messages are not cleared here
        } catch (error) {
            console.error('❌ Failed to clear all chats:', error);
        }
    },
};

// ============================================================================
// INTERACTION STORAGE (Likes, Saves, Comments)
// ============================================================================

export const InteractionStorage = {
    // Save interaction state for an item
    setInteraction: (type: 'omzo' | 'scribe', id: number | string, state: any) => {
        try {
            const key = STORAGE_KEYS.INTERACTION(type, id);
            storage.set(key, JSON.stringify(state));
        } catch (error) {
            console.error(`❌ Failed to save interaction for ${type} ${id}:`, error);
        }
    },

    // Get interaction state for an item
    getInteraction: (type: 'omzo' | 'scribe', id: number | string) => {
        try {
            const key = STORAGE_KEYS.INTERACTION(type, id);
            const data = storage.getString(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`❌ Failed to get interaction for ${type} ${id}:`, error);
            return null;
        }
    },

    // Get all interactions
    getAllInteractions: (): Record<string, any> => {
        try {
            const data = storage.getString(STORAGE_KEYS.INTERACTIONS);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('❌ Failed to get all interactions:', error);
            return {};
        }
    },

    // Batch save interactions
    batchSetInteractions: (updates: Record<string, any>) => {
        try {
            const existing = InteractionStorage.getAllInteractions();
            const merged = { ...existing, ...updates };
            storage.set(STORAGE_KEYS.INTERACTIONS, JSON.stringify(merged));
        } catch (error) {
            console.error('❌ Failed to batch save interactions:', error);
        }
    },

    // Clear all interactions
    clearInteractions: () => {
        try {
            storage.delete(STORAGE_KEYS.INTERACTIONS);
        } catch (error) {
            console.error('❌ Failed to clear interactions:', error);
        }
    },
};

// ============================================================================
// USER UPLOADS STORAGE (Scribes & Omzos)
// ============================================================================

export const UploadStorage = {
    // Save user's own scribes
    saveMyScribes: (scribes: Scribe[]) => {
        try {
            storage.set(STORAGE_KEYS.MY_SCRIBES, JSON.stringify(scribes));
        } catch (error) {
            console.error('❌ Failed to save my scribes:', error);
        }
    },

    // Get user's own scribes
    getMyScribes: (): Scribe[] => {
        try {
            const data = storage.getString(STORAGE_KEYS.MY_SCRIBES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Failed to get my scribes:', error);
            return [];
        }
    },

    // Save user's own omzos
    saveMyOmzos: (omzos: Omzo[]) => {
        try {
            storage.set(STORAGE_KEYS.MY_OMZOS, JSON.stringify(omzos));
        } catch (error) {
            console.error('❌ Failed to save my omzos:', error);
        }
    },

    // Get user's own omzos
    getMyOmzos: (): Omzo[] => {
        try {
            const data = storage.getString(STORAGE_KEYS.MY_OMZOS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Failed to get my omzos:', error);
            return [];
        }
    },

    // Save saved scribes
    saveSavedScribes: (scribes: Scribe[]) => {
        try {
            storage.set(STORAGE_KEYS.SAVED_SCRIBES, JSON.stringify(scribes));
        } catch (error) {
            console.error('❌ Failed to save saved scribes:', error);
        }
    },

    // Get saved scribes
    getSavedScribes: (): Scribe[] => {
        try {
            const data = storage.getString(STORAGE_KEYS.SAVED_SCRIBES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Failed to get saved scribes:', error);
            return [];
        }
    },

    // Save saved omzos
    saveSavedOmzos: (omzos: Omzo[]) => {
        try {
            storage.set(STORAGE_KEYS.SAVED_OMZOS, JSON.stringify(omzos));
        } catch (error) {
            console.error('❌ Failed to save saved omzos:', error);
        }
    },

    // Get saved omzos
    getSavedOmzos: (): Omzo[] => {
        try {
            const data = storage.getString(STORAGE_KEYS.SAVED_OMZOS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Failed to get saved omzos:', error);
            return [];
        }
    },

    // Add a single scribe to my uploads
    addMyScribe: (scribe: Scribe) => {
        try {
            const scribes = UploadStorage.getMyScribes();
            scribes.unshift(scribe); // Add to beginning
            UploadStorage.saveMyScribes(scribes);
        } catch (error) {
            console.error('❌ Failed to add scribe:', error);
        }
    },

    // Add a single omzo to my uploads
    addMyOmzo: (omzo: Omzo) => {
        try {
            const omzos = UploadStorage.getMyOmzos();
            omzos.unshift(omzo); // Add to beginning
            UploadStorage.saveMyOmzos(omzos);
        } catch (error) {
            console.error('❌ Failed to add omzo:', error);
        }
    },

    // Clear all upload data
    clearAllUploads: () => {
        try {
            storage.delete(STORAGE_KEYS.MY_SCRIBES);
            storage.delete(STORAGE_KEYS.MY_OMZOS);
            storage.delete(STORAGE_KEYS.SAVED_SCRIBES);
            storage.delete(STORAGE_KEYS.SAVED_OMZOS);
        } catch (error) {
            console.error('❌ Failed to clear all uploads:', error);
        }
    },
};

// ============================================================================
// PENDING ACTIONS STORAGE
// ============================================================================

export const PendingActionsStorage = {
    // Save pending actions
    savePendingActions: (actions: any[]) => {
        try {
            storage.set(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(actions));
        } catch (error) {
            console.error('❌ Failed to save pending actions:', error);
        }
    },

    // Get pending actions
    getPendingActions: (): any[] => {
        try {
            const data = storage.getString(STORAGE_KEYS.PENDING_ACTIONS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Failed to get pending actions:', error);
            return [];
        }
    },

    // Add a pending action
    addPendingAction: (action: any) => {
        try {
            const actions = PendingActionsStorage.getPendingActions();
            actions.push(action);
            PendingActionsStorage.savePendingActions(actions);
        } catch (error) {
            console.error('❌ Failed to add pending action:', error);
        }
    },

    // Remove a pending action
    removePendingAction: (actionId: string) => {
        try {
            const actions = PendingActionsStorage.getPendingActions();
            const filtered = actions.filter((a: any) => a.id !== actionId);
            PendingActionsStorage.savePendingActions(filtered);
        } catch (error) {
            console.error('❌ Failed to remove pending action:', error);
        }
    },

    // Clear all pending actions
    clearPendingActions: () => {
        try {
            storage.delete(STORAGE_KEYS.PENDING_ACTIONS);
        } catch (error) {
            console.error('❌ Failed to clear pending actions:', error);
        }
    },
};

// ============================================================================
// SYNC METADATA
// ============================================================================

export const SyncMetadata = {
    // Save last sync time for a resource
    setLastSyncTime: (resource: string, timestamp: number) => {
        try {
            storage.set(STORAGE_KEYS.LAST_SYNC_TIME(resource), timestamp);
        } catch (error) {
            console.error(`❌ Failed to save last sync time for ${resource}:`, error);
        }
    },

    // Get last sync time for a resource
    getLastSyncTime: (resource: string): number => {
        try {
            return storage.getNumber(STORAGE_KEYS.LAST_SYNC_TIME(resource)) || 0;
        } catch (error) {
            console.error(`❌ Failed to get last sync time for ${resource}:`, error);
            return 0;
        }
    },

    // Check if data needs refresh (older than maxAge ms)
    needsRefresh: (resource: string, maxAge: number = 5 * 60 * 1000): boolean => {
        const lastSync = SyncMetadata.getLastSyncTime(resource);
        return Date.now() - lastSync > maxAge;
    },
};

// ============================================================================
// CLEANUP & UTILITIES
// ============================================================================

export const StorageCleanup = {
    // Clear all data (use with caution!)
    clearAllData: () => {
        try {
            storage.clearAll();
            console.log('✅ All MMKV data cleared');
        } catch (error) {
            console.error('❌ Failed to clear all data:', error);
        }
    },

    // Get storage size
    getStorageSize: (): string => {
        try {
            const size = storage.getAllKeys().length;
            return `${size} keys stored`;
        } catch (error) {
            console.error('❌ Failed to get storage size:', error);
            return 'Unknown';
        }
    },

    // Log all stored keys (for debugging)
    logAllKeys: () => {
        try {
            const keys = storage.getAllKeys();
            console.log('📦 MMKV Storage Keys:', keys);
        } catch (error) {
            console.error('❌ Failed to log keys:', error);
        }
    },
};

export default storage;
