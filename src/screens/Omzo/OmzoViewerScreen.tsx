import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    StatusBar,
    Platform,
    Image,
    Alert,
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useFollowStore } from '@/stores/followStore';
import { useInteractionStore } from '@/stores/interactionStore';
import api from '@/services/api';
import { useRepostStore } from '@/stores/repostStore';
import OmzoCommentsSheet from '@/components/OmzoCommentsSheet';
import OmzoActionsSheet from '@/components/OmzoActionsSheet';
import { transformOmzoData } from '@/utils/api-helpers';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Global mute state shared across all Omzo videos
let globalMuteState = false;

// Format counts like TikTok/Instagram (1.2K, 1.2M)
const formatCount = (count?: number | null): string => {
    if (count === undefined || count === null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
};

export default function OmzoViewerScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user: currentUser } = useAuthStore();
    const videoRef = useRef<any>(null);

    // Get omzo from route params and transform to ensure consistent format
    const rawOmzo = (route.params as any)?.omzo;
    const transformedOmzo = rawOmzo ? transformOmzoData(rawOmzo) : null;

    // State
    const [omzo, setOmzo] = useState(transformedOmzo);
    const [commentCount, setCommentCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showComments, setShowComments] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [shareCount] = useState(45); // Placeholder for share count
    const [paused, setPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(globalMuteState);

    // Global stores
    const { interactions, setInteraction } = useInteractionStore();
    const interactionKey = `omzo_${omzo?.id}`;
    const interaction = interactions[interactionKey] || {
        is_liked: omzo?.is_liked || false,
        like_count: omzo?.like_count || 0,
        is_saved: omzo?.is_saved || false,
        is_reposted: omzo?.is_reposted || false,
        repost_count: omzo?.reposts || 0
    };

    const isLiked = !!interaction.is_liked;
    const likeCount = interaction.like_count || 0;
    const isSaved = !!interaction.is_saved;
    const isReposted = !!interaction.is_reposted;
    const repostCount = interaction.repost_count || 0;

    // Seed interaction store
    useEffect(() => {
        if (omzo && interactions[interactionKey] === undefined) {
            setInteraction('omzo', omzo.id, {
                is_liked: omzo.is_liked || false,
                like_count: omzo.like_count || 0,
                is_saved: omzo.is_saved || false,
                is_reposted: omzo.is_reposted || false,
                repost_count: omzo.reposts || 0
            });
        }
    }, [omzo?.id, interactions[interactionKey]]);

    // Read follow state from global store — updates instantly when any screen toggles follow
    const omzoAuthorUsername = omzo?.user?.username || '';
    const { followStates, setFollowState } = useFollowStore();
    const storeFollowValue = followStates[omzoAuthorUsername];
    const isFollowing = storeFollowValue !== undefined
        ? storeFollowValue
        : (transformedOmzo?.is_following || false);

    // Seed store from props when not yet in store
    React.useEffect(() => {
        if (omzoAuthorUsername && storeFollowValue === undefined && transformedOmzo?.is_following !== undefined) {
            setFollowState(omzoAuthorUsername, transformedOmzo.is_following);
        }
    }, [omzoAuthorUsername]);

    // Sync state with omzo changes
    useEffect(() => {
        if (omzo) {
            setCommentCount(omzo.comment_count || 0);
        }
    }, [omzo]);

    // Track view when component mounts
    useEffect(() => {
        if (omzo?.id) {
            api.trackOmzoView(omzo.id);
        }
    }, [omzo?.id]);

    // Refresh omzo state when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            // Re-sync state from omzo object
            if (omzo) {
                setCommentCount(omzo.comment_count || 0);
            }
        }, [omzo])
    );
    const handleLike = async () => {
        if (!omzo) return;
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
            } else {
                setInteraction('omzo', omzo.id, prevInteraction);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            setInteraction('omzo', omzo.id, prevInteraction);
        }
    };

    const handleFollow = async () => {
        if (!omzoAuthorUsername) return;

        const prevFollowing = isFollowing;
        const newFollowing = !isFollowing;

        // Optimistic update in global store — all subscribers update instantly
        setFollowState(omzoAuthorUsername, newFollowing);

        try {
            const response = await api.toggleFollow(omzoAuthorUsername);
            if (response.success) {
                const nowFollowing = (response as any).is_following ?? newFollowing;
                setFollowState(omzoAuthorUsername, nowFollowing);

                // Update MY following_count in authStore
                const { user: me, updateUser } = useAuthStore.getState();
                if (me) {
                    updateUser({
                        ...me,
                        following_count: nowFollowing
                            ? me.following_count + 1
                            : Math.max(0, me.following_count - 1),
                    });
                }
            } else {
                setFollowState(omzoAuthorUsername, prevFollowing); // Revert
            }
        } catch {
            setFollowState(omzoAuthorUsername, prevFollowing); // Revert
        }
    };

    const togglePlayPause = () => {
        setPaused(!paused);
    };

    const toggleMute = () => {
        const newMuteState = !isMuted;
        setIsMuted(newMuteState);
        globalMuteState = newMuteState;
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
        if (!omzo) return;
        const prevSaved = isSaved;
        
        // Optimistic update
        setInteraction('omzo', omzo.id, { is_saved: !isSaved });

        try {
            const response = await api.toggleSaveOmzo(omzo.id);
            if (response.success) {
                setInteraction('omzo', omzo.id, { is_saved: (response as any).is_saved });
            } else {
                setInteraction('omzo', omzo.id, { is_saved: prevSaved });
            }
        } catch (error) {
            console.error('Error toggling save:', error);
            setInteraction('omzo', omzo.id, { is_saved: prevSaved });
        }
    };
    const handleRepost = async () => {
        if (!omzo) return;
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

    const handleShare = () => {
        setPaused(true);
        console.log('Share omzo:', omzo.id);
        setTimeout(() => setPaused(false), 100);
    };

    const handleProfilePress = () => {
        if (!omzo?.user?.username) return;
        (navigation as any).navigate('Profile', { username: omzo.user.username });
    };

    const handleCloseComments = () => {
        setShowComments(false);
        setPaused(false);
    };

    const handleCloseActions = () => {
        setShowActions(false);
        setPaused(false);
    };

    const handleBack = () => {
        navigation.goBack();
    };

    if (!omzo) {
        return (
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                <Text style={{ color: '#FFF' }}>No omzo data</Text>
            </View>
        );
    }

    // Check for valid avatar URL
    const avatarUri = omzo.user?.profile_picture_url || omzo.user?.profile_picture || '';
    const hasValidAvatar = avatarUri && avatarUri !== 'null' && avatarUri.length > 0 && avatarUri.startsWith('http');

    // Check for valid video URL - try all possible property names
    const videoUri = omzo.video_file || omzo.video_url || (omzo as any).videoUrl || omzo.url || '';
    const hasValidVideo = videoUri && videoUri !== 'null' && videoUri.trim().length > 0;

    // Debug logging
    console.log('OmzoViewerScreen - Video URI:', videoUri);
    console.log('OmzoViewerScreen - Has valid video:', hasValidVideo);
    console.log('OmzoViewerScreen - Omzo object:', JSON.stringify(omzo, null, 2));

    // Check if this is the current user's omzo
    const isOwnOmzo = currentUser?.username === omzo.user?.username;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

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

            {/* Top Controls - Back Button and Options */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Icon name="chevron-back" size={28} color="#FFFFFF" />
                </TouchableOpacity>
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
                onCommentAdded={() => setCommentCount((prev: number) => prev + 1)}
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
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 20,
    },
    topTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
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
        height: 250,
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
