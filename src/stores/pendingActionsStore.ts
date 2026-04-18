import { create } from 'zustand';
import { apiCache } from '@/services/api';

export type ActionType = 'like' | 'dislike' | 'save' | 'repost' | 'comment' | 'follow';
export type ContentType = 'omzo' | 'scribe';

export interface PendingAction {
    id: string; // unique action id
    type: ActionType;
    contentType: ContentType;
    contentId: number | string;
    payload: any; // action-specific data (comment text, etc)
    timestamp: number;
    retries: number;
    maxRetries: number;
}

interface PendingActionsState {
    // In-memory queue for current session
    pendingQueue: PendingAction[];

    // Add action to queue
    addPendingAction: (action: Omit<PendingAction, 'id' | 'timestamp' | 'retries'>) => string;

    // Remove action from queue
    removePendingAction: (actionId: string) => void;

    // Increment retry count
    incrementRetry: (actionId: string) => void;

    // Get all pending actions
    getPendingActions: () => PendingAction[];

    // Get actions for specific content
    getPendingForContent: (contentType: ContentType, contentId: number | string) => PendingAction[];

    // Clear all pending actions
    clearAll: () => void;
}

export const usePendingActionsStore = create<PendingActionsState>((set, get) => ({
    pendingQueue: [],

    addPendingAction: (action) => {
        const actionId = `${action.contentType}_${action.contentId}_${action.type}_${Date.now()}`;
        const pendingAction: PendingAction = {
            ...action,
            id: actionId,
            timestamp: Date.now(),
            retries: 0,
            maxRetries: 3,
        };

        set(state => ({
            pendingQueue: [...state.pendingQueue, pendingAction]
        }));

        // Persist to cache for recovery after app restart
        const cached = JSON.parse(apiCache.getString('pending_actions') || '[]');
        apiCache.set('pending_actions', JSON.stringify([...cached, pendingAction]));

        return actionId;
    },

    removePendingAction: (actionId) => {
        set(state => ({
            pendingQueue: state.pendingQueue.filter(a => a.id !== actionId)
        }));

        // Update cache
        const updated = get().pendingQueue;
        apiCache.set('pending_actions', JSON.stringify(updated));
    },

    incrementRetry: (actionId) => {
        set(state => ({
            pendingQueue: state.pendingQueue.map(a =>
                a.id === actionId ? { ...a, retries: a.retries + 1 } : a
            )
        }));

        // Update cache
        const updated = get().pendingQueue;
        apiCache.set('pending_actions', JSON.stringify(updated));
    },

    getPendingActions: () => get().pendingQueue,

    getPendingForContent: (contentType, contentId) => {
        return get().pendingQueue.filter(
            a => a.contentType === contentType && a.contentId === contentId
        );
    },

    clearAll: () => {
        set({ pendingQueue: [] });
        apiCache.set('pending_actions', JSON.stringify([]));
    },
}));

// On app startup, recover pending actions from cache
export const recoverPendingActions = () => {
    try {
        const cached = JSON.parse(apiCache.getString('pending_actions') || '[]');
        if (cached.length > 0) {
            const state = usePendingActionsStore.getState();
            state.pendingQueue.push(...cached);
        }
    } catch (error) {
        console.error('Failed to recover pending actions:', error);
    }
};
