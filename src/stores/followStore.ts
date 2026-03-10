/**
 * followStore — single source of truth for follow/following state across the whole app.
 *
 * Any screen or component that shows a Follow/Following button reads from here.
 * Any screen or component that performs a follow/unfollow writes here.
 * Changes propagate instantly to every mounted subscriber (Zustand reactivity).
 */
import { create } from 'zustand';

interface FollowStore {
    /** username → is_following */
    followStates: Record<string, boolean>;

    /** Set the authoritative follow state for a single user */
    setFollowState: (username: string, isFollowing: boolean) => void;

    /** Bulk-seed follow states (e.g. from /api/follow-states/ response) */
    batchSetFollowStates: (states: Record<string, boolean>) => void;

    /**
     * Get the follow state for a username.
     * Returns `undefined` if this username has never been loaded into the store.
     */
    getFollowState: (username: string) => boolean | undefined;
}

export const useFollowStore = create<FollowStore>((set, get) => ({
    followStates: {},

    setFollowState: (username, isFollowing) =>
        set(state => ({
            followStates: { ...state.followStates, [username]: isFollowing },
        })),

    batchSetFollowStates: (states) =>
        set(state => ({
            followStates: { ...state.followStates, ...states },
        })),

    getFollowState: (username) => get().followStates[username],
}));
