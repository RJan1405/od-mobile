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
    /** username → follow_request_status */
    requestStatuses: Record<string, string | null>;

    /** Set the authoritative follow state for a single user */
    setFollowState: (username: string, isFollowing: boolean, requestStatus?: string | null) => void;

    /** Bulk-seed follow states */
    batchSetFollowStates: (states: Record<string, boolean>, requestStatuses?: Record<string, string | null>) => void;

    getFollowState: (username: string) => boolean | undefined;
    getRequestStatus: (username: string) => string | null | undefined;
}

export const useFollowStore = create<FollowStore>((set, get) => ({
    followStates: {},
    requestStatuses: {},

    setFollowState: (username, isFollowing, requestStatus = null) =>
        set(state => ({
            followStates: { ...state.followStates, [username]: isFollowing },
            requestStatuses: { ...state.requestStatuses, [username]: requestStatus },
        })),

    batchSetFollowStates: (states, requestStatuses = {}) =>
        set(state => ({
            followStates: { ...state.followStates, ...states },
            requestStatuses: { ...state.requestStatuses, ...requestStatuses },
        })),

    getFollowState: (username) => get().followStates[username],
    getRequestStatus: (username) => get().requestStatuses[username],
}));
