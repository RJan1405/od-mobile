# Instant UI Updates with Optimistic Actions

This implementation provides **instant UI updates** for interactions (likes, saves, reposts, comments) while maintaining the **subscriber pattern** and using **cache-first architecture**.

## Architecture Overview

### 1. **InteractionCache Store** (`interactionCache.ts`)
- Stores all interaction states (likes, saves, reposts, comments)
- Automatically persists to MMKV cache
- Zustand-based for efficient subscriptions
- Key format: `{type}_{id}` (e.g., `omzo_123`, `scribe_456`)

### 2. **Pending Actions Queue** (`pendingActionsStore.ts`)
- Queues failed/pending actions for retry
- Persists to cache for recovery on app restart
- Tracks retry count and max retries
- Supports all interaction types

### 3. **Optimistic Interaction Service** (`optimisticInteractionService.ts`)
- Handles instant UI updates
- Sends API calls asynchronously
- Rolls back on failure
- Manages pending action lifecycle

### 4. **Custom Hooks**
- `useOptimisticInteractions()` - Main hook for components
- `useSyncInteractionState()` - Syncs state across views
- `usePendingActionsRecovery()` - Recovers pending actions on app startup

## Usage Guide

### Basic Implementation in Components

#### Option A: Using the Main Hook (Recommended)

```tsx
import { useOptimisticInteractions } from '@/hooks/useOptimisticInteractions';

function OmzoCard({ omzo }) {
    // Get all interaction states and handlers
    const {
        isLiked,
        likeCount,
        isSaved,
        isDisliked,
        dislikeCount,
        toggleLike,
        toggleSave,
        toggleDislike,
        addComment,
        commentCount
    } = useOptimisticInteractions('omzo', omzo.id);

    // Initialize cache with data from props
    useEffect(() => {
        updateInteraction({
            is_liked: omzo.is_liked,
            like_count: omzo.like_count,
            is_saved: omzo.is_saved,
            is_disliked: omzo.is_disliked,
            dislike_count: omzo.dislike_count,
            comment_count: omzo.comment_count
        });
    }, [omzo.id]);

    return (
        <View>
            {/* Like Button */}
            <TouchableOpacity onPress={toggleLike}>
                <Icon 
                    name={isLiked ? 'heart' : 'heart-outline'}
                    color={isLiked ? 'red' : 'white'}
                />
                <Text>{likeCount}</Text>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity onPress={toggleSave}>
                <Icon 
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                />
            </TouchableOpacity>

            {/* Comments */}
            <TouchableOpacity onPress={() => setShowComments(true)}>
                <Text>{commentCount}</Text>
            </TouchableOpacity>
        </View>
    );
}
```

### Advanced: Syncing State Across Views

When you like an omzo in the player, you want it to update in the saved view too:

```tsx
import { useSyncInteractionStateOptimized } from '@/hooks/useSyncInteractionState';

function OmzoPlayer({ omzo }) {
    const interactions = useOptimisticInteractions('omzo', omzo.id);

    // Sync this omzo's state to the scribe containing it (if applicable)
    useSyncInteractionStateOptimized('omzo', omzo.id, 'scribe', omzo.scribe_id);

    return (
        <View>
            {/* Like button that syncs to scribe */}
            <TouchableOpacity onPress={interactions.toggleLike}>
                <Icon 
                    name={interactions.isLiked ? 'heart' : 'heart-outline'}
                    color={interactions.isLiked ? 'red' : 'white'}
                />
            </TouchableOpacity>
        </View>
    );
}
```

### App Initialization

Add this to `App.tsx` to recover pending actions on startup:

```tsx
import { usePendingActionsRecovery } from '@/hooks/usePendingActionsRecovery';
import { useInteractionCache } from '@/stores/interactionCache';

function App() {
    // ... existing code ...

    useEffect(() => {
        // Load interaction cache from persistent storage
        useInteractionCache.getState().loadFromCache();
    }, []);

    return (
        <GestureHandlerRootView>
            <SafeAreaProvider>
                <PendingActionsRecoveryHandler />
                <RootNavigator />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

// Separate component to use the recovery hook
function PendingActionsRecoveryHandler() {
    usePendingActionsRecovery();
    return null;
}
```

