import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { Scribe } from '@/types';

interface ScribeCardProps {
    scribe: Scribe;
    onSaveToggle?: (scribeId: number, isSaved: boolean) => void;
    onPress?: () => void;
}

// Format counts (1K, 1M)
const formatCount = (count?: number | null): string => {
    if (count === undefined || count === null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
};

// Format relative time like "2h ago"
const formatRelativeTime = (timestamp?: string | null): string => {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return formatDistanceToNow(date, { addSuffix: false });
    } catch {
        return '';
    }
};

// Parse content and highlight hashtags/mentions
function renderContent(content: string, textColor: string) {
    const parts = content.split(/(#\w+|@\w+)/g);
    return (
        <Text style={[styles.content, { color: textColor }]}>
            {parts.map((part, idx) => {
                if (part.startsWith('#') || part.startsWith('@')) {
                    return (
                        <Text key={idx} style={styles.hashtag}>
                            {part}
                        </Text>
                    );
                }
                return <Text key={idx}>{part}</Text>;
            })}
        </Text>
    );
}

export default function ScribeCard({ scribe, onSaveToggle, onPress }: ScribeCardProps) {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user: currentUser } = useAuthStore();
    const [isLiked, setIsLiked] = useState(scribe.is_liked || false);
    const [isSaved, setIsSaved] = useState(scribe.is_saved || false);
    const [isFollowing, setIsFollowing] = useState((scribe.user as any)?.is_following || (scribe.user as any)?.isFollowing || false);
    const [likeCount, setLikeCount] = useState(scribe.like_count || 0);
    const [repostCount, setRepostCount] = useState(scribe.repost_count || 0);

    const isOwnScribe = currentUser?.username === scribe.user?.username;

    const handleLike = async () => {
        const prev = isLiked;
        const prevCount = likeCount;
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);
        try {
            const response = await api.toggleLike(scribe.id);
            if (response.success) {
                setIsLiked((response as any).is_liked);
                setLikeCount((response as any).like_count);
            } else {
                setIsLiked(prev);
                setLikeCount(prevCount);
            }
        } catch {
            setIsLiked(prev);
            setLikeCount(prevCount);
        }
    };

    const handleSave = async () => {
        const prev = isSaved;
        setIsSaved(!isSaved);
        try {
            const response = await api.toggleSaveScribe(scribe.id);
            if (response.success) {
                setIsSaved((response as any).is_saved);
                onSaveToggle?.(scribe.id, (response as any).is_saved);
            } else {
                setIsSaved(prev);
            }
        } catch {
            setIsSaved(prev);
        }
    };

    const handleFollow = async () => {
        if (!scribe.user?.username) return;
        const prev = isFollowing;
        setIsFollowing(!isFollowing);
        try {
            const response = await api.toggleFollow(scribe.user.username);
            if (response.success) {
                setIsFollowing((response as any).is_following ?? !prev);
            } else {
                setIsFollowing(prev);
            }
        } catch {
            setIsFollowing(prev);
        }
    };

    const handleProfilePress = () => {
        if (!scribe.user?.username) return;
        navigation.navigate('Profile' as never, { username: scribe.user.username } as never);
    };

    const avatarUri = scribe.user?.profile_picture_url || (scribe.user as any)?.avatar || '';
    const imageUri = scribe.media_url || scribe.image_url || (scribe as any).mediaUrl || '';
    const hasValidAvatar = avatarUri && avatarUri !== 'null' && avatarUri.startsWith('http');
    const hasValidImage = imageUri && imageUri !== 'null' && imageUri.trim().length > 0 && imageUri.startsWith('http');

    const createdAt = scribe.timestamp || (scribe as any).createdAt || (scribe as any).created_at;
    const relativeTime = formatRelativeTime(createdAt);

    return (
        <View style={styles.card}>
            {/* Tappable area: header + content + image */}
            <TouchableOpacity
                activeOpacity={onPress ? 0.75 : 1}
                onPress={onPress}
                disabled={!onPress}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.avatarWrap} onPress={handleProfilePress} activeOpacity={0.85}>
                        {hasValidAvatar ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                                <Text style={styles.avatarLetter}>
                                    {scribe.user?.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.headerMid}>
                        <View style={styles.nameRow}>
                            <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.85}>
                                <Text style={styles.displayName}>
                                    {scribe.user?.full_name || scribe.user?.username || 'Unknown'}
                                </Text>
                            </TouchableOpacity>
                            {scribe.user?.is_verified && (
                                <Icon name="checkmark-circle" size={14} color="#3B82F6" style={{ marginLeft: 3 }} />
                            )}
                            {relativeTime ? (
                                <Text style={styles.dotSep}>·</Text>
                            ) : null}
                            {relativeTime ? (
                                <Text style={styles.timestamp}>{relativeTime}</Text>
                            ) : null}
                        </View>
                        <Text style={styles.handle}>@{scribe.user?.username || 'unknown'}</Text>
                    </View>

                    {!isOwnScribe && (
                        <TouchableOpacity
                            style={[styles.followPill, isFollowing && styles.followPillActive]}
                            onPress={handleFollow}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.followPillText, isFollowing && styles.followPillTextActive]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Icon name="ellipsis-horizontal" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {scribe.content ? renderContent(scribe.content, '#111827') : null}

                {/* Image */}
                {hasValidImage && (
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                )}
            </TouchableOpacity>

            {/* Action Bar */}
            <View style={styles.actions}>
                {/* Like */}
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
                    <Icon
                        name={isLiked ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isLiked ? '#EF4444' : '#9CA3AF'}
                    />
                    <Text style={[styles.actionCount, isLiked && { color: '#EF4444' }]}>
                        {formatCount(likeCount)}
                    </Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                    <Icon name="chatbubble-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.actionCount}>
                        {formatCount(scribe.comment_count || 0)}
                    </Text>
                </TouchableOpacity>

                {/* Repost */}
                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                    <Icon name="repeat-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.actionCount}>{formatCount(repostCount)}</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                {/* Bookmark */}
                <TouchableOpacity style={styles.actionIconBtn} onPress={handleSave} activeOpacity={0.7}>
                    <Icon
                        name={isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={20}
                        color={isSaved ? '#3B82F6' : '#9CA3AF'}
                    />
                </TouchableOpacity>

                {/* Share / Send */}
                <TouchableOpacity style={styles.actionIconBtn} activeOpacity={0.7}>
                    <Icon name="paper-plane-outline" size={20} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginHorizontal: 12,
        marginBottom: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
        gap: 10,
    },
    avatarWrap: {},
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 10,
    },
    avatarFallback: {
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    headerMid: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
    },
    displayName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    followPill: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#3B82F6',
        marginLeft: 2,
        marginRight: 6,
    },
    followPillActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    followPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#3B82F6',
    },
    followPillTextActive: {
        color: '#FFFFFF',
    },
    dotSep: {
        color: '#9CA3AF',
        fontSize: 13,
    },
    timestamp: {
        color: '#9CA3AF',
        fontSize: 13,
    },
    handle: {
        color: '#9CA3AF',
        fontSize: 13,
        marginTop: 2,
    },
    moreBtn: {
        paddingTop: 2,
    },
    content: {
        fontSize: 15,
        lineHeight: 22,
        color: '#111827',
        marginBottom: 12,
    },
    hashtag: {
        color: '#3B82F6',
        fontWeight: '500',
    },
    image: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 6,
        marginRight: 4,
    },
    actionCount: {
        fontSize: 14,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    actionIconBtn: {
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
});
