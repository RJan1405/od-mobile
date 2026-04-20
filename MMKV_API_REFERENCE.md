# 📖 MMKV API Reference

Complete API documentation for the MMKV storage service.

---

## 📁 ChatStorage

Fast key-value storage for chats and messages.

### Chats

#### `ChatStorage.saveChats(chats: Chat[])`
Save all chats to MMKV.
```tsx
ChatStorage.saveChats(transformedChats);
```

#### `ChatStorage.getChats(): Chat[]`
Load all chats from MMKV. Returns `[]` if empty.
```tsx
const chats = ChatStorage.getChats();
```

---

### Messages

#### `ChatStorage.saveMessages(chatId: number, messages: Message[])`
Save messages for a specific chat.
```tsx
ChatStorage.saveMessages(123, messages);
```

#### `ChatStorage.getMessages(chatId: number): Message[]`
Load messages for a specific chat. Returns `[]` if not found.
```tsx
const messages = ChatStorage.getMessages(123);
```

#### `ChatStorage.addMessage(chatId: number, message: Message)`
Add a single message to a chat's message list.
```tsx
ChatStorage.addMessage(123, newMessage);
// Automatically appends and saves to MMKV
```

#### `ChatStorage.updateMessage(chatId: number, messageId: number, updates: Partial<Message>)`
Update a message in a chat.
```tsx
ChatStorage.updateMessage(123, 456, { is_read: true });
```

#### `ChatStorage.removeMessage(chatId: number, messageId: number)`
Remove a message from a chat.
```tsx
ChatStorage.removeMessage(123, 456);
```

#### `ChatStorage.clearMessages(chatId: number)`
Delete all messages for a chat.
```tsx
ChatStorage.clearMessages(123);
```

---

### Unread Counts

#### `ChatStorage.setUnreadCount(chatId: number, count: number)`
Save unread count for a chat.
```tsx
ChatStorage.setUnreadCount(123, 5);
```

#### `ChatStorage.getUnreadCount(chatId: number): number`
Get unread count for a chat. Returns `0` if not set.
```tsx
const count = ChatStorage.getUnreadCount(123); // 5
```

#### `ChatStorage.getAllUnreadCounts(): Map<number, number>`
Get all unread counts as a Map.
```tsx
const counts = ChatStorage.getAllUnreadCounts();
counts.get(123); // 5
counts.get(456); // 3
```

#### `ChatStorage.saveAllUnreadCounts(counts: Map<number, number>)`
Save all unread counts at once.
```tsx
ChatStorage.saveAllUnreadCounts(new Map([
    [123, 5],
    [456, 3]
]));
```

---

### Cleanup

#### `ChatStorage.clearAllChats()`
Delete all chat data and unread counts.
```tsx
ChatStorage.clearAllChats();
// Individual message caches are preserved
```

---

## 💬 InteractionStorage

Fast storage for likes, saves, comments on content.

### Core Methods

#### `InteractionStorage.setInteraction(type: 'omzo' | 'scribe', id: number | string, state: any)`
Save interaction state for an item.
```tsx
InteractionStorage.setInteraction('omzo', 123, {
    is_liked: true,
    like_count: 42,
    is_saved: false,
    comment_count: 8
});
```

#### `InteractionStorage.getInteraction(type: 'omzo' | 'scribe', id: number | string): any`
Get interaction state for an item.
```tsx
const state = InteractionStorage.getInteraction('omzo', 123);
// Returns: { is_liked: true, like_count: 42, ... }
```

#### `InteractionStorage.getAllInteractions(): Record<string, any>`
Get all interactions at once.
```tsx
const all = InteractionStorage.getAllInteractions();
// Returns: { 'omzo_123': {...}, 'scribe_456': {...}, ... }
```

---

### Batch Operations

#### `InteractionStorage.batchSetInteractions(updates: Record<string, any>)`
Save multiple interactions at once.
```tsx
InteractionStorage.batchSetInteractions({
    'omzo_123': { is_liked: true, like_count: 42 },
    'scribe_456': { is_saved: true },
    'omzo_789': { is_liked: false }
});
```

---

### Cleanup

#### `InteractionStorage.clearInteractions()`
Delete all interaction data.
```tsx
InteractionStorage.clearInteractions();
```

---

## 📤 UploadStorage

Storage for user uploads and saved content.

### My Uploads - Scribes

#### `UploadStorage.saveMyScribes(scribes: Scribe[])`
Save user's scribes.
```tsx
UploadStorage.saveMyScribes(scribes);
```

#### `UploadStorage.getMyScribes(): Scribe[]`
Load user's scribes.
```tsx
const scribes = UploadStorage.getMyScribes();
```

#### `UploadStorage.addMyScribe(scribe: Scribe)`
Add a single scribe (prepends to beginning).
```tsx
UploadStorage.addMyScribe(newScribe);
```