## Data Flow

### Instant Like Action

1. **User taps like button** → Immediate state change (no wait)
2. **UI updates instantly** (via Zustand subscription)
3. **Action queued** in pending actions
4. **API call sent** in background
5. **Server responds** → State confirmed or rolled back
6. **If failed** → Action stays in queue for retry

```
User Tap
   ↓
[INSTANT] Update Cache Store
   ↓
[INSTANT] Queue Pending Action
   ↓
UI Re-renders (subscribers notified)
   ↓
[ASYNC] Send to API
   ↓
Confirm/Rollback based on response
```

## Key Features

✅ **Instant UI Updates** - No waiting for API response  
✅ **Subscriber Pattern** - Zustand subscriptions keep UI in sync  
✅ **Cache-First** - Uses MMKV for offline state  
✅ **Retry Logic** - Pending actions retry on network recovery  
✅ **Cross-Screen Sync** - Like in player updates in saved view  
✅ **Realistic Feedback** - Instant visual response like Instagram/TikTok  
✅ **No Breaking Changes** - Works with existing subscriber pattern  

## Cache Storage Details

### Interaction Cache (MMKV)
```json
{
  "omzo_123": {
    "is_liked": true,
    "like_count": 45,
    "is_saved": false,
    "is_reposted": false,
    "comment_count": 12,
    "contentType": "omzo",
    "contentId": 123,
    "lastUpdated": 1700000000
  }
}
```

### Pending Actions Queue (MMKV)
```json
[
  {
    "id": "omzo_123_like_1700000000",
    "type": "like",
    "contentType": "omzo",
    "contentId": 123,
    "payload": { "is_liked": true, "like_count": 45 },
    "timestamp": 1700000000,
    "retries": 0,
    "maxRetries": 3
  }
]
```

## Handling Comments

```tsx
const { toggleLike, addComment, commentCount } = useOptimisticInteractions('omzo', omzo.id);

// When user submits a comment
const handleCommentSubmit = async (text) => {
    // Comment count increases instantly
    await addComment(text);
    
    // Then API call sends in background
    // UI shows new comment immediately
};
```

## Error Handling

All failed actions are queued and retried:

```tsx
// This will retry every 30 seconds automatically
const { isLiked } = useOptimisticInteractions('omzo', 123);

// UI shows liked=true even if API fails
// Action stays in queue and retries when connection recovers
```

Check pending status:

```tsx
import { usePendingActionCount } from '@/hooks/usePendingActionsRecovery';

function SyncStatus() {
    const pendingCount = usePendingActionCount();
    return pendingCount > 0 ? <Text>Syncing...</Text> : null;
}
```

## Migration from Old Pattern

### Before (with old store)
```tsx
const setInteraction = useInteractionStore(state => state.setInteraction);
setInteraction('omzo', id, { is_liked: true });
```

### After (with new hook)
```tsx
const { isLiked, toggleLike } = useOptimisticInteractions('omzo', id);
await toggleLike(); // Instant + auto-sync
```

## Performance Considerations

- ✅ **No re-render blocking** - Actions are instant
- ✅ **Selective subscriptions** - Only affected components update
- ✅ **Efficient cache** - MMKV is very fast
- ✅ **Async API calls** - Don't block main thread
- ✅ **Background retries** - 30-second interval (configurable)

## Testing

```tsx
import { renderHook, act } from '@testing-library/react-native';
import { useOptimisticInteractions } from '@/hooks/useOptimisticInteractions';

test('instant like update', () => {
    const { result } = renderHook(() => useOptimisticInteractions('omzo', 123));
    
    act(() => {
        result.current.toggleLike();
    });
    
    // UI updates immediately
    expect(result.current.isLiked).toBe(true);
});
```
