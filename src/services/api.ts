import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '@/config';
import type { ApiResponse, User, Chat, Message, Scribe, Omzo, OmzoComment, Story, Notification, PaginatedResponse } from '@/types';

// Helper function to convert relative media URLs to absolute URLs
function convertToAbsoluteUrl(url: string | null | undefined): string {
    if (!url || url === 'null' || url.trim() === '') return '';

    // If already absolute URL (starts with http:// or https://), return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // If relative URL (starts with /), prepend base URL
    if (url.startsWith('/')) {
        const absoluteUrl = `${API_CONFIG.BASE_URL}${url}`;
        console.log('🔄 Converting URL:', url, '→', absoluteUrl);
        return absoluteUrl;
    }

    // Otherwise return as is (might be a data URL or other format)
    return url;
}

// Recursively process object to convert media URLs
function processMediaUrls(obj: any, depth: number = 0): any {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map((item, idx) => {
            console.log(`🔍 Processing array item [${idx}] at depth ${depth}`);
            return processMediaUrls(item, depth + 1);
        });
    }

    if (typeof obj === 'object') {
        const processed: any = {};
        for (const key in obj) {
            // Convert URL fields
            if (key.includes('url') || key.includes('picture') || key === 'image' || key === 'avatar' ||
                key === 'video_file' || key === 'media' || key === 'media_url' || key === 'image_url' || key === 'mediaUrl') {
                const original = obj[key];
                const converted = convertToAbsoluteUrl(obj[key]);
                if (original !== converted) {
                    console.log(`🔄 Field "${key}": ${original} → ${converted}`);
                }
                processed[key] = converted;
            } else {
                processed[key] = processMediaUrls(obj[key], depth + 1);
            }
        }
        return processed;
    }

    return obj;
}

class ApiService {
    private api: AxiosInstance;
    private csrfToken: string | null = null;

    constructor() {
        this.api = axios.create({
            baseURL: API_CONFIG.BASE_URL,
            timeout: API_CONFIG.TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
            },
            withCredentials: true, // Important for session-based auth
        });

        // Add request interceptor for auth token and CSRF
        this.api.interceptors.request.use(
            async (config) => {
                const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
                if (token) {
                    config.headers.Authorization = `Token ${token}`;
                }

                // Add CSRF token for non-GET requests
                if (config.method && config.method.toUpperCase() !== 'GET') {
                    if (!this.csrfToken) {
                        await this.fetchCsrfToken();
                    }
                    if (this.csrfToken) {
                        config.headers['X-CSRFToken'] = this.csrfToken;
                    }
                }

                return config;
            },
            (error) => Promise.reject(error)
        );

