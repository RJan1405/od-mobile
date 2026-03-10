import { API_CONFIG } from '@/config';
import type { Message } from '@/types';

type MessageCallback = (message: Message) => void;
type ReadReceiptCallback = (data: { message_id: number; read_by: number; read_at: string }) => void;
type ConsumedCallback = (data: { message_id: number; consumed_by: number; consumed_at: string }) => void;
type EventCallback = (data: any) => void;

class WebSocketService {
    private chatSockets: Map<number, WebSocket> = new Map();
    private notifySocket: WebSocket | null = null;
    private sidebarSocket: WebSocket | null = null;
    private callSocket: WebSocket | null = null;

    private messageCallbacks: Map<number, MessageCallback[]> = new Map();
    private readReceiptCallbacks: Map<number, ReadReceiptCallback[]> = new Map();
    private consumedCallbacks: Map<number, ConsumedCallback[]> = new Map();
    private p2pCallbacks: Map<number, EventCallback[]> = new Map();
    private notifyCallbacks: EventCallback[] = [];
    private sidebarCallbacks: EventCallback[] = [];
    private callCallbacks: EventCallback[] = [];

    private reconnectAttempts: Map<string, number> = new Map();
    private maxReconnectAttempts = 5;
    private reconnectDelay = 3000;

    // ==================== CHAT WEBSOCKET ====================
    connectToChat(chatId: number, onMessage: MessageCallback): () => void {
        const wsUrl = `${API_CONFIG.WS_URL}/ws/chat/${chatId}/`;

        // Add callback ONLY if not already registered (prevents duplicate listeners on re-render)
        const callbacks = this.messageCallbacks.get(chatId) || [];
        if (!callbacks.includes(onMessage)) {
            callbacks.push(onMessage);
            this.messageCallbacks.set(chatId, callbacks);
        }

        // If socket exists in any active state (CONNECTING or OPEN), do NOT create a second one
        if (this.chatSockets.has(chatId)) {
            const socket = this.chatSockets.get(chatId)!;
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                return () => this.removeMessageCallback(chatId, onMessage);
            }
        }

