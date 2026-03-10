import { create } from 'zustand';
import type { Chat, Message } from '@/types';
import api from '@/services/api';
import websocket from '@/services/websocket';
import { buildFullUrl } from '@/utils/api-helpers';

interface ChatState {
    chats: Chat[];
    currentChat: Chat | null;
    messages: Map<number, Message[]>;
    isLoading: boolean;
    unreadCounts: Map<number, number>;

    // Actions
    loadChats: () => Promise<void>;
    loadMessages: (chatId: number) => Promise<void>;
    setCurrentChat: (chat: Chat | null) => void;
    addMessage: (chatId: number, message: Message) => void;
    updateMessage: (chatId: number, messageId: number, updates: Partial<Message>) => void;
    removeMessage: (chatId: number, messageId: number) => void;
    sendMessage: (chatId: number, content: string, mediaUri?: string, mediaParams?: { name: string, type: string }, oneTime?: boolean) => Promise<void>;
    consumeMessage: (chatId: number, messageId: number) => Promise<any>;
    clearMessages: (chatId: number) => void;
    markMessagesAsRead: (chatId: number, messageIds?: number[]) => Promise<void>;
    markChatAsRead: (chatId: number) => Promise<void>;
    updateUnreadCounts: () => Promise<void>;
    updateChatUnreadCount: (chatId: number, count: number) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    chats: [],
    currentChat: null,
    messages: new Map(),
    isLoading: false,
    unreadCounts: new Map(),