---

### My Uploads - Omzos

#### `UploadStorage.saveMyOmzos(omzos: Omzo[])`
Save user's omzos.
```tsx
UploadStorage.saveMyOmzos(omzos);
```

#### `UploadStorage.getMyOmzos(): Omzo[]`
Load user's omzos.
```tsx
const omzos = UploadStorage.getMyOmzos();
```

#### `UploadStorage.addMyOmzo(omzo: Omzo)`
Add a single omzo (prepends to beginning).
```tsx
UploadStorage.addMyOmzo(newOmzo);
```

---

### Saved Content - Scribes

#### `UploadStorage.saveSavedScribes(scribes: Scribe[])`
Save saved scribes.
```tsx
UploadStorage.saveSavedScribes(scribes);
```

#### `UploadStorage.getSavedScribes(): Scribe[]`
Load saved scribes.
```tsx
const saved = UploadStorage.getSavedScribes();
```

---

### Saved Content - Omzos

#### `UploadStorage.saveSavedOmzos(omzos: Omzo[])`
Save saved omzos.
```tsx
UploadStorage.saveSavedOmzos(omzos);
```

#### `UploadStorage.getSavedOmzos(): Omzo[]`
Load saved omzos.
```tsx
const saved = UploadStorage.getSavedOmzos();
```

---

### Cleanup

#### `UploadStorage.clearAllUploads()`
Delete all upload and saved content data.
```tsx
UploadStorage.clearAllUploads();
// Clears: myScribes, myOmzos, savedScribes, savedOmzos
```

---

## ⏳ PendingActionsStorage

Storage for actions that failed and need retry.

#### `PendingActionsStorage.savePendingActions(actions: any[])`
Save pending actions list.
```tsx
PendingActionsStorage.savePendingActions([
    { id: 'like-123', type: 'like', contentId: 123 },
    { id: 'save-456', type: 'save', contentId: 456 }
]);
```

#### `PendingActionsStorage.getPendingActions(): any[]`
Load pending actions. Returns `[]` if empty.
```tsx
const actions = PendingActionsStorage.getPendingActions();
```

#### `PendingActionsStorage.addPendingAction(action: any)`
Add a single pending action.
```tsx
PendingActionsStorage.addPendingAction({
    id: 'like-123',
    type: 'like',
    contentType: 'omzo',
    contentId: 123,
    timestamp: Date.now(),
    retryCount: 0
});
```

#### `PendingActionsStorage.removePendingAction(actionId: string)`
Remove a pending action (after it succeeds).
```tsx
PendingActionsStorage.removePendingAction('like-123');
```

#### `PendingActionsStorage.clearPendingActions()`
Delete all pending actions.
```tsx
PendingActionsStorage.clearPendingActions();
```

---

## 🕐 SyncMetadata

Track when data was last synced.

#### `SyncMetadata.setLastSyncTime(resource: string, timestamp: number)`
Save last sync time for a resource.
```tsx
SyncMetadata.setLastSyncTime('chats', Date.now());
SyncMetadata.setLastSyncTime('my_scribes', Date.now());
```

#### `SyncMetadata.getLastSyncTime(resource: string): number`
Get last sync time. Returns `0` if never synced.
```tsx
const lastSync = SyncMetadata.getLastSyncTime('chats');
// Returns timestamp in ms
```

#### `SyncMetadata.needsRefresh(resource: string, maxAge: number = 5 * 60 * 1000): boolean`
Check if data needs refresh (older than maxAge).
```tsx
// Refresh if older than 5 minutes
if (SyncMetadata.needsRefresh('chats', 5 * 60 * 1000)) {
    loadChatsFromAPI();
}

// Refresh if older than 2 minutes
if (SyncMetadata.needsRefresh('my_omzos', 2 * 60 * 1000)) {
    loadMyOmzosFromAPI();
}
```

---

## 🗑️ StorageCleanup

Utilities for debugging and cleanup.

#### `StorageCleanup.clearAllData()`
⚠️ **DANGEROUS** - Delete all MMKV data.
```tsx
StorageCleanup.clearAllData();
// All caches are gone!
```

#### `StorageCleanup.getStorageSize(): string`
Get storage info as formatted string.
```tsx
const size = StorageCleanup.getStorageSize();
console.log(size); // "156 keys stored"
```

#### `StorageCleanup.logAllKeys()`
Log all stored keys to console (debugging).
```tsx
StorageCleanup.logAllKeys();
// Prints all keys in MMKV
```

---

## 🔑 Storage Keys Reference

