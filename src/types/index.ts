export interface User {
    id: number;
    username: string;
    email: string;
    name: string;
    lastname: string;
    full_name: string;
    profile_picture: string;
    profile_picture_url: string;
    avatar?: string;
    bio?: string;
    is_verified: boolean;
    is_private: boolean;
    is_online: boolean;
    last_seen: string;
    theme: string;
    gender: string;
    follower_count: number;
    following_count: number;
    post_count?: number;
    is_following?: boolean;
}

export interface Message {
    id: number;
    chat: number;
    sender: User;
    content: string;
    message_type: 'text' | 'system' | 'media';
    media_url?: string;
    media_type?: 'image' | 'video' | 'document';
    media_filename?: string;
    timestamp: string;
    is_read: boolean;
    one_time: boolean;
    consumed_at?: string;
    is_edited: boolean;
    edited_at?: string;
    reply_to?: Message;
    shared_scribe?: Scribe;
    shared_omzo?: Omzo;
    story_reply?: Story;
}

export interface Chat {
    id: number;
    chat_type: 'private' | 'group';
    name?: string;
    description?: string;
    group_avatar?: string;
    participants: User[];
    admin?: User;
    last_message?: Message;
    unread_count: number;
    invite_code?: string;
    is_public: boolean;
    created_at: string;
    updated_at: string;
}

export interface Scribe {
    id: number;
    user: User;
    content: string;
    timestamp?: string;
    createdAt?: string;
    image?: string;
    image_url?: string;
    media_url?: string;  // API returns this field for scribe images
    mediaUrl?: string;
    content_type: string;
    type?: string;
    code_html?: string;
    code_css?: string;
    code_js?: string;
    like_count: number;
    dislike_count?: number;
    comment_count: number;
    repost_count?: number;
    is_liked?: boolean;
    is_disliked?: boolean;
    is_saved?: boolean;
    is_reposted?: boolean;
    is_repost?: boolean;
    is_following?: boolean;
    original_scribe?: Scribe;
    original_omzo?: Omzo;
    quote_source?: Scribe;
    original_type?: 'scribe' | 'omzo' | 'story' | 'quote';
    original_data?: any;
}

export interface Comment {
    id: number;
    scribe: number;
    user: User;
    content: string;
    timestamp: string;
    parent?: number;
    reply_count: number;
    like_count: number;
}

export interface OmzoComment {
    id: number;
    omzo: number;
    user: User;
    content: string;
    timestamp: string;
    created_at: string;
    like_count: number;
    is_liked?: boolean;
}

export interface Story {
    id: number;
    user: User;
    content?: string;
    media_file?: string;
    media_url?: string;
    story_type: 'image' | 'video' | 'text';
    background_color: string;
    text_color: string;
    text_position: 'top' | 'center' | 'bottom';
    text_size: number;
    created_at: string;
    expires_at: string;
    is_active: boolean;
    view_count: number;
    image_transform?: {
        scale?: number;
        x?: number;
        y?: number;
        rotation?: number;
    };
}

export interface Omzo {
    id: number;
    user?: User;
    user_id?: number;
    username?: string;
    user_avatar?: string;
    video_file: string;
    video_url?: string;
    url?: string;
    thumbnail_url?: string;
    caption: string;
    created_at: string;
    createdAt?: string;
    views_count: number;
    views?: number;
    like_count: number;
    likes?: number;
    dislike_count?: number;
    dislikes?: number;
    comment_count: number;
    comments_count?: number;
    comments?: number;
    is_liked?: boolean;
    is_disliked?: boolean;
    is_saved?: boolean;
    is_muted?: boolean;
    is_following?: boolean;
    is_reposted?: boolean;
    reposts?: number;
}

export interface Notification {
    id: number;
    user: number;
    sender?: User;
    notification_type: 'message' | 'call' | 'missed_call' | 'follow' | 'like' | 'comment' | 'mention' | 'story_view' | 'story_reply';
    title: string;
    message: string;
    data: Record<string, any>;
    is_read: boolean;
    created_at: string;
}

export interface FollowRequest {
    id: number;
    follower: User;
    following: User;
    created_at: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    user?: T;  // For login endpoint which returns 'user' instead of 'data'
    error?: string;
    message?: string;
    scribes?: Scribe[];  // For profile endpoints that return scribes
    omzos?: Omzo[];  // For profile endpoints that return omzos
    reposts?: Scribe[];  // For profile endpoints that return reposts
    is_saved?: boolean;
    is_liked?: boolean;
    is_following?: boolean;
    followers?: User[];
    following?: User[];
}

export interface PaginatedResponse<T> {
    results: T[];
    count: number;
    next?: string;
    previous?: string;
}