        // Add response interceptor for error handling, CSRF token extraction, and media URL processing
        this.api.interceptors.response.use(
            (response) => {
                // Extract CSRF token from response cookies if present
                const setCookie = response.headers['set-cookie'];
                if (setCookie) {
                    const csrfCookie = setCookie.find((cookie: string) => cookie.startsWith('csrftoken='));
                    if (csrfCookie) {
                        const match = csrfCookie.match(/csrftoken=([^;]+)/);
                        if (match) {
                            this.csrfToken = match[1];
                            console.log('🔐 CSRF token extracted:', this.csrfToken);
                        }
                    }
                }

                // Process response data to convert relative media URLs to absolute
                if (response.data) {
                    response.data = processMediaUrls(response.data);
                }

                return response;
            },
            async (error: AxiosError) => {
                if (error.response?.status === 401) {
                    // Unauthorized - clear auth and redirect to login
                    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
                    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
                }
                return Promise.reject(error);
            }
        );
    }

    // Fetch CSRF token from backend
    private async fetchCsrfToken(): Promise<void> {
        try {
            const response = await this.api.get('/api/csrf/');
            if (response.data && response.data.csrfToken) {
                this.csrfToken = response.data.csrfToken;
                console.log('🔐 CSRF token fetched:', this.csrfToken);
            } else {
                // Try to get from cookie header
                const cookie = response.headers['set-cookie'];
                if (cookie) {
                    const csrfMatch = cookie.toString().match(/csrftoken=([^;]+)/);
                    if (csrfMatch) {
                        this.csrfToken = csrfMatch[1];
                        console.log('🔐 CSRF token from cookie:', this.csrfToken);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not fetch CSRF token:', error);
        }
    }

    // ==================== AUTHENTICATION ====================
    async login(username: string, password: string): Promise<ApiResponse<User>> {
        try {
            const response = await this.api.post('/api/login/', { username, password });
            if (response.data.success && response.data.user) {
                await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
            }
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async logout(): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/logout/');
            await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
            await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getProfile(): Promise<ApiResponse<User>> {
        try {
            const response = await this.api.get('/api/profile/');
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateProfile(formData: FormData): Promise<ApiResponse<User>> {
        try {
            const response = await this.api.post('/api/profile/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getUserProfile(username: string): Promise<ApiResponse<User>> {
        try {
            const response = await this.api.get(`/api/profile/${username}/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== CHATS & MESSAGES ====================
    async getChats(): Promise<ApiResponse<Chat[]>> {
        try {
            const response = await this.api.get('/api/chats/');
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createChat(username: string): Promise<ApiResponse<{ chatId: number }>> {
        try {
            const response = await this.api.post('/api/create-chat/', { username });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getChatMessages(chatId: number, page: number = 1): Promise<ApiResponse<PaginatedResponse<Message>>> {
        try {
            const response = await this.api.get(`/api/chat/${chatId}/messages/`, {
                params: { page },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async sendMessage(formData: FormData): Promise<ApiResponse<Message>> {
        try {
            const response = await this.api.post('/api/send-message/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async editMessage(messageId: number, content: string): Promise<ApiResponse> {
        try {
            const response = await this.api.post(`/api/edit-message/${messageId}/`, { content });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async consumeOneTimeMessage(messageId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post(`/api/consume-message/${messageId}/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async markMessagesRead(chatId: number, messageIds?: number[]): Promise<ApiResponse<{ marked_count: number; unread_count: number }>> {
        try {
            const response = await this.api.post('/api/messages/mark-read/', {
                chat_id: chatId,
                message_ids: messageIds,
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async markChatRead(chatId: number): Promise<ApiResponse<{ marked_count: number; unread_count: number }>> {
        try {
            const response = await this.api.post(`/api/chat/${chatId}/mark-read/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getUnreadCounts(): Promise<ApiResponse<{ counts: Record<string, number>; total_unread: number }>> {
        try {
            const response = await this.api.get('/api/unread-counts/');
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async deleteMessageForMe(messageId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post(`/api/delete-message-for-me/${messageId}/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async deleteMessageForEveryone(messageId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post(`/api/delete-message-for-everyone/${messageId}/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== SCRIBES (POSTS) ====================
    async getExploreFeed(page: number = 1): Promise<ApiResponse<PaginatedResponse<Scribe>>> {
        try {
            const response = await this.api.get('/api/explore-feed/', {
                params: { page },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async postScribe(formData: FormData): Promise<ApiResponse<Scribe>> {
        try {
            const response = await this.api.post('/api/post-scribe/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleLike(scribeId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/toggle-like/', { scribe_id: scribeId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleDislike(scribeId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/toggle-dislike/', { scribe_id: scribeId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleSaveScribe(scribeId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/save-scribe/', { scribe_id: scribeId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleSavePost(scribeId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/save-scribe/', { scribe_id: scribeId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleRepostScribe(scribeId: number): Promise<ApiResponse & { is_reposted?: boolean; action?: string }> {
        try {
            const response = await this.api.post('/api/repost/', { type: 'scribe', id: scribeId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleRepostOmzo(omzoId: number): Promise<ApiResponse & { is_reposted?: boolean; action?: string }> {
        try {
            const response = await this.api.post('/api/repost/', { type: 'omzo', id: omzoId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async addComment(scribeId: number, content: string, parentId?: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/add-comment/', {
                scribe_id: scribeId,
                content,
                parent_id: parentId,
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== OMZO (SHORT VIDEOS) ====================
    async getOmzoBatch(cursor?: string): Promise<ApiResponse<{ data: Omzo[]; next_cursor?: string; has_more?: boolean; total_available?: number; batch_size?: number }>> {
        try {
            const response = await this.api.get('/api/omzo/batch/', {
                params: cursor ? { cursor } : {},
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async uploadOmzo(formData: FormData): Promise<ApiResponse<Omzo>> {
        try {
            const response = await this.api.post('/api/omzo/upload/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleOmzoLike(omzoId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/omzo/like/', { omzo_id: omzoId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async trackOmzoView(omzoId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/omzo/track-view/', { omzo_id: omzoId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getOmzoComments(omzoId: number): Promise<ApiResponse<OmzoComment[]>> {
        try {
            const response = await this.api.get(`/api/omzo/${omzoId}/comments/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async addOmzoComment(omzoId: number, content: string): Promise<ApiResponse<OmzoComment>> {
        try {
            const response = await this.api.post('/api/omzo/comment/', {
                omzo_id: omzoId,
                content,
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleOmzoDislike(omzoId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/omzo/dislike/', { omzo_id: omzoId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleSaveOmzo(omzoId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/save-omzo/', { omzo_id: omzoId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getSavedItems(): Promise<ApiResponse<{ scribes: Scribe[]; omzos: Omzo[] }>> {
        try {
            const response = await this.api.get('/api/saved-items/');
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async reportOmzo(omzoId: number, reason: string): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/omzo/report/', {
                omzo_id: omzoId,
                reason,
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== STORIES ====================
    async getFollowingStories(): Promise<ApiResponse<Story[]>> {
        try {
            const response = await this.api.get('/api/following-stories/');
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createStory(formData: FormData): Promise<ApiResponse<Story>> {
        try {
            const response = await this.api.post('/api/create-story/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async markStoryViewed(storyId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/story/mark-viewed/', { story_id: storyId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== SOCIAL GRAPH ====================
    async getFollowStates(usernames: string[]): Promise<ApiResponse<Record<string, { is_following: boolean; is_blocked?: boolean; can_follow?: boolean }>>> {
        try {
            const response = await this.api.post('/api/follow-states/', { usernames });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleFollow(username: string): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/toggle-follow/', { username });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getFollowers(username: string): Promise<ApiResponse<User[]>> {
        try {
            const response = await this.api.get(`/api/profile/${username}/followers/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getFollowing(username: string): Promise<ApiResponse<User[]>> {
        try {
            const response = await this.api.get(`/api/profile/${username}/following/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== GROUPS ====================
    async createGroup(formData: FormData): Promise<ApiResponse<{ group: any }>> {
        try {
            const response = await this.api.post('/api/create-group/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== SEARCH ====================
    async globalSearch(query: string): Promise<ApiResponse> {
        try {
            const response = await this.api.get('/api/global-search/', {
                params: { q: query },
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== NOTIFICATIONS ====================
    async getNotifications(): Promise<ApiResponse<Notification[]>> {
        try {
            const response = await this.api.get('/api/activity/');
            const activities = response.data?.activity_items || [];

            // Transform backend activity format to frontend notification format
            const notifications: Notification[] = activities.map((item: any, index: number) => {
                let notificationType: Notification['notification_type'] = 'like';
                let message = '';

                switch (item.type) {
                    case 'like':
                        notificationType = 'like';
                        message = 'liked your post';
                        break;
                    case 'comment':
                        notificationType = 'comment';
                        message = `commented: "${item.comment_content || ''}"`;
                        break;
                    case 'follow':
                        notificationType = 'follow';
                        message = 'started following you';
                        break;
                    case 'story_like':
                        notificationType = 'like';
                        message = 'liked your story';
                        break;
                    case 'story_reply':
                        notificationType = 'story_reply';
                        message = `replied to your story: "${item.content || ''}"`;
                        break;
                    default:
                        message = item.type;
                }

                return {
                    id: index + 1,
                    user: item.user?.id || 0,
                    sender: item.user ? {
                        id: item.user.id,
                        username: item.user.username,
                        full_name: item.user.full_name || item.user.username,
                        profile_picture_url: item.user.profile_picture_url || '',
                        bio: '',
                        email: '',
                        followers_count: 0,
                        following_count: 0,
                        is_private: false,
                        created_at: new Date().toISOString(),
                    } : undefined,
                    notification_type: notificationType,
                    title: item.user?.username || 'Someone',
                    message,
                    data: {
                        scribe_id: item.scribe?.id,
                        story_id: item.story?.id,
                        omzo_id: item.omzo?.id,
                    },
                    is_read: item.is_read || false,
                    created_at: item.timestamp || new Date().toISOString(),
                };
            });

            return { success: true, data: notifications };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async markNotificationRead(notificationId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post(`/api/notifications/${notificationId}/mark-read/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== SETTINGS ====================
    async updateTheme(theme: string): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/user/update-theme/', { theme });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async toggleAccountPrivacy(): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/toggle-account-privacy/');
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== P2P SIGNALING (WebRTC) ====================
    async sendP2PSignal(chatId: number, targetUserId: string | number, signalData: any): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/p2p/send-signal/', {
                chat_id: chatId,
                target_user_id: targetUserId,
                signal_data: signalData,
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getP2PSignals(chatId: number): Promise<ApiResponse<any[]>> {
        try {
            const response = await this.api.get(`/api/p2p/${chatId}/signals/`);
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async clearP2PSignals(chatId: number): Promise<ApiResponse> {
        try {
            const response = await this.api.post('/api/p2p/clear-signals/', { chat_id: chatId });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // ==================== ERROR HANDLING ====================
    private handleError(error: any): ApiResponse {
        if (axios.isAxiosError(error)) {
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Network error',
            };
        }
        return {
            success: false,
            error: 'An unexpected error occurred',
        };
    }

    buildFullUrl(url: string | null | undefined): string {
        return convertToAbsoluteUrl(url);
    }
}

export default new ApiService();
