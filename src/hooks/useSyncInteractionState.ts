import { useEffect } from 'react';
import { useInteractionCache } from '@/stores/interactionCache';

/**
 * Syncs interaction state across multiple views (Optimized version)
 * Uses Zustand's subscription system instead of polling
 * E.g., when you like an omzo in player, it updates in the saved omzo section too
 * 
 * Usage:
 * useSyncInteractionStateOptimized('omzo', 123, 'scribe', 456);
 */
export function useSyncInteractionStateOptimized(
    sourceType: 'omzo' | 'scribe',
    sourceId: number | string,
    targetType: 'omzo' | 'scribe',
    targetId: number | string
) {
    useEffect(() => {
        // Subscribe to cache changes using Zustand's subscription
        const unsubscribe = useInteractionCache.subscribe(
            (state) => state.cache,
            (newCache) => {
                const sourceKey = `${sourceType}_${sourceId}`;
                const sourceState = newCache[sourceKey];

                if (sourceState) {
                    // Get the setInteraction method
                    const setInteraction = useInteractionCache.getState().setInteraction;

                    // Sync critical states
                    setInteraction(targetType, targetId, {
                        is_liked: sourceState.is_liked,
                        like_count: sourceState.like_count,
                        is_disliked: sourceState.is_disliked,
                        dislike_count: sourceState.dislike_count,
                        is_saved: sourceState.is_saved,
                    });
                }
            }
        );

        return unsubscribe;
    }, [sourceType, sourceId, targetType, targetId]);
}

/**
 * Alternative polling version (less efficient, kept for compatibility)
 */
export function useSyncInteractionState(
    sourceType: 'omzo' | 'scribe',
    sourceId: number | string,
    targetType: 'omzo' | 'scribe',
    targetId: number | string
) {
    useEffect(() => {
        // Polling version - checks every 500ms for changes
        const checkInterval = setInterval(() => {
            const getInteraction = useInteractionCache.getState().getInteraction;
            const setInteraction = useInteractionCache.getState().setInteraction;

            const sourceState = getInteraction(sourceType, sourceId);
            const targetState = getInteraction(targetType, targetId);

            // Sync critical states: liked, saved, reposted, comment_count
            if (sourceState.is_liked !== targetState.is_liked ||
                sourceState.like_count !== targetState.like_count ||
                sourceState.is_saved !== targetState.is_saved ||
                sourceState.is_disliked !== targetState.is_disliked) {

                setInteraction(targetType, targetId, {
                    is_liked: sourceState.is_liked,
                    like_count: sourceState.like_count,
                    is_disliked: sourceState.is_disliked,
                    dislike_count: sourceState.dislike_count,
                    is_saved: sourceState.is_saved,
                });
            }
        }, 500); // Check every 500ms for changes

        return () => clearInterval(checkInterval);
    }, [sourceType, sourceId, targetType, targetId]);
}
