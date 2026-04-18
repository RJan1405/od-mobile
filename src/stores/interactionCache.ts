import { create } from 'zustand';
import { apiCache } from '@/services/api';

export interface InteractionState {
    is_liked?: boolean;
    like_count?: number;
    is_disliked?: boolean;
    dislike_count?: number;
    is_saved?: boolean;
    is_reposted?: boolean;
    repost_count?: number;
    comment_count?: number;
}

interface CachedInteraction extends InteractionState {
    contentType: 'omzo' | 'scribe';
    contentId: number | string;
    lastUpdated: number;
}

interface InteractionCacheStore {
    /** Map of "{type}_{id}" -> InteractionState */
    cache: Record<string, InteractionState>;

    // Set interaction state and cache it
    setInteraction: (type: 'scribe' | 'omzo', id: number | string, state: Partial<InteractionState>) => void;

    // Batch set multiple interactions
    batchSetInteractions: (updates: Record<string, InteractionState>) => void;

    // Get interaction state
    getInteraction: (type: 'scribe' | 'omzo', id: number | string) => InteractionState;

    // Increment comment count
    incrementCommentCount: (type: 'scribe' | 'omzo', id: number | string) => void;

    // Sync saved state between omzo and scribe (if omzo is in a scribe)
    syncSaveState: (omzoId: number, newSaveState: boolean) => void;

    // Load cache from persistent storage
    loadFromCache: () => void;

    // Clear cache
    clearCache: () => void;
}

const DEFAULT_INTERACTION: InteractionState = {
    is_liked: false,
    like_count: 0,
    is_disliked: false,
    dislike_count: 0,
    is_saved: false,
    is_reposted: false,
    repost_count: 0,
    comment_count: 0,
};

const CACHE_KEY = 'interaction_cache';

export const useInteractionCache = create<InteractionCacheStore>((set, get) => ({
    cache: {},

    setInteraction: (type, id, newState) => {
        const key = `${type}_${id}`;
        set(state => {
            const current = state.cache[key] || { ...DEFAULT_INTERACTION };
            const updated = { ...current, ...newState };

            // Avoid unnecessary updates
            if (JSON.stringify(current) === JSON.stringify(updated)) {
                return state;
            }

            // Update memory
            const newCache = {
                ...state.cache,
                [key]: updated
            };

            // Persist to cache
            try {
                const cacheData = {
                    [key]: {
                        ...updated,
                        contentType: type,
                        contentId: id,
                        lastUpdated: Date.now()
                    }
                };
                const existing = JSON.parse(apiCache.getString(CACHE_KEY) || '{}');
                apiCache.set(CACHE_KEY, JSON.stringify({ ...existing, ...cacheData }));
            } catch (error) {
                console.error('Failed to persist interaction cache:', error);
            }

            return { cache: newCache };
        });
    },

    batchSetInteractions: (updates) => {
        set(state => {
            const newCache = { ...state.cache, ...updates };
            try {
                const existing = JSON.parse(apiCache.getString(CACHE_KEY) || '{}');
                apiCache.set(CACHE_KEY, JSON.stringify({ ...existing, ...updates }));
            } catch (error) {
                console.error('Failed to persist interaction cache:', error);
            }
            return { cache: newCache };
        });
    },

    getInteraction: (type, id) => {
        const key = `${type}_${id}`;
        return get().cache[key] || { ...DEFAULT_INTERACTION };
    },

    incrementCommentCount: (type, id) => {
        const key = `${type}_${id}`;
        get().setInteraction(type, id, {
            comment_count: (get().cache[key]?.comment_count || 0) + 1
        });
    },

    // When you like an omzo in player, sync to the scribe containing it
    syncSaveState: (omzoId, newSaveState) => {
        const omzoKey = `omzo_${omzoId}`;
        // Update the omzo's save state
        get().setInteraction('omzo', omzoId, { is_saved: newSaveState });

        // Also check if this omzo is in a scribe and sync there
        // (This is handled at component level by using the same store keys)
    },

    loadFromCache: () => {
        try {
            const cached = JSON.parse(apiCache.getString(CACHE_KEY) || '{}');
            const cleaned = Object.entries(cached).reduce((acc, [key, value]: [string, any]) => {
                acc[key] = {
                    is_liked: value.is_liked,
                    like_count: value.like_count,
                    is_disliked: value.is_disliked,
                    dislike_count: value.dislike_count,
                    is_saved: value.is_saved,
                    is_reposted: value.is_reposted,
                    repost_count: value.repost_count,
                    comment_count: value.comment_count,
                };
                return acc;
            }, {} as Record<string, InteractionState>);

            set({ cache: cleaned });
        } catch (error) {
            console.error('Failed to load interaction cache:', error);
        }
    },

    clearCache: () => {
        set({ cache: {} });
        apiCache.delete(CACHE_KEY);
    },
}));
