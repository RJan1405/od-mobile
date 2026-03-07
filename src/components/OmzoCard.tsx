import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Image,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { Omzo } from '@/types';
import OmzoCommentsSheet from './OmzoCommentsSheet';
import OmzoActionsSheet from './OmzoActionsSheet';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Global mute state shared across all Omzo videos
let globalMuteState = false;

interface OmzoCardProps {
    omzo: Omzo;
    isActive: boolean;
    onSaveToggle?: (omzoId: number, isSaved: boolean) => void;
}

// Format counts like TikTok/Instagram (1.2K, 1.2M)
const formatCount = (count?: number | null): string => {
    if (count === undefined || count === null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
};

export default function OmzoCard({ omzo, isActive, onSaveToggle }: OmzoCardProps) {
    const { colors } = useThemeStore();
    const navigation = useNavigation();
    const { user: currentUser } = useAuthStore();
    const videoRef = useRef<any>(null);
    const [isLiked, setIsLiked] = useState(omzo.is_liked || false);
    const [likeCount, setLikeCount] = useState(omzo.like_count);
    const [commentCount, setCommentCount] = useState(omzo.comment_count);
    const [isSaved, setIsSaved] = useState(omzo.is_saved || false);
    const [shareCount] = useState(45); // Placeholder for share count
    const [isFollowing, setIsFollowing] = useState(false);
    const [paused, setPaused] = useState(!isActive);
    const [isMuted, setIsMuted] = useState(globalMuteState);
    const [showComments, setShowComments] = useState(false);
    const [showActions, setShowActions] = useState(false);

    useEffect(() => {
        setPaused(!isActive);

        if (isActive) {
            // Track view
            api.trackOmzoView(omzo.id);
        }
    }, [isActive, omzo.id]);

    const handleLike = async () => {
        const prevLiked = isLiked;
        const prevCount = likeCount;

        // Optimistic update
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1);

        try {
            const response = await api.toggleOmzoLike(omzo.id);
            if (response.success) {
                setIsLiked((response as any).is_liked);
                setLikeCount((response as any).like_count);
            } else {
                // Rollback
                setIsLiked(prevLiked);
                setLikeCount(prevCount);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            // Rollback
            setIsLiked(prevLiked);
            setLikeCount(prevCount);
        }
    };

    const handleFollow = async () => {
        if (!omzo.user?.username) return;

        const prevFollowing = isFollowing;
        setIsFollowing(!isFollowing);

        try {
            const response = await api.toggleFollow(omzo.user.username);
            if (response.success) {
                setIsFollowing((response as any).is_following);
            } else {
                setIsFollowing(prevFollowing);
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            setIsFollowing(prevFollowing);
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
        setIsSaved(!isSaved);

        try {
            const response = await api.toggleSaveOmzo(omzo.id);
            if (response.success) {
                setIsSaved((response as any).is_saved);
                onSaveToggle?.(omzo.id, (response as any).is_saved);
            } else {
                setIsSaved(prevSaved);
            }
        } catch (error) {
            console.error('Error toggling save:', error);
            setIsSaved(prevSaved);
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

    const handleProfilePress = () => {
        if (!omzo.user?.username) return;
        (navigation as any).navigate('Profile', { username: omzo.user.username });
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
    const avatarUri = omzo.user?.profile_picture_url || omzo.user?.profile_picture || '';
    const hasValidAvatar = avatarUri && avatarUri !== 'null' && avatarUri.length > 0 && avatarUri.startsWith('http');

    // Check for valid video URL
    const videoUri = omzo.video_file || omzo.video_url || '';
    const hasValidVideo = videoUri && videoUri !== 'null' && videoUri.length > 0 && videoUri.startsWith('http');

    // Check if this is the current user's omzo
    const isOwnOmzo = currentUser?.username === omzo.user?.username;

    return (
        <View style={styles.container}>
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
                <TouchableOpacity onPress={handleMoreActions}>
                    <Icon name="ellipsis-vertical" size={24} color="#FFFFFF" />
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
                                        {omzo.user?.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.usernameContainer}>
                            <Text style={styles.username}>
                                @{omzo.user?.username || 'unknown'}
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

                {/* Audio/Music Credit */}
                <View style={styles.audioCredit}>
                    <Icon name="musical-notes" size={14} color="#FFFFFF" />
                    <Text style={styles.audioCreditText} numberOfLines={1}>
                        Original Audio — {omzo.user?.full_name || omzo.user?.username || 'Unknown'}
                    </Text>
                </View>
            </View>

            {/* Right Side Actions */}
            <View style={styles.actionsColumn}>
                {/* Like */}
                <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={32}
                            color={isLiked ? '#FF3B5C' : '#FFFFFF'}
                        />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.actionButton} onPress={handleComments} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="chatbubble-outline" size={30} color="#FFFFFF" />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
                </TouchableOpacity>

                {/* Bookmark */}
                <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={isSaved ? 'bookmark' : 'bookmark-outline'}
                            size={30}
                            color={isSaved ? '#FFD700' : '#FFFFFF'}
                        />
                    </View>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="share-social-outline" size={28} color="#FFFFFF" />
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
        fontSize: 20,
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
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
        height: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 2,
    },

    // User Section - Bottom Left
    userSection: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80,
        left: 16,
        right: 100,
        zIndex: 10,
        gap: 12,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    userInfoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    avatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 6,
        marginLeft: 8,
    },
    followButtonText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '600',
    },
    caption: {
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 20,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        paddingRight: 8,
    },
    audioCredit: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    audioCreditText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        flex: 1,
    },

    // Right Actions
    actionsColumn: {
        position: 'absolute',
        right: 12,
        bottom: Platform.OS === 'ios' ? 120 : 100,
        alignItems: 'center',
        gap: 20,
        zIndex: 10,
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    actionIconContainer: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionCount: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
