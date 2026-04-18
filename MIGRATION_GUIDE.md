# Migration Guide: Converting Components to Optimistic Updates

This guide shows how to convert existing components to use the new instant UI update system.

## Step 1: Replace Store Subscription with Hook

### Before:
```tsx
import { useInteractionStore } from '@/stores/interactionStore';

function OmzoCard({ omzo }) {
    // Multiple local state variables
    const [localLiked, setLocalLiked] = useState(!!omzo.is_liked);
    const [localLikeCount, setLocalLikeCount] = useState(omzo.like_count || 0);
    const [localSaved, setLocalSaved] = useState(!!omzo.is_saved);
    
    // Setter from store
    const setInteraction = useInteractionStore(state => state.setInteraction);
    
    // Manual API call handling
    const handleLike = useCallback(() => {
        const newLiked = !localLiked;
        setLocalLiked(newLiked);
        setInteraction('omzo', omzo.id, { is_liked: newLiked });
        
        api.toggleOmzoLike(omzo.id).then(response => {
            if (response.success) {
                setLocalLiked(response.is_liked);
            } else {
                setLocalLiked(localLiked);
            }
        }).catch(error => {
            setLocalLiked(localLiked);
        });
    }, [localLiked]);
```

### After:
```tsx
import { useOptimisticInteractions } from '@/hooks/useOptimisticInteractions';

function OmzoCard({ omzo }) {
    // Single hook with all states and handlers
    const {
        isLiked,
        likeCount,
        isSaved,
        toggleLike,
        toggleSave,
        updateInteraction
    } = useOptimisticInteractions('omzo', omzo.id);
    
    // Initialize cache with initial data
    useEffect(() => {
        updateInteraction({
            is_liked: omzo.is_liked,
            like_count: omzo.like_count,
            is_saved: omzo.is_saved,
            comment_count: omzo.comment_count
        });
    }, [omzo.id]);
    
    // Handler is now just one line
    const handleLike = useCallback(() => {
        toggleLike();
    }, [toggleLike]);
```

## Step 2: Update All Interaction Handlers

### Comments

Before:
```tsx
const handleAddComment = async (text) => {
    setCommentCount(prev => prev + 1);
    const response = await api.addOmzoComment(omzo.id, { text });
    if (!response.success) {
        setCommentCount(prev => prev - 1);
    }
};
```

After:
```tsx
const { addComment, commentCount } = useOptimisticInteractions('omzo', omzo.id);

const handleAddComment = async (text) => {
    await addComment(text);
    // Comment count updates instantly, API sends in background
};
```

### Saves

Before:
```tsx
const handleToggleSave = useCallback(() => {
    const newSaved = !localSaved;
    setLocalSaved(newSaved);
    setInteraction('omzo', omzo.id, { is_saved: newSaved });

    api.toggleSaveOmzo(omzo.id)
        .then(response => {
            if (response.success) {
                setLocalSaved(response.is_saved);
            } else {
                setLocalSaved(localSaved);
            }
        })
        .catch(() => setLocalSaved(localSaved));
}, [localSaved]);
```

After:
```tsx
const { toggleSave, isSaved } = useOptimisticInteractions('omzo', omzo.id);

const handleToggleSave = () => {
    toggleSave(); // That's it!
};
```

### Reposts

Before:
```tsx
const handleRepost = useCallback(() => {
    const newReposted = !localReposted;
    const newCount = localReposted ? localRepostCount - 1 : localRepostCount + 1;

    setLocalReposted(newReposted);
    setLocalRepostCount(newCount);
    setInteraction('omzo', omzo.id, {
        is_reposted: newReposted,
        repost_count: newCount
    });

    api.toggleRepostOmzo(omzo.id)
        .then(response => {
            if (response.success) {
                setLocalReposted(response.is_reposted);
            } else {
                setLocalReposted(localReposted);
            }
        });
}, [localReposted, localRepostCount]);
```

After:
```tsx
const { toggleRepost, isReposted, repostCount } = useOptimisticInteractions('omzo', omzo.id);

const handleRepost = () => {
    toggleRepost(); // Handles everything
};
```

## Step 3: Update JSX to Use Hook Values

### Before:
```tsx
<TouchableOpacity onPress={handleLike}>
    <Icon 
        name={localLiked ? 'heart' : 'heart-outline'}
        color={localLiked ? '#FF3B5C' : '#FFFFFF'}
    />
    <Text>{formatCount(localLikeCount)}</Text>
</TouchableOpacity>
```

### After:
```tsx
const { isLiked, likeCount, toggleLike } = useOptimisticInteractions('omzo', omzo.id);

<TouchableOpacity onPress={toggleLike}>
    <Icon 
        name={isLiked ? 'heart' : 'heart-outline'}
        color={isLiked ? '#FF3B5C' : '#FFFFFF'}
    />
    <Text>{formatCount(likeCount)}</Text>
</TouchableOpacity>
```

