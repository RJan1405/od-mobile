/**
 * Upload Store
 * Manages user's own content uploads and saved content
 * Integrated with MMKV for persistent caching
 */

import { create } from 'zustand';
import type { Scribe, Omzo } from '@/types';
import api from '@/services/api';
import { UploadStorage, SyncMetadata } from '@/services/mmkvStorage';

interface UploadState {
    // User's own uploads
    myScribes: Scribe[];
    myOmzos: Omzo[];

    // Saved content
    savedScribes: Scribe[];
    savedOmzos: Omzo[];

    // Loading states
    isLoading: boolean;
    isSaving: boolean;

    // Actions - My Uploads
    loadMyScribes: () => Promise<void>;
    loadMyOmzos: () => Promise<void>;
    addMyScribe: (scribe: Scribe) => void;
    addMyOmzo: (omzo: Omzo) => void;
    removeMyScribe: (id: number) => void;
    removeMyOmzo: (id: number) => void;
    updateMyScribe: (id: number, updates: Partial<Scribe>) => void;
    updateMyOmzo: (id: number, updates: Partial<Omzo>) => void;

    // Actions - Saved Content
    loadSavedScribes: () => Promise<void>;
    loadSavedOmzos: () => Promise<void>;
    toggleSaveScribe: (scribeId: number, isSaved: boolean) => Promise<void>;
    toggleSaveOmzo: (omzoId: number, isSaved: boolean) => Promise<void>;
    saveSavedScribes: (scribes: Scribe[]) => void;
    saveSavedOmzos: (omzos: Omzo[]) => void;

    // Cache actions
    loadFromCache: () => void;
    saveAllToCache: () => void;
    clearAllCache: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
    myScribes: [],
    myOmzos: [],
    savedScribes: [],
    savedOmzos: [],
    isLoading: false,
    isSaving: false,

    // ============================================================================
    // MY UPLOADS - SCRIBES
    // ============================================================================

