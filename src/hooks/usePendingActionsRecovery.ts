import { useEffect } from 'react';
import { usePendingActionsStore } from '@/stores/pendingActionsStore';
import api from '@/services/api';

/**
 * Recovers and retries pending actions on app startup or reconnection
 * Call this once in your app root (e.g., App.tsx)
 */
export function usePendingActionsRecovery() {
    useEffect(() => {
        // Get store methods once
        const store = usePendingActionsStore.getState();

        // Recover pending actions on mount
        const pendingActions = store.getPendingActions();

        if (pendingActions.length > 0) {
            console.log(`Recovering ${pendingActions.length} pending actions...`);

            pendingActions.forEach(action => {
                retryPendingAction(action);
            });
        }

        // Set up interval to retry failed actions every 30 seconds
        const retryInterval = setInterval(() => {
            const currentStore = usePendingActionsStore.getState();
            const currentPending = currentStore.getPendingActions();

            currentPending.forEach(action => {
                if (action.retries < action.maxRetries) {
                    retryPendingAction(action);
                } else {
                    // Max retries exceeded, remove from queue
                    console.warn(`Removing pending action after ${action.maxRetries} retries:`, action.id);
                    currentStore.removePendingAction(action.id);
                }
            });
        }, 30000); // Retry every 30 seconds

        return () => clearInterval(retryInterval);
    }, []);
}

async function retryPendingAction(action: any) {
    // Get store methods - NOT calling hooks, just accessing store state
    const store = usePendingActionsStore.getState();
    const removePendingAction = store.removePendingAction;
    const incrementRetry = store.incrementRetry;

    try {
        let response: any;

        switch (action.type) {
            case 'like':
                response = action.contentType === 'omzo'
                    ? await api.toggleOmzoLike(action.contentId)
                    : await api.toggleScribeLike(action.contentId);
                break;

            case 'dislike':
                response = action.contentType === 'omzo'
                    ? await api.toggleOmzoDislike(action.contentId)
                    : await api.toggleScribeDislike(action.contentId);
                break;

            case 'save':
                response = action.contentType === 'omzo'
                    ? await api.toggleSaveOmzo(action.contentId)
                    : await api.toggleSaveScribe(action.contentId);
                break;

            case 'repost':
                response = action.contentType === 'omzo'
                    ? await api.repostOmzo(action.contentId)
                    : await api.repostScribe(action.contentId);
                break;

            case 'comment':
                response = action.contentType === 'omzo'
                    ? await api.addOmzoComment(action.contentId, action.payload)
                    : await api.addScribeComment(action.contentId, action.payload);
                break;

            case 'follow':
                response = await api.toggleFollow(action.contentId);
                break;

            default:
                console.warn('Unknown action type:', action.type);
                return;
        }

        if (response.success) {
            console.log(`Successfully retried pending action: ${action.id}`);
            removePendingAction(action.id);
        } else {
            incrementRetry(action.id);
        }
    } catch (error) {
        console.error(`Failed to retry pending action ${action.id}:`, error);
        incrementRetry(action.id);
    }
}

/**
 * Hook to check if there are pending actions
 */
export function usePendingActionCount() {
    const pendingCount = usePendingActionsStore(
        (state) => state.getPendingActions().length
    );
    return pendingCount;
}

/**
 * Hook to check if specific content has pending actions
 */
export function useHasPendingActions(contentType: 'omzo' | 'scribe', contentId: number | string) {
    const pendingActions = usePendingActionsStore(
        (state) => state.getPendingForContent(contentType, contentId)
    );
    return pendingActions.length > 0;
}