## Step 4: Handle Cross-View Syncing (Optional)

If you have saved items that need to sync with the main view:

```tsx
import { useSyncInteractionStateOptimized } from '@/hooks/useSyncInteractionState';

function SavedOmzoItem({ omzo }) {
    const { isLiked, toggleLike } = useOptimisticInteractions('omzo', omzo.id);
    
    // Sync changes from main omzo view
    useSyncInteractionStateOptimized('omzo', omzo.id, 'scribe', omzo.scribe_id);
    
    return (
        <TouchableOpacity onPress={toggleLike}>
            <Icon name={isLiked ? 'heart' : 'heart-outline'} />
        </TouchableOpacity>
    );
}
```

## Step 5: Handle Comments Sheet

### Before (OmzoCommentsSheet):
```tsx
export function OmzoCommentsSheet({ omzoId, initialCommentCount, onCommentAdded }) {
    const [commentCount, setCommentCount] = useState(initialCommentCount);
    
    const addComment = async (text) => {
        setCommentCount(prev => prev + 1);
        const response = await api.addOmzoComment(omzoId, { text });
        if (!response.success) {
            setCommentCount(prev => prev - 1);
        }
        onCommentAdded?.();
    };
}
```

### After (OmzoCommentsSheet):
```tsx
import { useOptimisticInteractions } from '@/hooks/useOptimisticInteractions';

export function OmzoCommentsSheet({ omzoId }) {
    const { commentCount, addComment } = useOptimisticInteractions('omzo', omzoId);
    
    const handleAddComment = async (text) => {
        await addComment(text);
        // Comment count already updated optimistically
    };
}
```

## Step 6: Cleanup Old Code

Remove old patterns:
- ❌ Don't use `useInteractionStore` directly in components
- ❌ Don't use `useState` for interaction tracking
- ❌ Don't manually persist to old store

Use only:
- ✅ `useOptimisticInteractions` hook
- ✅ Cache persists automatically
- ✅ Pending actions retry automatically

## Complete Example: Updated OmzoCard

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useOptimisticInteractions } from '@/hooks/useOptimisticInteractions';
import { useSyncInteractionStateOptimized } from '@/hooks/useSyncInteractionState';

export function OmzoCard({ omzo, isActive }) {
    const {
        isLiked,
        likeCount,
        isDisliked,
        dislikeCount,
        isSaved,
        isReposted,
        repostCount,
        commentCount,
        toggleLike,
        toggleDislike,
        toggleSave,
        toggleRepost,
        addComment,
        updateInteraction
    } = useOptimisticInteractions('omzo', omzo.id);

    // Optional: Sync with scribe if this omzo is in a scribe
    if (omzo.scribe_id) {
        useSyncInteractionStateOptimized('omzo', omzo.id, 'scribe', omzo.scribe_id);
    }

    // Initialize from props on mount
    useEffect(() => {
        updateInteraction({
            is_liked: omzo.is_liked,
            like_count: omzo.like_count,
            is_disliked: omzo.is_disliked,
            dislike_count: omzo.dislike_count,
            is_saved: omzo.is_saved,
            is_reposted: omzo.is_reposted,
            repost_count: omzo.reposts,
            comment_count: omzo.comment_count
        });
    }, [omzo.id]);

    return (
        <View style={styles.container}>
            {/* Video */}
            <Video source={{ uri: omzo.video_file }} />

            {/* Actions */}
            <View style={styles.actionsColumn}>
                <TouchableOpacity onPress={toggleLike}>
                    <Text>♥️ {likeCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={toggleDislike}>
                    <Text>👎 {dislikeCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={toggleSave}>
                    <Text>🔖</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={toggleRepost}>
                    <Text>🔄 {repostCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity>
                    <Text>💬 {commentCount}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
```

## Testing Migration

After converting a component, test:

1. ✅ Like/unlike button updates instantly
2. ✅ Count updates instantly (like_count++)
3. ✅ Save/unsave button updates instantly
4. ✅ Switching to another screen and back preserves state
5. ✅ Offline action (turn off network) and coming back online
6. ✅ If available: Pending actions retry automatically after 30s

## Troubleshooting

**Issue**: State not updating in UI
- Check: Is `useOptimisticInteractions` hook imported?
- Check: Are you using the state from the hook, not from props?

**Issue**: Changes not persisting after app restart
- Check: Is `useInteractionCache.getState().loadFromCache()` called in App.tsx?

**Issue**: API calls still blocking
- Check: Are you awaiting toggleLike/toggleSave? You shouldn't need to for instant UI.

**Issue**: Duplicate actions being queued
- Check: Is the handler wrapped in useCallback?