    loadMyScribes: async () => {
        set({ isLoading: true });
        try {
            console.log('📖 Loading my scribes...');
            const response = await api.getMyProfile();

            if (response.success && (response as any).scribes) {
                const scribes = (response as any).scribes;
                console.log('✅ Loaded', scribes.length, 'scribes');
                set({ myScribes: scribes });

                // 💾 Save to MMKV
                UploadStorage.saveMyScribes(scribes);
                SyncMetadata.setLastSyncTime('my_scribes', Date.now());
            } else {
                // Try to load from cache
                const cached = UploadStorage.getMyScribes();
                if (cached.length > 0) {
                    console.log('📂 Using cached scribes:', cached.length);
                    set({ myScribes: cached });
                }
            }
        } catch (error) {
            console.error('Error loading my scribes:', error);
            // Load from cache on error
            const cached = UploadStorage.getMyScribes();
            if (cached.length > 0) {
                console.log('📂 Using cached scribes due to error:', cached.length);
                set({ myScribes: cached });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    loadMyOmzos: async () => {
        set({ isLoading: true });
        try {
            console.log('🎬 Loading my omzos...');
            const response = await api.getMyProfile();

            if (response.success && (response as any).omzos) {
                const omzos = (response as any).omzos;
                console.log('✅ Loaded', omzos.length, 'omzos');
                set({ myOmzos: omzos });

                // 💾 Save to MMKV
                UploadStorage.saveMyOmzos(omzos);
                SyncMetadata.setLastSyncTime('my_omzos', Date.now());
            } else {
                // Try to load from cache
                const cached = UploadStorage.getMyOmzos();
                if (cached.length > 0) {
                    console.log('📂 Using cached omzos:', cached.length);
                    set({ myOmzos: cached });
                }
            }
        } catch (error) {
            console.error('Error loading my omzos:', error);
            // Load from cache on error
            const cached = UploadStorage.getMyOmzos();
            if (cached.length > 0) {
                console.log('📂 Using cached omzos due to error:', cached.length);
                set({ myOmzos: cached });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    addMyScribe: (scribe: Scribe) => {
        console.log('✍️ Adding new scribe:', scribe.id);
        set(state => {
            const updated = [scribe, ...state.myScribes];
            // Avoid duplicates
            const deduped = Array.from(
                new Map(updated.map(s => [s.id, s])).values()
            );
            UploadStorage.saveMyScribes(deduped);
            return { myScribes: deduped };
        });
    },

    addMyOmzo: (omzo: Omzo) => {
        console.log('🎬 Adding new omzo:', omzo.id);
        set(state => {
            const updated = [omzo, ...state.myOmzos];
            // Avoid duplicates
            const deduped = Array.from(
                new Map(updated.map(o => [o.id, o])).values()
            );
            UploadStorage.saveMyOmzos(deduped);
            return { myOmzos: deduped };
        });
    },

    removeMyScribe: (id: number) => {
        console.log('🗑️ Removing scribe:', id);
        set(state => {
            const updated = state.myScribes.filter(s => s.id !== id);
            UploadStorage.saveMyScribes(updated);
            return { myScribes: updated };
        });
    },

    removeMyOmzo: (id: number) => {
        console.log('🗑️ Removing omzo:', id);
        set(state => {
            const updated = state.myOmzos.filter(o => o.id !== id);
            UploadStorage.saveMyOmzos(updated);
            return { myOmzos: updated };
        });
    },

    updateMyScribe: (id: number, updates: Partial<Scribe>) => {
        console.log('✏️ Updating scribe:', id);
        set(state => {
            const updated = state.myScribes.map(s =>
                s.id === id ? { ...s, ...updates } : s
            );
            UploadStorage.saveMyScribes(updated);
            return { myScribes: updated };
        });
    },

    updateMyOmzo: (id: number, updates: Partial<Omzo>) => {
        console.log('✏️ Updating omzo:', id);
        set(state => {
            const updated = state.myOmzos.map(o =>
                o.id === id ? { ...o, ...updates } : o
            );
            UploadStorage.saveMyOmzos(updated);
            return { myOmzos: updated };
        });
    },

    // ============================================================================
    // SAVED CONTENT
    // ============================================================================

    loadSavedScribes: async () => {
        set({ isLoading: true });
        try {
            console.log('📚 Loading saved scribes...');
            const response = await api.getSavedContent('scribes');

            if (response.success && (response as any).results) {
                const scribes = (response as any).results;
                console.log('✅ Loaded', scribes.length, 'saved scribes');
                set({ savedScribes: scribes });

                // 💾 Save to MMKV
                UploadStorage.saveSavedScribes(scribes);
                SyncMetadata.setLastSyncTime('saved_scribes', Date.now());
            } else {
                // Try to load from cache
                const cached = UploadStorage.getSavedScribes();
                if (cached.length > 0) {
                    console.log('📂 Using cached saved scribes:', cached.length);
                    set({ savedScribes: cached });
                }
            }
        } catch (error) {
            console.error('Error loading saved scribes:', error);
            // Load from cache on error
            const cached = UploadStorage.getSavedScribes();
            if (cached.length > 0) {
                console.log('📂 Using cached saved scribes due to error:', cached.length);
                set({ savedScribes: cached });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    loadSavedOmzos: async () => {
        set({ isLoading: true });
        try {
            console.log('🎬📚 Loading saved omzos...');
            const response = await api.getSavedContent('omzos');

            if (response.success && (response as any).results) {
                const omzos = (response as any).results;
                console.log('✅ Loaded', omzos.length, 'saved omzos');
                set({ savedOmzos: omzos });

                // 💾 Save to MMKV
                UploadStorage.saveSavedOmzos(omzos);
                SyncMetadata.setLastSyncTime('saved_omzos', Date.now());
            } else {
                // Try to load from cache
                const cached = UploadStorage.getSavedOmzos();
                if (cached.length > 0) {
                    console.log('📂 Using cached saved omzos:', cached.length);
                    set({ savedOmzos: cached });
                }
            }
        } catch (error) {
            console.error('Error loading saved omzos:', error);
            // Load from cache on error
            const cached = UploadStorage.getSavedOmzos();
            if (cached.length > 0) {
                console.log('📂 Using cached saved omzos due to error:', cached.length);
                set({ savedOmzos: cached });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    toggleSaveScribe: async (scribeId: number, isSaved: boolean) => {
        set({ isSaving: true });
        try {
            const response = await api.toggleSaveScribe(scribeId);
            if (response.success) {
                if (isSaved) {
                    // Add to saved if not already there
                    set(state => {
                        const exists = state.savedScribes.some(s => s.id === scribeId);
                        if (!exists) {
                            // Find the scribe to add
                            const scribe = state.myScribes.find(s => s.id === scribeId);
                            if (scribe) {
                                const updated = [scribe, ...state.savedScribes];
                                UploadStorage.saveSavedScribes(updated);
                                return { savedScribes: updated };
                            }
                        }
                        return state;
                    });
                } else {
                    // Remove from saved
                    set(state => {
                        const updated = state.savedScribes.filter(s => s.id !== scribeId);
                        UploadStorage.saveSavedScribes(updated);
                        return { savedScribes: updated };
                    });
                }
            }
        } catch (error) {
            console.error('Error toggling save on scribe:', error);
        } finally {
            set({ isSaving: false });
        }
    },

    toggleSaveOmzo: async (omzoId: number, isSaved: boolean) => {
        set({ isSaving: true });
        try {
            const response = await api.toggleSaveOmzo(omzoId);
            if (response.success) {
                if (isSaved) {
                    // Add to saved if not already there
                    set(state => {
                        const exists = state.savedOmzos.some(o => o.id === omzoId);
                        if (!exists) {
                            // Find the omzo to add
                            const omzo = state.myOmzos.find(o => o.id === omzoId);
                            if (omzo) {
                                const updated = [omzo, ...state.savedOmzos];
                                UploadStorage.saveSavedOmzos(updated);
                                return { savedOmzos: updated };
                            }
                        }
                        return state;
                    });
                } else {
                    // Remove from saved
                    set(state => {
                        const updated = state.savedOmzos.filter(o => o.id !== omzoId);
                        UploadStorage.saveSavedOmzos(updated);
                        return { savedOmzos: updated };
                    });
                }
            }
        } catch (error) {
            console.error('Error toggling save on omzo:', error);
        } finally {
            set({ isSaving: false });
        }
    },

    saveSavedScribes: (scribes: Scribe[]) => {
        console.log('💾 Saving scribes collection');
        set({ savedScribes: scribes });
        UploadStorage.saveSavedScribes(scribes);
    },

    saveSavedOmzos: (omzos: Omzo[]) => {
        console.log('💾 Saving omzos collection');
        set({ savedOmzos: omzos });
        UploadStorage.saveSavedOmzos(omzos);
    },

    // ============================================================================
    // CACHE MANAGEMENT
    // ============================================================================

    loadFromCache: () => {
        console.log('📂 Loading all uploads from MMKV cache...');
        const myScribes = UploadStorage.getMyScribes();
        const myOmzos = UploadStorage.getMyOmzos();
        const savedScribes = UploadStorage.getSavedScribes();
        const savedOmzos = UploadStorage.getSavedOmzos();

        set({
            myScribes,
            myOmzos,
            savedScribes,
            savedOmzos,
        });

        console.log('✅ Loaded from cache:', {
            myScribes: myScribes.length,
            myOmzos: myOmzos.length,
            savedScribes: savedScribes.length,
            savedOmzos: savedOmzos.length,
        });
    },

    saveAllToCache: () => {
        console.log('💾 Saving all uploads to MMKV cache...');
        const state = get();
        UploadStorage.saveMyScribes(state.myScribes);
        UploadStorage.saveMyOmzos(state.myOmzos);
        UploadStorage.saveSavedScribes(state.savedScribes);
        UploadStorage.saveSavedOmzos(state.savedOmzos);
        console.log('✅ All uploads saved to cache');
    },

    clearAllCache: () => {
        console.log('🗑️ Clearing all upload cache from MMKV...');
        UploadStorage.clearAllUploads();
        set({
            myScribes: [],
            myOmzos: [],
            savedScribes: [],
            savedOmzos: [],
        });
        console.log('✅ All upload cache cleared');
    },
}));
