import { create } from 'zustand';

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

interface InteractionStore {
    /** key format: "{type}_{id}" e.g., "scribe_123", "omzo_45" */
    interactions: Record<string, InteractionState>;

    setInteraction: (type: 'scribe' | 'omzo', id: number | string, state: Partial<InteractionState>) => void;
    batchSetInteractions: (newStates: Record<string, InteractionState>) => void;
    getInteraction: (type: 'scribe' | 'omzo', id: number | string) => InteractionState | undefined;
    incrementCommentCount: (type: 'scribe' | 'omzo', id: number | string) => void;
}

export const useInteractionStore = create<InteractionStore>((set, get) => ({
    interactions: {},

    setInteraction: (type, id, newState) => {
        const key = `${type}_${id}`;
        set(state => {
            const current = state.interactions[key] || {
                is_liked: false,
                like_count: 0,
                is_disliked: false,
                dislike_count: 0,
                is_saved: false,
                is_reposted: false,
                repost_count: 0,
                comment_count: 0
            };

            // Only create new object if something actually changed
            const updated = { ...current, ...newState };
            if (JSON.stringify(current) === JSON.stringify(updated)) {
                return state; // No change, don't update
            }

            return {
                interactions: {
                    ...state.interactions,
                    [key]: updated
                }
            };
        });
    },

    batchSetInteractions: (newStates) =>
        set(state => ({
            interactions: { ...state.interactions, ...newStates }
        })),

    getInteraction: (type, id) => get().interactions[`${type}_${id}`],
    incrementCommentCount: (type, id) => {
        const key = `${type}_${id}`;
        set(state => {
            const current = state.interactions[key] || {
                is_liked: false,
                like_count: 0,
                is_disliked: false,
                dislike_count: 0,
                is_saved: false,
                is_reposted: false,
                repost_count: 0,
                comment_count: 0
            };

            return {
                interactions: {
                    ...state.interactions,
                    [key]: {
                        ...current,
                        comment_count: (current.comment_count || 0) + 1
                    }
                }
            };
        });
    },
}));
