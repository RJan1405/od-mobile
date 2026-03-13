import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Image,
    Platform,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { Omzo } from '@/types';
import { useFollowStore } from '@/stores/followStore';
import { useInteractionStore } from '@/stores/interactionStore';
import OmzoCommentsSheet from './OmzoCommentsSheet';
import OmzoActionsSheet from './OmzoActionsSheet';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Global mute state shared across all Omzo videos
let globalMuteState = false;

interface OmzoCardProps {
    omzo: Omzo;
    isActive: boolean;
    containerHeight?: number;
    onSaveToggle?: (omzoId: number, isSaved: boolean) => void;
    onLikeToggle?: (omzoId: number, isLiked: boolean, likeCount: number) => void;
}

// Format counts like TikTok/Instagram (1.2K, 1.2M)
const formatCount = (count?: number | null): string => {
    if (count === undefined || count === null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
};

export default function OmzoCard({ omzo, isActive, containerHeight, onSaveToggle, onLikeToggle }: OmzoCardProps) {
    const { colors } = useThemeStore();
    const navigation = useNavigation();
    const { user: currentUser } = useAuthStore();
    const videoRef = useRef<any>(null);
    const [commentCount, setCommentCount] = useState(omzo.comment_count);
    const [shareCount] = useState(45); // Placeholder for share count
    const [paused, setPaused] = useState(!isActive);
    const [isMuted, setIsMuted] = useState(globalMuteState);
    const [showComments, setShowComments] = useState(false);
    const [showActions, setShowActions] = useState(false);

    // Global stores
    const { interactions, setInteraction } = useInteractionStore();
    const interactionKey = `omzo_${omzo.id}`;
    const interaction = interactions[interactionKey] || {
        is_liked: omzo.is_liked || false,
        like_count: omzo.like_count || 0,
        is_saved: omzo.is_saved || false,
        is_reposted: omzo.is_reposted || false,
        repost_count: omzo.reposts || 0
    };

    const isLiked = !!interaction.is_liked;
    const likeCount = interaction.like_count || 0;
    const isSaved = !!interaction.is_saved;
    const isReposted = !!interaction.is_reposted;
    const repostCount = interaction.repost_count || 0;

    const { followStates, setFollowState } = useFollowStore();
    const username = omzo.user?.username || omzo.username || '';
    const followStoreValue = followStates[username];
    const isFollowing = followStoreValue !== undefined ? followStoreValue : (omzo.is_following || false);

    // Seed stores
    useEffect(() => {
        if (followStoreValue === undefined && username) {
            setFollowState(username, omzo.is_following || false);
        }
    }, [username, followStoreValue, omzo.is_following]);

    useEffect(() => {
        if (interactions[interactionKey] === undefined && omzo.id) {
            setInteraction('omzo', omzo.id, {
                is_liked: omzo.is_liked || false,
                like_count: omzo.like_count || 0,
                is_saved: omzo.is_saved || false,
                is_reposted: omzo.is_reposted || false,
                repost_count: omzo.reposts || 0
            });
        }
    }, [omzo.id, interactions[interactionKey]]);

    // Sync state with prop changes (for cross-screen updates if store is empty)
    useEffect(() => {
        setCommentCount(omzo.comment_count);
    }, [omzo.comment_count]);

    useEffect(() => {
        setPaused(!isActive);

        if (isActive) {
            // Track view
            api.trackOmzoView(omzo.id);
        }
    }, [isActive, omzo.id]);

    const handleLike = async () => {
        const prevInteraction = interaction;

        // Optimistic update
        const newIsLiked = !isLiked;
        const newLikeCount = isLiked ? Math.max(0, likeCount - 1) : likeCount + 1;

        setInteraction('omzo', omzo.id, {
            is_liked: newIsLiked,
            like_count: newLikeCount
        });

        try {
            const response = await api.toggleOmzoLike(omzo.id);
            if (response.success) {
                setInteraction('omzo', omzo.id, {
                    is_liked: (response as any).is_liked,
                    like_count: (response as any).like_count,
                    is_disliked: (response as any).is_disliked,
                    dislike_count: (response as any).dislike_count
                });
                onLikeToggle?.(omzo.id, (response as any).is_liked, (response as any).like_count);
            } else {
                setInteraction('omzo', omzo.id, prevInteraction);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            setInteraction('omzo', omzo.id, prevInteraction);
        }
    };

    const handleFollow = async () => {
        if (!username) return;

        const prevFollowing = isFollowing;
        const newFollowing = !isFollowing;

        setFollowState(username, newFollowing);

        try {
            const response = await api.toggleFollow(username);
            if (response.success) {
                const nowFollowing = (response as any).is_following ?? newFollowing;
                setFollowState(username, nowFollowing);
            } else {
                setFollowState(username, prevFollowing);
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            setFollowState(username, prevFollowing);
        }
    };

    const togglePlayPause = () => {
        setPaused(!paused);
    };

    const toggleMute = () => {
        const newMuteState = !isMuted;
        setIsMuted(newMuteState);
        globalMuteState = newMuteState; // Save preference globally
    };

    const handleComments = () => {
        setPaused(true);
        setShowComments(true);
    };

    const handleMoreActions = () => {
        setPaused(true);
        setShowActions(true);
    };

    const handleToggleSave = async () => {
        const prevSaved = isSaved;

        // Optimistic update
        setInteraction('omzo', omzo.id, { is_saved: !isSaved });

        try {
            const response = await api.toggleSaveOmzo(omzo.id);
            if (response.success) {
                setInteraction('omzo', omzo.id, { is_saved: (response as any).is_saved });
                onSaveToggle?.(omzo.id, (response as any).is_saved);
            } else {
                setInteraction('omzo', omzo.id, { is_saved: prevSaved });
            }
        } catch (error) {
            console.error('Error toggling save:', error);
            setInteraction('omzo', omzo.id, { is_saved: prevSaved });
        }
    };

    const handleShare = () => {
        setPaused(true);
        // TODO: Implement share functionality
        console.log('Share omzo:', omzo.id);
        if (isActive) {
            setPaused(false);
        }
    };

    const handleRepost = async () => {
        const prevInteraction = interaction;

        // Optimistic update
        const newReposted = !isReposted;
        const newCount = isReposted ? Math.max(0, repostCount - 1) : repostCount + 1;

        setInteraction('omzo', omzo.id, {
            is_reposted: newReposted,
            repost_count: newCount
        });

        try {
            const response = await api.toggleRepostOmzo(omzo.id);
            if (response.success) {
                const actualReposted = response.is_reposted ?? newReposted;
                setInteraction('omzo', omzo.id, {
                    is_reposted: actualReposted
                });
                const msg = response.action === 'removed'
                    ? 'Repost removed from your profile'
                    : 'Reposted to your profile';
                Alert.alert('', msg, [{ text: 'OK' }]);
            } else {
                setInteraction('omzo', omzo.id, prevInteraction);
                Alert.alert('Error', response.error || 'Failed to repost');
            }
        } catch (err: any) {
            setInteraction('omzo', omzo.id, prevInteraction);
            Alert.alert('Error', err?.message || 'Failed to repost');
        }
    };

    const handleProfilePress = () => {
        const username = omzo.user?.username || omzo.username;
        if (!username) return;
        (navigation as any).navigate('Profile', { username });
    };

    const handleCloseComments = () => {
        setShowComments(false);
        if (isActive) {
            setPaused(false);
        }
    };

    const handleCloseActions = () => {
        setShowActions(false);
        if (isActive) {
            setPaused(false);
        }
    };

    // Check for valid avatar URL
    const avatarUri = omzo.user?.profile_picture_url || omzo.user_avatar || '';
    const hasValidAvatar = avatarUri && avatarUri !== 'null' && avatarUri.length > 0 && avatarUri.startsWith('http');

    // Check for valid video URL
    const videoUri = omzo.video_file || omzo.video_url || omzo.url || '';
    const hasValidVideo = videoUri && videoUri !== 'null' && videoUri.length > 0 && videoUri.startsWith('http');

    // Check if this is the current user's omzo
    const isOwnOmzo = currentUser?.username === (omzo.user?.username || omzo.username);

    return (
        <View style={[styles.container, containerHeight ? { height: containerHeight } : undefined]}>
            {/* Video Background */}
            {hasValidVideo ? (
                <Video
                    ref={videoRef}
                    source={{ uri: videoUri }}
                    style={styles.video}
                    paused={paused}
                    repeat={true}
                    resizeMode="cover"
                    muted={isMuted}
                    ignoreSilentSwitch="ignore"
                    mixWithOthers="mix"
                    playInBackground={false}
                    playWhenInactive={false}
                    onError={(error) => {
                        console.log('Video error:', error.error?.errorString || 'Unknown error');
                    }}
                />
            ) : (
                <View style={[styles.video, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                    <Icon name="videocam-outline" size={64} color="#666" />
                    <Text style={{ color: '#999', fontSize: 16, marginTop: 12 }}>No video available</Text>
                </View>
            )}

            {/* Tap to Pause/Play */}
            <TouchableOpacity
                style={styles.tapArea}
                activeOpacity={1}
                onPress={togglePlayPause}
            />

            {/* Top Controls - Title and Options */}
            <View style={styles.topBar}>
                <Text style={styles.topTitle}>Omzo</Text>
                <TouchableOpacity style={styles.menuCircle} onPress={handleMoreActions}>
                    <Icon name="ellipsis-vertical" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Mute/Unmute Button */}
            <TouchableOpacity
                style={styles.muteButton}
                onPress={toggleMute}
            >
                <Icon
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={28}
                    color="#FFFFFF"
                />
            </TouchableOpacity>

            {/* Play/Pause Icon Overlay */}
            {paused && (
                <View style={styles.playIconContainer} pointerEvents="none">
                    <Icon name="play-circle" size={80} color="rgba(255, 255, 255, 0.9)" />
                </View>
            )}

            {/* Bottom shadow overlay for better text readability */}
            <View style={styles.bottomShadow} pointerEvents="none" />

            {/* User Info Section - Bottom Left */}
            <View style={styles.userSection} pointerEvents="box-none">
                <View style={styles.userRow}>
                    <TouchableOpacity
                        style={styles.userInfoLeft}
                        onPress={handleProfilePress}
                        activeOpacity={0.7}
                    >
                        <View style={styles.avatarContainer}>
                            {hasValidAvatar ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarText}>
                                        {(omzo.user?.username || omzo.username || '?')[0]?.toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.usernameContainer}>
                            <Text style={styles.username}>
                                @{omzo.user?.username || omzo.username || 'unknown'}
                            </Text>
                            {omzo.user?.is_verified && (
                                <Icon name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                            )}
                        </View>
                    </TouchableOpacity>

                    {!isOwnOmzo && (
                        <TouchableOpacity
                            style={styles.followButton}
                            onPress={handleFollow}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.followButtonText}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Caption */}
                {omzo.caption && omzo.caption.trim() !== '' && (
                    <Text style={styles.caption} numberOfLines={2}>
                        {omzo.caption}
                    </Text>
                )}
            </View>

            {/* Right Side Actions */}
            <View style={styles.actionsColumn}>
                {/* Like */}
                <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={26}
                            color={isLiked ? '#FF3B5C' : '#FFFFFF'}
                        />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.actionButton} onPress={handleComments} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="chatbubble-outline" size={26} color="#FFFFFF" />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
                </TouchableOpacity>

                {/* Bookmark */}
                <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={isSaved ? 'bookmark' : 'bookmark-outline'}
                            size={24}
                            color={isSaved ? '#FFFFFF' : '#FFFFFF'}
                        />
                    </View>
                </TouchableOpacity>

                {/* Repost */}
                <TouchableOpacity style={styles.actionButton} onPress={handleRepost} activeOpacity={0.7}>
                    <View style={[
                        styles.actionIconContainer,
                        isReposted && { backgroundColor: 'rgba(16,185,129,0.35)', borderColor: 'rgba(16,185,129,0.5)' }
                    ]}>
                        <Icon
                            name={isReposted ? 'repeat' : 'repeat-outline'}
                            size={24}
                            color={isReposted ? '#10B981' : '#FFFFFF'}
                        />
                    </View>
                    <Text style={[styles.actionCount, isReposted && { color: '#10B981' }]}>
                        {formatCount(repostCount)}
                    </Text>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="paper-plane-outline" size={24} color="#FFFFFF" style={{ marginLeft: -2, marginTop: 2 }} />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(shareCount)}</Text>
                </TouchableOpacity>
            </View>

            {/* Comments Sheet */}
            <OmzoCommentsSheet
                isVisible={showComments}
                onClose={handleCloseComments}
                omzoId={omzo.id}
                initialCommentCount={commentCount}
                onCommentAdded={() => setCommentCount(prev => prev + 1)}
            />

            {/* Actions Sheet */}
            <OmzoActionsSheet
                isVisible={showActions}
                onClose={handleCloseActions}
                omzo={omzo}
                isSaved={isSaved}
                onToggleSave={handleToggleSave}
                isReposted={isReposted}
                onToggleRepost={handleRepost}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: '#000000',
        position: 'relative',
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        backgroundColor: '#000000',
    },
    tapArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 100, // Exclude right actions area
        bottom: 200, // Exclude bottom user info
        zIndex: 1,
    },

    // Top Bar
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    topTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    menuCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Mute Button
    muteButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 70,
        right: 16,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Play Icon
    playIconContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3,
    },

    // Bottom shadow for text readability
    bottomShadow: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 2,
    },

    // User Section - Bottom Left
    userSection: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 90 : 20,
        left: 16,
        right: 80,
        zIndex: 10,
        gap: 8,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 12,
    },
    userInfoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    avatarImage: {
        width: 36,
        height: 36,
        borderRadius: 8,
    },
    avatarPlaceholder: {
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    usernameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    username: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    followButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        marginLeft: 4,
    },
    followButtonText: {
        color: '#000000',
        fontSize: 13,
        fontWeight: 'bold',
    },
    caption: {
        color: '#FFFFFF',
        fontSize: 14,
        lineHeight: 20,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        paddingRight: 8,
        marginTop: 4,
    },

    // Right Actions
    actionsColumn: {
        position: 'absolute',
        right: 12,
        bottom: Platform.OS === 'ios' ? 100 : 30,
        alignItems: 'center',
        gap: 16,
        zIndex: 10,
    },
    actionButton: {
        alignItems: 'center',
        gap: 6,
    },
    actionIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionCount: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