| Data | Key Pattern | Example |
|------|-------------|---------|
| Chats | `chats` | - |
| Chat Messages | `chat_messages_{id}` | `chat_messages_123` |
| Unread Counts | `unread_count_{id}` | `unread_count_123` |
| All Unread Counts | `all_unread_counts` | - |
| Interactions | `interaction_{type}_{id}` | `interaction_omzo_123` |
| All Interactions | `interactions` | - |
| My Scribes | `my_scribes` | - |
| My Omzos | `my_omzos` | - |
| Saved Scribes | `saved_scribes` | - |
| Saved Omzos | `saved_omzos` | - |
| Pending Actions | `pending_actions` | - |
| Last Sync Time | `last_sync_{resource}` | `last_sync_chats` |

---

## 💾 Type Definitions

### InteractionState
```tsx
interface InteractionState {
    is_liked?: boolean;
    like_count?: number;
    is_disliked?: boolean;
    dislike_count?: number;
    is_saved?: boolean;
    is_reposted?: boolean;
    repost_count?: number;
    comment_count?: number;
}
```

### PendingAction
```tsx
interface PendingAction {
    id: string;
    type: 'like' | 'save' | 'repost' | 'comment';
    contentType: 'omzo' | 'scribe';
    contentId: number;
    timestamp: number;
    retryCount: number;
    maxRetries?: number;
}
```

---

## 🚀 Performance Tips

### ✅ Do

- Load from cache first, then refresh
- Batch updates when possible
- Use `needsRefresh()` to avoid unnecessary API calls
- Clear cache on logout
- Use `addMessage()` instead of `saveMessages()` for single messages

### ❌ Don't

- Call `saveChats()` on every message received
- Load all data at app startup (use cache)
- Store sensitive data (MMKV is not encrypted)
- Keep enormous arrays (paginate large lists)
- Forget to clear cache on logout

---

## ⚡ Real-World Examples

### Example 1: Load Chats Efficiently
```tsx
// Load from cache immediately, refresh in background
const chats = ChatStorage.getChats();
if (chats.length > 0) {
    setChats(chats); // Show instantly
}

// Then refresh
api.getChats().then(response => {
    if (response.success) {
        ChatStorage.saveChats(response.chats);
        setChats(response.chats); // Update with fresh data
    }
});
```

### Example 2: Handle Failed Like Action
```tsx
async function toggleLike(contentType, contentId) {
    try {
        const response = await api.toggleLike(contentType, contentId);
        
        if (response.success) {
            // Save to cache
            InteractionStorage.setInteraction(
                contentType, 
                contentId, 
                { is_liked: response.is_liked }
            );
        }
    } catch (error) {
        // Queue for retry
        PendingActionsStorage.addPendingAction({
            id: `like-${contentId}`,
            type: 'like',
            contentType,
            contentId,
            timestamp: Date.now(),
            retryCount: 0
        });
    }
}
```

### Example 3: Implement Pull-to-Refresh
```tsx
async function handleRefresh() {
    try {
        // Force refresh (not from cache)
        const response = await api.getChats();
        ChatStorage.saveChats(response.chats);
        SyncMetadata.setLastSyncTime('chats', Date.now());
    } catch (error) {
        console.error('Refresh failed:', error);
    }
}
```

### Example 4: Logout with Cache Clear
```tsx
async function logout() {
    // Clear all caches
    ChatStorage.clearAllChats();
    InteractionStorage.clearInteractions();
    UploadStorage.clearAllUploads();
    PendingActionsStorage.clearPendingActions();
    StorageCleanup.clearAllData();
    
    // Then clear auth
    await authStore.logout();
}
```

---

## 🆘 Error Handling

All MMKV methods are try-catch wrapped and log errors to console:

```tsx
// Safe to call, won't crash
ChatStorage.saveChats(chats); // Logs errors but doesn't throw

// Always returns fallback value
ChatStorage.getChats(); // Returns [] on error
ChatStorage.getUnreadCount(123); // Returns 0 on error
```

---

## 📊 Data Size Estimates

| Data | 100 items | 1000 items |
|------|-----------|-----------|
| Chats | ~2-5KB | N/A (unusual) |
| Messages | ~10-50KB | ~100-500KB |
| Interactions | ~2-5KB | ~20-50KB |
| Scribes | ~50-100KB | ~500-1MB |
| Omzos | ~20-50KB | ~200-500KB |

**Typical app with 50 chats, 500 messages, 100 scribes, 100 omzos:**
- Total: ~3-5MB (well within device storage)

---

## 🔍 Debugging Commands

```tsx
// Log all data
StorageCleanup.logAllKeys();

// Check size
console.log(StorageCleanup.getStorageSize());

// Clear for testing
StorageCleanup.clearAllData();

// Check specific data
console.log('Chats:', ChatStorage.getChats().length);
console.log('Messages:', ChatStorage.getMessages(123).length);
console.log('Pending:', PendingActionsStorage.getPendingActions().length);
```

---

**That's the complete MMKV API! Use this as a reference when implementing. 🎯**
