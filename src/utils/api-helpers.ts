import { API_CONFIG } from '@/config';

/**
 * Builds a full URL from a relative path
 * @param relativePath - The relative path (e.g., "/media/profile_pics/image.jpg")
 * @returns Full URL or empty string if path is null/empty
 */
export function buildFullUrl(relativePath: string | null | undefined): string {
    if (!relativePath || relativePath === 'null' || typeof relativePath !== 'string' || relativePath.trim() === '') {
        return '';
    }

    // If already a full URL, return as-is
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
        return relativePath;
    }

    // Ensure the path starts with /
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    return `${API_CONFIG.BASE_URL}${path}`;
}

/**
 * Transforms API user data to match the app's User interface
 * Maps 'avatar' field to 'profile_picture_url' and builds full URLs
 */
export function transformUserData(apiUser: any): any {
    if (!apiUser) return apiUser;

    const avatarUrl = buildFullUrl(apiUser.avatar || apiUser.profile_picture_url || apiUser.profile_picture);

    return {
        ...apiUser,
        // Map avatar to profile_picture_url if it exists
        profile_picture_url: avatarUrl,
        // Keep original fields too
        full_name: apiUser.displayName || apiUser.full_name || apiUser.username,
        is_verified: apiUser.isVerified !== undefined ? apiUser.isVerified : apiUser.is_verified,
    };
}

/**
 * Transforms API scribe/feed data to match the app's Scribe interface
 */
export function transformFeedItem(item: any): any {
    if (!item) return item;

    return {
        ...item,
        user: transformUserData(item.user),
        image_url: buildFullUrl(item.mediaUrl || item.image_url),
        like_count: item.likes !== undefined ? item.likes : item.like_count,
        is_liked: item.isLiked !== undefined ? item.isLiked : item.is_liked,
        is_saved: item.isSaved !== undefined ? item.isSaved : item.is_saved,
        is_disliked: item.isDisliked !== undefined ? item.isDisliked : item.is_disliked,
        timestamp: item.createdAt || item.timestamp,
    };
}

/**
 * Transforms API omzo data to match the app's Omzo interface
 */
export function transformOmzoData(omzo: any): any {
    if (!omzo) return omzo;

    // Backend returns username and user_avatar separately, need to create user object
    const user = omzo.user || {
        id: omzo.user_id || 0,
        username: omzo.username || 'unknown',
        profile_picture_url: buildFullUrl(omzo.user_avatar),
        full_name: omzo.username || 'unknown',
    };

    return {
        id: omzo.id,
        user: transformUserData(user),
        video_file: buildFullUrl(omzo.url || omzo.video_file || omzo.videoUrl),
        caption: omzo.caption || '',
        created_at: omzo.created_at || omzo.createdAt || new Date().toISOString(),
        views_count: omzo.views !== undefined ? omzo.views : (omzo.views_count || 0),
        like_count: omzo.likes !== undefined ? omzo.likes : (omzo.like_count || 0),
        dislike_count: omzo.dislikes !== undefined ? omzo.dislikes : (omzo.dislike_count || 0),
        comment_count: omzo.comments_count !== undefined ? omzo.comments_count : (omzo.comment_count || 0),
        is_liked: omzo.is_liked || false,
        is_disliked: omzo.is_disliked || false,
        is_muted: omzo.is_muted || false,
        is_saved: omzo.is_saved || false,
        is_following: omzo.is_following !== undefined ? omzo.is_following : (omzo.user?.isFollowing || false),
    };
}
