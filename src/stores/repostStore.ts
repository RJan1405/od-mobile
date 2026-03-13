import { create } from 'zustand';
import { useInteractionStore, InteractionState } from './interactionStore';

/**
 * @deprecated Use useInteractionStore instead. 
 * This store now acts as a proxy to the unified useInteractionStore.
 */
interface RepostStoreProxy {
    repostStates: Record<string, { is_reposted: boolean; repost_count: number }>;
    setRepostState: (type: 'scribe' | 'omzo', id: number | string, newState: Partial<{ is_reposted: boolean; repost_count: number }>) => void;
}

export const useRepostStore = () => {
    const { interactions, setInteraction } = useInteractionStore();
    
    // Transform interaction states to only include repost fields for compatibility
    const repostStates: Record<string, { is_reposted: boolean; repost_count: number }> = {};
    Object.keys(interactions).forEach(key => {
        repostStates[key] = {
            is_reposted: !!interactions[key].is_reposted,
            repost_count: interactions[key].repost_count || 0,
        };
    });

    const setRepostState = (type: 'scribe' | 'omzo', id: number | string, newState: any) => {
        setInteraction(type, id, newState);
    };

    return { repostStates, setRepostState };
};
