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
import api from '@/services/api';
import type { Scribe } from '@/types';

interface ScribeCardProps {
    scribe: Scribe;
    onSaveToggle?: (scribeId: number, isSaved: boolean) => void;
}

// Format counts like web version (1K, 1M)
const formatCount = (count?: number | null): string => {
    if (count === undefined || count === null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
};

export default function ScribeCard({ scribe, onSaveToggle }: ScribeCardProps) {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const [isLiked, setIsLiked] = useState(scribe.is_liked || false);
    const [isDisliked, setIsDisliked] = useState(scribe.is_disliked || false);
    const [isSaved, setIsSaved] = useState(scribe.is_saved || false);
    const [likeCount, setLikeCount] = useState(scribe.like_count);
    const [dislikeCount, setDislikeCount] = useState(scribe.dislike_count || 0);
    const [repostCount, setRepostCount] = useState(scribe.repost_count || 0);

    const handleLike = async () => {
        const prevLiked = isLiked;
        const prevCount = likeCount;
        const prevDisliked = isDisliked;
        const prevDislikedCount = dislikeCount;

        // Optimistic update
        if (isLiked) {
            setIsLiked(false);
            setLikeCount(prev => Math.max(0, prev - 1));
        } else {
            setIsLiked(true);
            setLikeCount(prev => prev + 1);
            if (isDisliked) {
                setIsDisliked(false);
                setDislikeCount(prev => Math.max(0, prev - 1));
            }
        }

        try {
            const response = await api.toggleLike(scribe.id);
            if (response.success) {
                setIsLiked(response.is_liked);
                setLikeCount(response.like_count);
            } else {
                // Rollback
                setIsLiked(prevLiked);
                setLikeCount(prevCount);
                setIsDisliked(prevDisliked);
                setDislikeCount(prevDislikedCount);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            // Rollback
            setIsLiked(prevLiked);
            setLikeCount(prevCount);
            setIsDisliked(prevDisliked);
            setDislikeCount(prevDislikedCount);
        }
    };

    const handleDislike = async () => {
        const prevDisliked = isDisliked;
        const prevCount = dislikeCount;
        const prevLiked = isLiked;
        const prevLikedCount = likeCount;

        // Optimistic update
        if (isDisliked) {
            setIsDisliked(false);
            setDislikeCount(prev => Math.max(0, prev - 1));
        } else {
            setIsDisliked(true);
            setDislikeCount(prev => prev + 1);
            if (isLiked) {
                setIsLiked(false);
                setLikeCount(prev => Math.max(0, prev - 1));
            }
        }

        try {
            const response = await api.toggleDislike(scribe.id);
            if (response.success) {
                setIsDisliked(response.is_disliked);
            } else {
                // Rollback
                setIsDisliked(prevDisliked);
                setDislikeCount(prevCount);
                setIsLiked(prevLiked);
                setLikeCount(prevLikedCount);
            }
        } catch (error) {
            console.error('Error toggling dislike:', error);
            // Rollback
            setIsDisliked(prevDisliked);
            setDislikeCount(prevCount);
            setIsLiked(prevLiked);
            setLikeCount(prevLikedCount);
        }
    };

    const handleSave = async () => {
        const prevSaved = isSaved;
        setIsSaved(!isSaved);

        try {
            const response = await api.toggleSaveScribe(scribe.id);
            if (response.success) {
                setIsSaved(response.is_saved);
                onSaveToggle?.(scribe.id, response.is_saved);
            } else {
                setIsSaved(prevSaved);
            }
        } catch (error) {
            console.error('Error toggling save:', error);
            setIsSaved(prevSaved);
        }
    };

    const handleProfilePress = () => {
        if (!scribe.user?.username) return;
        navigation.navigate('Profile' as never, { username: scribe.user.username } as never);
    };

    const avatarUri = scribe.user?.profile_picture_url || scribe.user?.avatar || '';
    const imageUri = scribe.media_url || scribe.image_url || scribe.mediaUrl || '';

    // Debug logging
    if (imageUri) {
        console.log('📸 ScribeCard imageUri:', imageUri);
        console.log('📸 Full scribe data:', JSON.stringify(scribe, null, 2));
    }

    // Only use avatar if it's a valid URL (not empty or 'null')
    const hasValidAvatar = avatarUri && avatarUri !== 'null' && avatarUri.length > 0 && avatarUri.startsWith('http');
    const hasValidImage = imageUri && imageUri !== 'null' && imageUri.trim().length > 0 && imageUri.startsWith('http');

    console.log('📸 hasValidImage:', hasValidImage, 'imageUri:', imageUri);

    return (
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.userInfo} onPress={handleProfilePress}>
                    {hasValidAvatar ? (
                        <Image
                            source={{ uri: avatarUri }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                                {scribe.user?.username?.[0]?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                    <View>
                        <View style={styles.nameRow}>
                            <Text style={[styles.username, { color: colors.text }]}>
                                {scribe.user?.full_name || scribe.user?.username || 'Unknown'}
                            </Text>
                            {scribe.user?.is_verified && (
                                <Icon name="checkmark-circle" size={14} color={colors.primary} />
                            )}
                        </View>
                        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                            @{scribe.user?.username || 'unknown'} · {scribe.timestamp || scribe.createdAt ? formatDistanceToNow(new Date(scribe.timestamp || scribe.createdAt), { addSuffix: false }) : 'Just now'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity>
                    <Icon name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {scribe.content && (
                <Text style={[styles.content, { color: colors.text }]}>
                    {scribe.content}
                </Text>
            )}

            {hasValidImage ? (
                <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="cover"
                />
            ) : null}

            <View style={[styles.actions, { borderTopColor: `${colors.border}80` }]}>
                <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                    <Icon
                        name={isLiked ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isLiked ? '#EF4444' : colors.textSecondary}
                    />
                    <Text style={[styles.actionText, { color: isLiked ? '#EF4444' : colors.textSecondary }]}>
                        {formatCount(likeCount)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleDislike}>
                    <Icon
                        name={isDisliked ? 'thumbs-down' : 'thumbs-down-outline'}
                        size={20}
                        color={isDisliked ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.actionText, { color: isDisliked ? colors.primary : colors.textSecondary }]}>
                        {formatCount(dislikeCount)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                    <Icon name="chatbubble-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                        {formatCount(scribe.comment_count || 0)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                    <Icon name="repeat-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                        {formatCount(repostCount)}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                    <Icon name="share-social-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
                    <Icon
                        name={isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={20}
                        color={isSaved ? '#FBBF24' : colors.textSecondary}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    username: {
        fontSize: 15,
        fontWeight: '600',
    },
    timestamp: {
        fontSize: 12,
        marginTop: 2,
    },
    content: {
        fontSize: 16,
        lineHeight: 22,
        marginBottom: 12,
    },
    image: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: 12,
        marginTop: 4,
        borderTopWidth: 1,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 4,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
