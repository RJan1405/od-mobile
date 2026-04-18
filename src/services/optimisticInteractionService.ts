import type { ApiResponse } from '@/types';
import { useInteractionCache } from '@/stores/interactionCache';
import { usePendingActionsStore } from '@/stores/pendingActionsStore';
import api from '@/services/api';

/**
 * Optimistic API handler for interactions
 * - Updates UI instantly
 * - Queues action for retry if needed
 * - Handles failures gracefully
 * 
 * NOTE: This is a utility service (not a hook), so we use .getState() to access Zustand stores
 */

interface OptimisticUpdateConfig {
    contentType: 'omzo' | 'scribe';
    contentId: number | string;
    oldState: any;
    newState: any;
}

class OptimisticInteractionService {
    /**
     * Generic optimistic update handler
     */
    async executeOptimisticAction(
        actionType: 'like' | 'dislike' | 'save' | 'repost' | 'comment' | 'follow',
        contentType: 'omzo' | 'scribe',
        contentId: number | string,
        apiCall: () => Promise<ApiResponse<any>>,
        config: OptimisticUpdateConfig
    ): Promise<any> {
        // Get state directly from Zustand stores (not calling hooks - allowed in services!)
        const setInteraction = useInteractionCache.getState().setInteraction;
        const addPendingAction = usePendingActionsStore.getState().addPendingAction;
        const removePendingAction = usePendingActionsStore.getState().removePendingAction;

        // 1. Update UI immediately
        setInteraction(contentType, contentId, config.newState);

        // 2. Add to pending queue
        const pendingId = addPendingAction({
            type: actionType,
            contentType,
            contentId,
            maxRetries: 3,
            payload: config.newState
        });

        try {
            // 3. Send to server
            const response = await apiCall();

            if (response.success) {
                // 4. Confirm with server state
                setInteraction(contentType, contentId, response.data || config.newState);
                removePendingAction(pendingId);
                return response.data;
            } else {
                // Rollback on error
                setInteraction(contentType, contentId, config.oldState);
                throw new Error('API returned error');
            }
        } catch (error) {
            // Keep pending action in queue for retry
            console.error(`Error in ${actionType} action:`, error);
            // UI stays optimistic - will retry when connection recovers
            return null;
        }
    }

    /**
     * Like/Dislike handler with mutual exclusion
     */
    async handleLikeToggle(
        contentType: 'omzo' | 'scribe',
        contentId: number | string,
        currentLikeState: boolean,
        currentLikeCount: number,
        currentDislikeState: boolean,
        currentDislikeCount: number
    ) {
        const oldState = {
            is_liked: currentLikeState,
            like_count: currentLikeCount,
            is_disliked: currentDislikeState,
            dislike_count: currentDislikeCount
        };

        const newIsLiked = !currentLikeState;
        const newLikeCount = currentLikeState ? Math.max(0, currentLikeCount - 1) : currentLikeCount + 1;
        const newIsDisliked = newIsLiked ? false : currentDislikeState;
        const newDislikeCount = !currentLikeState && currentDislikeState ? Math.max(0, currentDislikeCount - 1) : currentDislikeCount;

        const newState = {
            is_liked: newIsLiked,
            like_count: newLikeCount,
            is_disliked: newIsDisliked,
            dislike_count: newDislikeCount
        };

        return this.executeOptimisticAction(
            'like',
            contentType,
            contentId,
            () => contentType === 'omzo'
                ? api.toggleOmzoLike(contentId as number)
                : api.toggleScribeLike(contentId as number),
            { contentType, contentId, oldState, newState }
        );
    }

    async handleDislikeToggle(
        contentType: 'omzo' | 'scribe',
        contentId: number | string,
        currentDislikeState: boolean,
        currentDislikeCount: number,
        currentLikeState: boolean,
        currentLikeCount: number
    ) {
        const oldState = {
            is_disliked: currentDislikeState,
            dislike_count: currentDislikeCount,
            is_liked: currentLikeState,
            like_count: currentLikeCount
        };

        const newIsDisliked = !currentDislikeState;
        const newDislikeCount = currentDislikeState ? Math.max(0, currentDislikeCount - 1) : currentDislikeCount + 1;
        const newIsLiked = newIsDisliked ? false : currentLikeState;
        const newLikeCount = currentDislikeState && currentLikeState ? Math.max(0, currentLikeCount - 1) : currentLikeCount;

        const newState = {
            is_disliked: newIsDisliked,
            dislike_count: newDislikeCount,
            is_liked: newIsLiked,
            like_count: newLikeCount
        };

        return this.executeOptimisticAction(
            'dislike',
            contentType,
            contentId,
            () => contentType === 'omzo'
                ? api.toggleOmzoDislike(contentId as number)
                : api.toggleScribeDislike(contentId as number),
            { contentType, contentId, oldState, newState }
        );
    }

    async handleSaveToggle(
        contentType: 'omzo' | 'scribe',
        contentId: number | string,
        currentSaveState: boolean
    ) {
        const oldState = { is_saved: currentSaveState };
        const newState = { is_saved: !currentSaveState };

        return this.executeOptimisticAction(
            'save',
            contentType,
            contentId,
            () => contentType === 'omzo'
                ? api.toggleSaveOmzo(contentId as number)
                : api.toggleSaveScribe(contentId as number),
            { contentType, contentId, oldState, newState }
        );
    }

    async handleRepostToggle(
        contentType: 'omzo' | 'scribe',
        contentId: number | string,
        currentRepostState: boolean,
        currentRepostCount: number
    ) {
        const oldState = {
            is_reposted: currentRepostState,
            repost_count: currentRepostCount
        };

        const newState = {
            is_reposted: !currentRepostState,
            repost_count: currentRepostState ? Math.max(0, currentRepostCount - 1) : currentRepostCount + 1
        };

        return this.executeOptimisticAction(
            'repost',
            contentType,
            contentId,
            () => contentType === 'omzo'
                ? api.repostOmzo(contentId as number)
                : api.repostScribe(contentId as number),
            { contentType, contentId, oldState, newState }
        );
    }

    async handleAddComment(
        contentType: 'omzo' | 'scribe',
        contentId: number | string,
        commentText: string,
        currentCommentCount: number
    ) {
        const oldState = { comment_count: currentCommentCount };
        const newState = { comment_count: currentCommentCount + 1 };

        return this.executeOptimisticAction(
            'comment',
            contentType,
            contentId,
            () => contentType === 'omzo'
                ? api.addOmzoComment(contentId as number, { text: commentText })
                : api.addScribeComment(contentId as number, { text: commentText }),
            { contentType, contentId, oldState, newState }
        );
    }
}

export const optimisticInteractionService = new OptimisticInteractionService();
