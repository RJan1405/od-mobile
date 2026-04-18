import { useCallback } from 'react';
import { useInteractionCache } from '@/stores/interactionCache';
import { optimisticInteractionService } from '@/services/optimisticInteractionService';

type ContentType = 'omzo' | 'scribe';

/**
 * Hook for instant UI updates with optimistic interactions
 * All state changes are instant, API calls happen in background
 */
export function useOptimisticInteractions(contentType: ContentType, contentId: number | string) {
    const getInteraction = useInteractionCache((state) => state.getInteraction);
    const setInteraction = useInteractionCache((state) => state.setInteraction);
    const syncSaveState = useInteractionCache((state) => state.syncSaveState);
    const incrementCommentCount = useInteractionCache((state) => state.incrementCommentCount);

    // Get current state
    const interaction = getInteraction(contentType, contentId);

    // Like toggle with instant UI update
    const toggleLike = useCallback(async () => {
        await optimisticInteractionService.handleLikeToggle(
            contentType,
            contentId,
            interaction.is_liked || false,
            interaction.like_count || 0,
            interaction.is_disliked || false,
            interaction.dislike_count || 0
        );
    }, [contentType, contentId, interaction.is_liked, interaction.like_count, interaction.is_disliked, interaction.dislike_count]);

    // Dislike toggle with instant UI update
    const toggleDislike = useCallback(async () => {
        await optimisticInteractionService.handleDislikeToggle(
            contentType,
            contentId,
            interaction.is_disliked || false,
            interaction.dislike_count || 0,
            interaction.is_liked || false,
            interaction.like_count || 0
        );
    }, [contentType, contentId, interaction.is_disliked, interaction.dislike_count, interaction.is_liked, interaction.like_count]);

    // Save toggle with instant UI update
    const toggleSave = useCallback(async () => {
        await optimisticInteractionService.handleSaveToggle(
            contentType,
            contentId,
            interaction.is_saved || false
        );

        // Also sync if this is an omzo
        if (contentType === 'omzo') {
            syncSaveState(contentId as number, !(interaction.is_saved || false));
        }
    }, [contentType, contentId, interaction.is_saved, syncSaveState]);

    // Repost toggle with instant UI update
    const toggleRepost = useCallback(async () => {
        await optimisticInteractionService.handleRepostToggle(
            contentType,
            contentId,
            interaction.is_reposted || false,
            interaction.repost_count || 0
        );
    }, [contentType, contentId, interaction.is_reposted, interaction.repost_count]);

    // Add comment with instant UI update
    const addComment = useCallback(async (commentText: string) => {
        await optimisticInteractionService.handleAddComment(
            contentType,
            contentId,
            commentText,
            interaction.comment_count || 0
        );
    }, [contentType, contentId, interaction.comment_count]);

    // Manually update state (for server responses)
    const updateInteraction = useCallback((updates: Partial<typeof interaction>) => {
        setInteraction(contentType, contentId, updates);
    }, [contentType, contentId, setInteraction]);

    return {
        // State
        isLiked: interaction.is_liked || false,
        likeCount: interaction.like_count || 0,
        isDisliked: interaction.is_disliked || false,
        dislikeCount: interaction.dislike_count || 0,
        isSaved: interaction.is_saved || false,
        isReposted: interaction.is_reposted || false,
        repostCount: interaction.repost_count || 0,
        commentCount: interaction.comment_count || 0,

        // Actions
        toggleLike,
        toggleDislike,
        toggleSave,
        toggleRepost,
        addComment,
        updateInteraction,
    };
}