        // Create new socket
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`✅ [WebSocket] Connected to chat ${chatId}`);
            this.reconnectAttempts.delete(`chat_${chatId}`);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const callbacks = this.messageCallbacks.get(chatId) || [];
                const readCallbacks = this.readReceiptCallbacks.get(chatId) || [];

                if (data.type === 'message.new') {
                    callbacks.forEach(cb => cb(data.message));
                } else if (data.type === 'typing.update') {
                    // Relay typing updates via message callbacks as typed data
                    callbacks.forEach(cb => cb({ type: 'typing.update', users: data.users } as any));
                } else if (data.type === 'message.read') {
                    readCallbacks.forEach(cb => cb({
                        message_id: data.message_id,
                        read_by: data.read_by,
                        read_at: data.read_at
                    }));
                } else if (data.type === 'message.consumed') {
                    const consumeCallbacks = this.consumedCallbacks.get(chatId) || [];
                    consumeCallbacks.forEach(cb => cb({
                        message_id: data.message_id,
                        consumed_by: data.consumed_by,
                        consumed_at: data.consumed_at
                    }));
                } else if (data.type === 'p2p.signal') {
                    const p2pCbs = this.p2pCallbacks.get(chatId) || [];
                    p2pCbs.forEach(cb => cb(data));
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        socket.onerror = (error) => {
            console.error(`Chat ${chatId} WebSocket error:`, error);
        };

        socket.onclose = () => {
            console.log(`🔌 [WebSocket] Disconnected from chat ${chatId}`);
            this.chatSockets.delete(chatId);

            const attemptKey = `chat_${chatId}`;
            const attempts = this.reconnectAttempts.get(attemptKey) || 0;

            if (attempts < this.maxReconnectAttempts) {
                this.reconnectAttempts.set(attemptKey, attempts + 1);
                const delay = this.reconnectDelay * (attempts + 1); // Exponential backoff
                console.log(`🔄 [WebSocket] Reconnecting chat ${chatId} in ${delay}ms... (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
                setTimeout(() => {
                    if (this.messageCallbacks.has(chatId) && this.messageCallbacks.get(chatId)!.length > 0) {
                        // Reconnect with first registered callback (avoids creating duplicates)
                        const cbs = this.messageCallbacks.get(chatId)!;
                        if (cbs.length > 0) {
                            this.connectToChat(chatId, cbs[0]);
                        }
                    }
                }, delay);
            }
        };

        this.chatSockets.set(chatId, socket);

        return () => this.removeMessageCallback(chatId, onMessage);
    }

    sendChatMessage(chatId: number, message: any): void {
        const socket = this.chatSockets.get(chatId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'message.send',
                ...message,
            }));
        }
    }

    sendTypingStatus(chatId: number, isTyping: boolean): void {
        const socket = this.chatSockets.get(chatId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'typing',
                is_typing: isTyping,
            }));
        }
    }

    sendReadReceipt(chatId: number, messageId: number): void {
        const socket = this.chatSockets.get(chatId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'message.read',
                message_id: messageId,
            }));
        }
    }

    sendConsumeReceipt(chatId: number, messageId: number): void {
        const socket = this.chatSockets.get(chatId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'message.consume',
                message_id: messageId,
            }));
        }
    }

    sendP2PSignal(chatId: number, signal: any, targetUserId?: number): void {
        const socket = this.chatSockets.get(chatId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'p2p.signal',
                signal,
                target_user_id: targetUserId,
            }));
        }
    }

    onReadReceipt(chatId: number, callback: ReadReceiptCallback): () => void {
        const callbacks = this.readReceiptCallbacks.get(chatId) || [];
        callbacks.push(callback);
        this.readReceiptCallbacks.set(chatId, callbacks);

        return () => {
            const cbs = this.readReceiptCallbacks.get(chatId) || [];
            const index = cbs.indexOf(callback);
            if (index > -1) {
                cbs.splice(index, 1);
            }
            if (cbs.length === 0) {
                this.readReceiptCallbacks.delete(chatId);
            } else {
                this.readReceiptCallbacks.set(chatId, cbs);
            }
        };
    }

    onMessageConsumed(chatId: number, callback: ConsumedCallback): () => void {
        const callbacks = this.consumedCallbacks.get(chatId) || [];
        callbacks.push(callback);
        this.consumedCallbacks.set(chatId, callbacks);

        return () => {
            const cbs = this.consumedCallbacks.get(chatId) || [];
            const index = cbs.indexOf(callback);
            if (index > -1) {
                cbs.splice(index, 1);
            }
            if (cbs.length === 0) {
                this.consumedCallbacks.delete(chatId);
            } else {
                this.consumedCallbacks.set(chatId, cbs);
            }
        };
    }

    onP2PSignal(chatId: number, callback: EventCallback): () => void {
        const callbacks = this.p2pCallbacks.get(chatId) || [];
        callbacks.push(callback);
        this.p2pCallbacks.set(chatId, callbacks);

        return () => {
            const cbs = this.p2pCallbacks.get(chatId) || [];
            const index = cbs.indexOf(callback);
            if (index > -1) {
                cbs.splice(index, 1);
            }
            if (cbs.length === 0) {
                this.p2pCallbacks.delete(chatId);
            } else {
                this.p2pCallbacks.set(chatId, cbs);
            }
        };
    }

    disconnectFromChat(chatId: number): void {
        const socket = this.chatSockets.get(chatId);
        if (socket) {
            socket.close();
            this.chatSockets.delete(chatId);
            this.messageCallbacks.delete(chatId);
        }
    }

    private removeMessageCallback(chatId: number, callback: MessageCallback): void {
        const callbacks = this.messageCallbacks.get(chatId) || [];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }

        if (callbacks.length === 0) {
            this.disconnectFromChat(chatId);
        } else {
            this.messageCallbacks.set(chatId, callbacks);
        }
    }

    // ==================== NOTIFICATIONS WEBSOCKET ====================
    connectToNotifications(onEvent: EventCallback): () => void {
        const wsUrl = `${API_CONFIG.WS_URL}/ws/notify/`;

        this.notifyCallbacks.push(onEvent);

        if (this.notifySocket?.readyState === WebSocket.OPEN) {
            return () => this.removeNotifyCallback(onEvent);
        }

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('Connected to notifications');
            this.reconnectAttempts.delete('notify');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.notifyCallbacks.forEach(cb => cb(data));
            } catch (error) {
                console.error('Error parsing notification:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('Notifications WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('Disconnected from notifications');
            this.notifySocket = null;

            const attempts = this.reconnectAttempts.get('notify') || 0;
            if (attempts < this.maxReconnectAttempts && this.notifyCallbacks.length > 0) {
                this.reconnectAttempts.set('notify', attempts + 1);
                setTimeout(() => {
                    if (this.notifyCallbacks.length > 0) {
                        this.connectToNotifications(onEvent);
                    }
                }, this.reconnectDelay);
            }
        };

        this.notifySocket = socket;

        return () => this.removeNotifyCallback(onEvent);
    }

    disconnectFromNotifications(): void {
        if (this.notifySocket) {
            this.notifySocket.close();
            this.notifySocket = null;
            this.notifyCallbacks = [];
        }
    }

    private removeNotifyCallback(callback: EventCallback): void {
        const index = this.notifyCallbacks.indexOf(callback);
        if (index > -1) {
            this.notifyCallbacks.splice(index, 1);
        }

        if (this.notifyCallbacks.length === 0) {
            this.disconnectFromNotifications();
        }
    }

    // ==================== SIDEBAR/CHAT LIST WEBSOCKET ====================
    connectToSidebar(onEvent: EventCallback): () => void {
        const wsUrl = `${API_CONFIG.WS_URL}/ws/sidebar/`;

        this.sidebarCallbacks.push(onEvent);

        if (this.sidebarSocket?.readyState === WebSocket.OPEN) {
            return () => this.removeSidebarCallback(onEvent);
        }

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('Connected to sidebar');
            this.reconnectAttempts.delete('sidebar');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.sidebarCallbacks.forEach(cb => cb(data));
            } catch (error) {
                console.error('Error parsing sidebar event:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('Sidebar WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('Disconnected from sidebar');
            this.sidebarSocket = null;

            const attempts = this.reconnectAttempts.get('sidebar') || 0;
            if (attempts < this.maxReconnectAttempts && this.sidebarCallbacks.length > 0) {
                this.reconnectAttempts.set('sidebar', attempts + 1);
                setTimeout(() => {
                    if (this.sidebarCallbacks.length > 0) {
                        this.connectToSidebar(onEvent);
                    }
                }, this.reconnectDelay);
            }
        };

        this.sidebarSocket = socket;

        return () => this.removeSidebarCallback(onEvent);
    }

    disconnectFromSidebar(): void {
        if (this.sidebarSocket) {
            this.sidebarSocket.close();
            this.sidebarSocket = null;
            this.sidebarCallbacks = [];
        }
    }

    private removeSidebarCallback(callback: EventCallback): void {
        const index = this.sidebarCallbacks.indexOf(callback);
        if (index > -1) {
            this.sidebarCallbacks.splice(index, 1);
        }

        if (this.sidebarCallbacks.length === 0) {
            this.disconnectFromSidebar();
        }
    }

    // ==================== CALL SIGNALING WEBSOCKET ====================
    connectToCall(chatId: number, onEvent: EventCallback): () => void {
        const wsUrl = `${API_CONFIG.WS_URL}/ws/call/${chatId}/`;

        this.callCallbacks.push(onEvent);

        if (this.callSocket?.readyState === WebSocket.OPEN) {
            return () => this.removeCallCallback(onEvent);
        }

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`Connected to call ${chatId}`);
            this.reconnectAttempts.delete(`call_${chatId}`);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.callCallbacks.forEach(cb => cb(data));
            } catch (error) {
                console.error('Error parsing call event:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('Call WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('Disconnected from call');
            this.callSocket = null;
        };

        this.callSocket = socket;

        return () => this.removeCallCallback(onEvent);
    }

    sendCallSignal(signal: any): void {
        if (this.callSocket && this.callSocket.readyState === WebSocket.OPEN) {
            this.callSocket.send(JSON.stringify(signal));
        }
    }

    disconnectFromCall(): void {
        if (this.callSocket) {
            this.callSocket.close();
            this.callSocket = null;
            this.callCallbacks = [];
        }
    }

    private removeCallCallback(callback: EventCallback): void {
        const index = this.callCallbacks.indexOf(callback);
        if (index > -1) {
            this.callCallbacks.splice(index, 1);
        }

        if (this.callCallbacks.length === 0) {
            this.disconnectFromCall();
        }
    }

    // ==================== CLEANUP ====================
    disconnectAll(): void {
        this.chatSockets.forEach((socket, chatId) => {
            this.disconnectFromChat(chatId);
        });
        this.disconnectFromNotifications();
        this.disconnectFromSidebar();
        this.disconnectFromCall();
    }
}

export default new WebSocketService();
