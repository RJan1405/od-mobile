# Quick Reference Card - Instant UI Updates

## Three Things You Need to Know

### 1. Initialize App
```tsx
// App.tsx
useEffect(() => {
    useInteractionCache.getState().loadFromCache();
}, []);

<PendingActionsRecoveryHandler />
```

### 2. Use in Components
```tsx
const { isLiked, likeCount, toggleLike } = useOptimisticInteractions('omzo', id);
await toggleLike(); // Instant!
```

### 3. Sync Across Views
```tsx
useSyncInteractionStateOptimized('omzo', id1, 'scribe', id2);
```

---

## All Available States

```tsx
const {
    // States
    isLiked,           // boolean
    likeCount,         // number
    isDisliked,        // boolean
    dislikeCount,      // number
    isSaved,           // boolean
    isReposted,        // boolean
    repostCount,       // number
    commentCount,      // number
    
    // Actions
    toggleLike,        // () => Promise<void>
    toggleDislike,     // () => Promise<void>
    toggleSave,        // () => Promise<void>
    toggleRepost,      // () => Promise<void>
    addComment,        // (text: string) => Promise<void>
    updateInteraction, // (updates: Partial) => void
} = useOptimisticInteractions('omzo', id);
```

---

## All Hooks

```tsx
// Main hook - use this in every component
useOptimisticInteractions(type: 'omzo' | 'scribe', id: number | string)

// Sync state between views (optional)
useSyncInteractionStateOptimized(sourceType, sourceId, targetType, targetId)

// Check for pending actions (for loading indicators)
usePendingActionCount() // returns number
useHasPendingActions(type, id) // returns boolean
```

---

## Common Patterns

### Pattern 1: Like Button
```tsx
const { isLiked, likeCount, toggleLike } = useOptimisticInteractions('omzo', omzo.id);

<TouchableOpacity onPress={toggleLike}>
    <Icon name={isLiked ? 'heart' : 'heart-outline'} />
    <Text>{likeCount}</Text>
</TouchableOpacity>
```

### Pattern 2: Save Button
```tsx
const { isSaved, toggleSave } = useOptimisticInteractions('omzo', omzo.id);

<TouchableOpacity onPress={toggleSave}>
    <Icon name={isSaved ? 'bookmark' : 'bookmark-outline'} />
</TouchableOpacity>
```

### Pattern 3: Initialize from Props
```tsx
useEffect(() => {
    updateInteraction({
        is_liked: omzo.is_liked,
        like_count: omzo.like_count,
        is_saved: omzo.is_saved,
        is_disliked: omzo.is_disliked,
        dislike_count: omzo.dislike_count,
        comment_count: omzo.comment_count,
    });
}, [omzo.id]);
```

### Pattern 4: Add Comment
```tsx
const { addComment, commentCount } = useOptimisticInteractions('omzo', id);

const handleComment = async (text) => {
    await addComment(text);
    // Comment count already updated
    setShowComments(false);
};
```

---

## What Happens Automatically

✅ Cache persists to MMKV  
✅ Failed actions queue up  
✅ Retries happen every 30s  
✅ Cache loads on app start  
✅ Zustand notifies subscribers  
✅ UI updates instantly  

---

## Common Mistakes to Avoid

❌ **Don't** use old `useInteractionStore` directly  
✅ **Do** use `useOptimisticInteractions` hook

❌ **Don't** manage interaction state with `useState`  
✅ **Do** use the hook's states

❌ **Don't** await the toggle functions for instant feedback  
✅ **Do** call them fire-and-forget (UI updates instantly)

❌ **Don't** manually call API methods  
✅ **Do** let the hook handle API calls

---

## File Locations

```
src/
├── stores/
│   ├── interactionCache.ts          ← Main state store
│   └── pendingActionsStore.ts       ← Retry queue
├── services/
│   └── optimisticInteractionService.ts ← Core logic
├── hooks/
│   ├── useOptimisticInteractions.ts ← Main hook
│   ├── useSyncInteractionState.ts   ← Sync hook
│   └── usePendingActionsRecovery.ts ← Recovery hook
└── App.tsx                          ← Initialize here
```

---

## Debugging

**Check pending actions:**
```tsx
const pending = usePendingActionsStore.getState().getPendingActions();
console.log('Pending:', pending);
```

**Check cache:**
```tsx
const cache = useInteractionCache.getState().cache;
console.log('Cache:', cache);
```

**Check specific content:**
```tsx
const state = useInteractionCache.getState().getInteraction('omzo', 123);
console.log('Omzo 123 state:', state);
```

---

## Integration Checklist

- [ ] Create all 5 store/service/hook files
- [ ] Update App.tsx with recovery handler
- [ ] Update first component (OmzoCard)
- [ ] Test like/save/comment interactions
- [ ] Test offline (toggle network)
- [ ] Test app restart with pending actions
- [ ] Update remaining components
- [ ] Test cross-screen sync

---

## Performance Tips

💡 Wrap handlers in `useCallback` to prevent re-renders
💡 Use `useSyncInteractionStateOptimized` instead of polling
💡 Only call `updateInteraction` when props change
💡 Don't subscribe to cache directly - use the hook

---

## Example Complete Component

```tsx
import { useOptimisticInteractions } from '@/hooks/useOptimisticInteractions';

function OmzoCard({ omzo }) {
    const {
        isLiked,
        likeCount,
        isSaved,
        commentCount,
        toggleLike,
        toggleSave,
        updateInteraction
    } = useOptimisticInteractions('omzo', omzo.id);

    useEffect(() => {
        updateInteraction({
            is_liked: omzo.is_liked,
            like_count: omzo.like_count,
            is_saved: omzo.is_saved,
            comment_count: omzo.comment_count,
        });
    }, [omzo.id]);

    return (
        <View>
            <TouchableOpacity onPress={toggleLike}>
                <Icon name={isLiked ? 'heart' : 'heart-outline'} />
                <Text>{likeCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleSave}>
                <Icon name={isSaved ? 'bookmark' : 'bookmark-outline'} />
            </TouchableOpacity>

            <Text>Comments: {commentCount}</Text>
        </View>
    );
}
```

---

## Need Help?

1. Check MIGRATION_GUIDE.md for step-by-step instructions
2. Check INSTANT_UI_IMPLEMENTATION.md for technical details
3. Check EXAMPLE_UPDATED_OMZO_CARD.tsx for reference code
4. Use console.log with the debugging commands above