    loadChats: async () => {
        set({ isLoading: true });
        try {
            console.log('📞 Loading chats...');
            const response = await api.getChats();
            console.log('📬 Chats response:', JSON.stringify(response, null, 2));

            // Backend returns: { success: true, chats: [...] }
            if (response.success && (response as any).chats) {
                const chatsData = (response as any).chats;
                console.log('✅ Loaded', chatsData.length, 'chats');

                // Transform the chat data to match our interface
                const transformedChats = chatsData.map((chat: any) => {
                    console.log('🔍 Raw chat data from backend:', {
                        chatId: chat.id,
                        last_message: chat.last_message,
                        one_time: chat.last_message?.one_time,
                        consumed_at: chat.last_message?.consumed_at,
                        content: chat.last_message?.content,
                        last_message_time: chat.last_message_time
                    });

                    const transformedChat = {
                        id: chat.id,
                        chat_type: chat.is_group ? 'group' : 'private',
                        name: chat.name,
                        description: chat.description,
                        group_avatar: buildFullUrl(chat.avatar),
                        participants: chat.other_user ? [{
                            id: chat.other_user.id,
                            username: chat.other_user.username,
                            full_name: chat.other_user.full_name,
                            profile_picture_url: buildFullUrl(chat.other_user.profile_picture),
                            is_online: chat.other_user.is_online,
                            is_verified: chat.other_user.is_verified,
                        }] : [],
                        last_message: chat.last_message ? {
                            id: chat.last_message.id || 0,
                            chat: chat.id,
                            content: chat.last_message.content,
                            timestamp: chat.last_message_time || new Date().toISOString(),
                            sender: { id: 0 } as any,
                            message_type: 'text',
                            is_read: false,
                            is_deleted: false,
                            is_edited: false,
                            one_time: chat.last_message.one_time || false,
                            consumed_at: chat.last_message.consumed_at,
                        } : undefined,
                        unread_count: chat.unread_count || 0,
                        is_public: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };

                    console.log('📝 Transformed chat:', {
                        chatId: transformedChat.id,
                        last_message_one_time: transformedChat.last_message?.one_time,
                        last_message_content: transformedChat.last_message?.content,
                        consumed_at: transformedChat.last_message?.consumed_at
                    });

                    return transformedChat;
                });

                console.log('📝 Transformed chats:', transformedChats);
                set({ chats: transformedChats });
            } else {
                console.log('❌ No chats data in response:', response);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    loadMessages: async (chatId: number) => {
        set({ isLoading: true });
        try {
            console.log('📞 Loading messages for chat:', chatId);
            const response = await api.getChatMessages(chatId);
            console.log('📬 Raw API response:', response);

            // Backend returns { messages: [...], chat_updated: "..." }
            // The API service returns response.data which is the Django JSON response
            const messagesData = (response as any).messages || [];
            console.log('✅ Found', messagesData.length, 'messages');

            // Transform to mobile format (matching React frontend logic)
            const transformedMessages = messagesData.map((m: any, index: number) => {
                console.log(`📨 Message ${index}:`, {
                    id: m.id,
                    content: m.content,
                    sender: m.sender,
                    sender_id: m.sender_id,
                    timestamp_iso: m.timestamp_iso
                });

                return {
                    id: m.id || (Date.now() + index),
                    chat: chatId,
                    sender: {
                        id: m.sender_id || 0,
                        username: m.sender || 'Unknown',
                        full_name: m.sender_name || 'Unknown User',
                        profile_picture_url: buildFullUrl(m.sender_avatar || ''),
                        is_verified: false,
                        is_online: false,
                    } as any,
                    content: m.content || '',
                    message_type: m.message_type || m.type || 'text',
                    media_url: m.media_url ? buildFullUrl(m.media_url) : undefined,
                    media_type: m.media_type,
                    media_filename: m.media_filename,
                    timestamp: m.timestamp_iso || m.timestamp || new Date().toISOString(),
                    is_read: m.is_read || m.viewed || false,
                    one_time: m.one_time || false,
                    consumed_at: m.consumed ? (m.timestamp_iso || m.timestamp) : undefined,
                    is_edited: m.is_edited || false,
                    edited_at: m.edited_at,
                    reply_to: m.reply_to ? {
                        id: m.reply_to.id,
                        content: m.reply_to.content,
                        sender: { full_name: m.reply_to.sender_name } as any,
                    } as any : undefined,
                    shared_scribe: m.shared_scribe,
                    shared_omzo: m.shared_omzo,
                    story_reply: m.story_reply,
                };
            });

            console.log('📝 Transformed to', transformedMessages.length, 'messages');
            const messages = get().messages;
            messages.set(chatId, transformedMessages);
            set({ messages: new Map(messages) });
        } catch (error) {
            console.error('❌ Error loading messages:', error);
            // Set empty array on error
            const messages = get().messages;
            messages.set(chatId, []);
            set({ messages: new Map(messages) });
        } finally {
            set({ isLoading: false });
        }
    },

    setCurrentChat: (chat: Chat | null) => {
        set({ currentChat: chat });
    },

    addMessage: (chatId: number, message: Message | any) => {
        try {
            // Ensure the message has proper structure
            // Handle cases where sender is just a string (username) from WebSocket
            const senderObj = typeof message.sender === 'string' ? {
                id: message.sender_id || 0,
                username: message.sender,
                full_name: message.sender_name || message.sender,
                profile_picture_url: buildFullUrl(message.sender_avatar || ''),
                is_verified: false,
                is_online: false,
            } : (message.sender || {
                id: message.sender_id || 0,
                username: message.sender_username || 'Unknown',
                full_name: message.sender_name || 'Unknown User',
                profile_picture_url: buildFullUrl(message.sender_avatar || ''),
                is_verified: false,
                is_online: false,
            });

            const normalizedMessage: Message = {
                id: message.id || Date.now(),
                chat: message.chat || chatId,
                sender: senderObj as any,
                content: message.content || '',
                message_type: message.message_type || 'text',
                media_url: message.media_url ? buildFullUrl(message.media_url) : undefined,
                media_type: message.media_type,
                media_filename: message.media_filename,
                timestamp: message.timestamp_iso || message.timestamp || new Date().toISOString(),
                is_read: message.is_read || false,
                one_time: message.one_time || false,
                consumed_at: message.consumed_at,
                is_edited: message.is_edited || false,
                edited_at: message.edited_at,
                reply_to: message.reply_to,
                shared_scribe: message.shared_scribe,
                shared_omzo: message.shared_omzo,
                story_reply: message.story_reply,
            };

            const messages = get().messages;
            const chatMessages = messages.get(chatId) || [];

            // Deduplicate: skip if a message with the same ID already exists
            if (normalizedMessage.id && chatMessages.some(msg => msg.id === normalizedMessage.id)) {
                return;
            }

            messages.set(chatId, [...chatMessages, normalizedMessage]);
            set({ messages: new Map(messages) });
        } catch (error) {
            console.error('Error adding message:', error, message);
        }
    },

    updateMessage: (chatId: number, messageId: number, updates: Partial<Message>) => {
        const messages = get().messages;
        const chatMessages = messages.get(chatId) || [];
        const updatedMessages = chatMessages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
        );
        messages.set(chatId, updatedMessages);
        set({ messages: new Map(messages) });
    },

    removeMessage: (chatId: number, messageId: number) => {
        const messages = get().messages;
        const chatMessages = messages.get(chatId) || [];
        const filteredMessages = chatMessages.filter(msg => msg.id !== messageId);
        messages.set(chatId, filteredMessages);
        set({ messages: new Map(messages) });
    },

    sendMessage: async (chatId: number, content: string, mediaUri?: string, mediaParams?: { name: string, type: string }, oneTime: boolean = false) => {
        try {
            console.log('📤 Sending message:', { chatId, content, mediaUri, oneTime });
            const formData = new FormData();
            formData.append('chat_id', chatId.toString());
            formData.append('content', content);
            if (oneTime) {
                formData.append('one_time', 'true');
            }

            if (mediaUri) {
                const filename = mediaParams?.name || mediaUri.split('/').pop() || 'media';

                let type = mediaParams?.type;
                if (!type) {
                    const match = /\.(\w+)$/.exec(filename);
                    type = match ? `image/${match[1]}` : 'image';
                }

                formData.append('media', {
                    uri: mediaUri,
                    name: filename,
                    type,
                } as any);
            }

            const response = await api.sendMessage(formData);
            console.log('📬 Send message response:', response);

            // Backend returns { success: true, message: {...} }
            if (response.success && (response as any).message) {
                const m = (response as any).message;

                // Transform and add the sent message to the store
                const sentMessage = {
                    id: m.id,
                    chat: chatId,
                    sender: {
                        id: m.sender_id,
                        username: m.sender,
                        full_name: m.sender_name,
                        profile_picture_url: buildFullUrl(m.sender_avatar || ''),
                        is_verified: false,
                        is_online: false,
                    } as any,
                    content: m.content,
                    message_type: m.message_type || 'text',
                    media_url: m.media_url ? buildFullUrl(m.media_url) : undefined,
                    media_type: m.media_type,
                    media_filename: m.media_filename,
                    timestamp: m.timestamp_iso || m.timestamp || new Date().toISOString(),
                    is_read: m.is_read || false,
                    one_time: m.one_time || false,
                    consumed_at: undefined,
                    is_edited: false,
                    edited_at: undefined,
                    reply_to: m.reply_to,
                    shared_scribe: m.shared_scribe,
                    shared_omzo: m.shared_omzo,
                };

                console.log('✅ Message sent, adding to store:', sentMessage);
                get().addMessage(chatId, sentMessage);
            } else {
                console.error('❌ Send message failed:', response);
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            throw error;
        }
    },

    consumeMessage: async (chatId: number, messageId: number) => {
        try {
            console.log(`[ChatStore] Consuming OTV message: ${messageId}`);
            const response = await api.consumeOneTimeMessage(messageId);

            if (response.success) {
                console.log(`[ChatStore] OTV content revealed:`, response);

                // Update local state is done by the caller or by WebSocket event
                // But we should notify the server via WS that we consumed it
                websocket.sendConsumeReceipt(chatId, messageId);

                return response; // Contains Revealed text/media
            } else {
                console.warn(`[ChatStore] Failed to consume OTV:`, response.error);
                return response;
            }
        } catch (error) {
            console.error(`[ChatStore] Error consuming message:`, error);
            return { success: false, error: 'Internal error' };
        }
    },

    clearMessages: (chatId: number) => {
        const messages = get().messages;
        messages.delete(chatId);
        set({ messages: new Map(messages) });
    },

    markMessagesAsRead: async (chatId: number, messageIds?: number[]) => {
        try {
            const response = await api.markMessagesRead(chatId, messageIds);
            if (response.success) {
                const data = response as any;
                // Update unread count for this chat
                const unreadCounts = get().unreadCounts;
                unreadCounts.set(chatId, data.unread_count || 0);
                set({ unreadCounts: new Map(unreadCounts) });

                // Update is_read status on messages locally
                if (data.marked_message_ids && data.marked_message_ids.length > 0) {
                    const messages = get().messages;
                    const chatMessages = messages.get(chatId) || [];
                    const updatedMessages = chatMessages.map(msg =>
                        data.marked_message_ids.includes(msg.id) ? { ...msg, is_read: true } : msg
                    );
                    messages.set(chatId, updatedMessages);
                    set({ messages: new Map(messages) });
                }

                // Update chat's unread_count in chat list
                const chats = get().chats.map(chat =>
                    chat.id === chatId ? { ...chat, unread_count: data.unread_count || 0 } : chat
                );
                set({ chats });
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    },

    markChatAsRead: async (chatId: number) => {
        try {
            const response = await api.markChatRead(chatId);
            if (response.success) {
                const data = response as any;
                // Update unread count for this chat
                const unreadCounts = get().unreadCounts;
                unreadCounts.set(chatId, 0);
                set({ unreadCounts: new Map(unreadCounts) });

                // Mark all messages as read locally
                const messages = get().messages;
                const chatMessages = messages.get(chatId) || [];
                const updatedMessages = chatMessages.map(msg => ({ ...msg, is_read: true }));
                messages.set(chatId, updatedMessages);
                set({ messages: new Map(messages) });

                // Update chat's unread_count in chat list
                const chats = get().chats.map(chat =>
                    chat.id === chatId ? { ...chat, unread_count: 0 } : chat
                );
                set({ chats });
            }
        } catch (error) {
            console.error('Error marking chat as read:', error);
        }
    },

    updateUnreadCounts: async () => {
        try {
            const response = await api.getUnreadCounts();
            if (response.success) {
                const data = response as any;
                const unreadCounts = new Map<number, number>();

                // Convert string keys to numbers and populate map
                Object.entries(data.counts || {}).forEach(([chatId, count]) => {
                    unreadCounts.set(Number(chatId), count as number);
                });

                set({ unreadCounts });

                // Also update the chats array with unread counts
                const chats = get().chats.map(chat => ({
                    ...chat,
                    unread_count: unreadCounts.get(chat.id) || 0
                }));
                set({ chats });
            }
        } catch (error) {
            console.error('Error updating unread counts:', error);
        }
    },

    updateChatUnreadCount: (chatId: number, count: number) => {
        const unreadCounts = get().unreadCounts;
        unreadCounts.set(chatId, count);
        set({ unreadCounts: new Map(unreadCounts) });

        // Also update in the chat list
        const chats = get().chats.map(chat =>
            chat.id === chatId ? { ...chat, unread_count: count } : chat
        );
        set({ chats });
    },
}));
