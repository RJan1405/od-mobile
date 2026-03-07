import { API_CONFIG } from '@/config';
import type { Message } from '@/types';

type MessageCallback = (message: Message) => void;
type EventCallback = (data: any) => void;

class WebSocketService {
    private chatSockets: Map<number, WebSocket> = new Map();
    private notifySocket: WebSocket | null = null;
    private sidebarSocket: WebSocket | null = null;
    private callSocket: WebSocket | null = null;

    private messageCallbacks: Map<number, MessageCallback[]> = new Map();
    private notifyCallbacks: EventCallback[] = [];
    private sidebarCallbacks: EventCallback[] = [];
    private callCallbacks: EventCallback[] = [];

    private reconnectAttempts: Map<string, number> = new Map();
    private maxReconnectAttempts = 5;
    private reconnectDelay = 3000;

    // ==================== CHAT WEBSOCKET ====================
    connectToChat(chatId: number, onMessage: MessageCallback): () => void {
        const wsUrl = `${API_CONFIG.WS_URL}/ws/chat/${chatId}/`;

        // Add callback
        const callbacks = this.messageCallbacks.get(chatId) || [];
        callbacks.push(onMessage);
        this.messageCallbacks.set(chatId, callbacks);

        // If socket already exists and is connected, just return cleanup function
        if (this.chatSockets.has(chatId)) {
            const socket = this.chatSockets.get(chatId)!;
            if (socket.readyState === WebSocket.OPEN) {
                return () => this.removeMessageCallback(chatId, onMessage);
            }
        }

        // Create new socket
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`Connected to chat ${chatId}`);
            this.reconnectAttempts.delete(`chat_${chatId}`);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 WebSocket message received:', data);
                const callbacks = this.messageCallbacks.get(chatId) || [];

                if (data.type === 'message.new') {
                    console.log('✉️ New message:', data.message);
                    callbacks.forEach(cb => cb(data.message));
                } else if (data.type === 'typing.update') {
                    // Handle typing indicator properly, don't pass as a message
                    console.log('Got typing update');
                } else if (data.type === 'message.read') {
                    // Handle read receipt properly, don't pass as a message
                    console.log('Got message read');
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        socket.onerror = (error) => {
            console.error(`Chat ${chatId} WebSocket error:`, error);
        };

        socket.onclose = () => {
            console.log(`Disconnected from chat ${chatId}`);
            this.chatSockets.delete(chatId);

            // Attempt to reconnect
            const attemptKey = `chat_${chatId}`;
            const attempts = this.reconnectAttempts.get(attemptKey) || 0;

            if (attempts < this.maxReconnectAttempts) {
                this.reconnectAttempts.set(attemptKey, attempts + 1);
                setTimeout(() => {
                    if (this.messageCallbacks.has(chatId) && this.messageCallbacks.get(chatId)!.length > 0) {
                        this.connectToChat(chatId, onMessage);
                    }
                }, this.reconnectDelay);
            }
        };

        this.chatSockets.set(chatId, socket);

        // Return cleanup function
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
