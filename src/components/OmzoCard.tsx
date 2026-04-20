import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Image,
    Platform,
    Alert,
    Animated,
} from 'react-native';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
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
import ShareSheet from './ShareSheet';

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

export default React.memo(function OmzoCard({ omzo, isActive, containerHeight, onSaveToggle, onLikeToggle }: OmzoCardProps) {
    const { colors } = useThemeStore();
    const navigation = useNavigation();
    const { user: currentUser } = useAuthStore();
    const videoRef = useRef<any>(null);
    const [commentCount, setCommentCount] = useState(omzo.comment_count);
    const [shareCount, setShareCount] = useState(0);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [paused, setPaused] = useState(!isActive);
    const [isMuted, setIsMuted] = useState(globalMuteState);
    const [showComments, setShowComments] = useState(false);
    const [showActions, setShowActions] = useState(false);
    
    // Heart animation state
    const heartScale = useRef(new Animated.Value(0)).current;
    const heartOpacity = useRef(new Animated.Value(0)).current;
    const doubleTapRef = useRef(null);

    const showHeartAnimation = useCallback(() => {
        heartScale.setValue(0);
        heartOpacity.setValue(1);
        Animated.parallel([
            Animated.spring(heartScale, {
                toValue: 1.6,
                useNativeDriver: true,
                friction: 6,
                tension: 40,
            }),
            Animated.sequence([
                Animated.delay(400),
                Animated.timing(heartOpacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                })
            ])
        ]).start();
    }, [heartScale, heartOpacity]);

    // Use LOCAL state for interactions - don't subscribe to store for reading!
    const [localLikeCount, setLocalLikeCount] = useState(omzo.like_count || 0);
    const [localLiked, setLocalLiked] = useState(!!omzo.is_liked);
    const [localDislikeCount, setLocalDislikeCount] = useState(omzo.dislike_count || 0);
    const [localDisliked, setLocalDisliked] = useState(!!omzo.is_disliked);
    const [localSaved, setLocalSaved] = useState(!!omzo.is_saved);
    const [localReposted, setLocalReposted] = useState(!!omzo.is_reposted);
    const [localRepostCount, setLocalRepostCount] = useState(omzo.reposts || 0);

    // Get store setter (don't subscribe for reading!)
    const setInteraction = useInteractionStore(state => state.setInteraction);

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

    const handleLike = useCallback(() => {
        // Calculate new state instantly
        const newLiked = !localLiked;
        const newLikeCount = localLiked ? Math.max(0, localLikeCount - 1) : localLikeCount + 1;
        const newDisliked = newLiked ? false : localDisliked;
        const newDislikeCount = (!localLiked && localDisliked) ? Math.max(0, localDislikeCount - 1) : localDislikeCount;

        // Update LOCAL state IMMEDIATELY (no re-render blocking!)
        setLocalLiked(newLiked);
        setLocalLikeCount(newLikeCount);
        setLocalDisliked(newDisliked);
        setLocalDislikeCount(newDislikeCount);

        // Persist to store (no blocking)
        setInteraction('omzo', omzo.id, {
            is_liked: newLiked,
            like_count: newLikeCount,
            is_disliked: newDisliked,
            dislike_count: newDislikeCount
        });

        // Fire API call in background
        api.toggleOmzoLike(omzo.id).then(response => {
            if (response.success) {
                setLocalLiked((response as any).is_liked);
                setLocalLikeCount((response as any).like_count);
                setLocalDisliked((response as any).is_disliked);
                setLocalDislikeCount((response as any).dislike_count);
                onLikeToggle?.(omzo.id, (response as any).is_liked, (response as any).like_count);
            } else {
                setLocalLiked(localLiked);
                setLocalLikeCount(localLikeCount);
                setLocalDisliked(localDisliked);
                setLocalDislikeCount(localDislikeCount);
            }
        }).catch(error => {
            console.error('Error toggling like:', error);
            setLocalLiked(localLiked);
            setLocalLikeCount(localLikeCount);
            setLocalDisliked(localDisliked);
            setLocalDislikeCount(localDislikeCount);
        });
    }, [localLiked, localLikeCount, localDisliked, localDislikeCount, omzo.id, setInteraction, onLikeToggle]);

    const handleDislike = useCallback(() => {
        // Calculate new state instantly
        const newDisliked = !localDisliked;
        const newDislikeCount = localDisliked ? Math.max(0, localDislikeCount - 1) : localDislikeCount + 1;
        const newLiked = newDisliked ? false : localLiked;
        const newLikeCount = (!localDisliked && localLiked) ? Math.max(0, localLikeCount - 1) : localLikeCount;

        // Update LOCAL state IMMEDIATELY
        setLocalDisliked(newDisliked);
        setLocalDislikeCount(newDislikeCount);
        setLocalLiked(newLiked);
        setLocalLikeCount(newLikeCount);

        // Persist to store
        setInteraction('omzo', omzo.id, {
            is_disliked: newDisliked,
            dislike_count: newDislikeCount,
            is_liked: newLiked,
            like_count: newLikeCount
        });

        // Fire API call in background
        api.toggleOmzoDislike(omzo.id).then(response => {
            if (response.success) {
                setLocalLiked((response as any).is_liked);
                setLocalLikeCount((response as any).like_count);
                setLocalDisliked((response as any).is_disliked);
                setLocalDislikeCount((response as any).dislike_count);
            } else {
                setLocalDisliked(localDisliked);
                setLocalDislikeCount(localDislikeCount);
                setLocalLiked(localLiked);
                setLocalLikeCount(localLikeCount);
            }
        }).catch(error => {
            console.error('Error toggling dislike:', error);
            setLocalDisliked(localDisliked);
            setLocalDislikeCount(localDislikeCount);
            setLocalLiked(localLiked);
            setLocalLikeCount(localLikeCount);
        });
    }, [localDisliked, localDislikeCount, localLiked, localLikeCount, omzo.id, setInteraction]);

    const handleFollow = useCallback(() => {
        if (!username) return;

        const isFollowingNow = followStoreValue !== undefined ? followStoreValue : (omzo.is_following || false);
        const newFollowing = !isFollowingNow;

        // Update UI IMMEDIATELY
        setFollowState(username, newFollowing);

        // Fire API call in background
        api.toggleFollow(username).then(response => {
            if (response.success) {
                const nowFollowing = (response as any).is_following ?? newFollowing;
                setFollowState(username, nowFollowing);
            } else {
                setFollowState(username, isFollowingNow);
            }
        }).catch(error => {
            console.error('Error toggling follow:', error);
            setFollowState(username, isFollowingNow);
        });
    }, [username, followStoreValue, omzo.is_following, setFollowState]);

    const togglePlayPause = () => {
        setPaused(!paused);
    };

    const onSingleTap = useCallback((event: any) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            togglePlayPause();
        }
    }, [paused]);

    const likedRef = useRef(localLiked);
    likedRef.current = localLiked;

    const onDoubleTap = useCallback((event: any) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            showHeartAnimation();
            if (!likedRef.current) {
                // Defer the state processing slightly to ensure animation starts 
                // perfectly smooth without JS thread interference from state updates
                requestAnimationFrame(() => {
                    handleLike();
                });
            }
        }
    }, [handleLike, showHeartAnimation]);

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

    const handleToggleSave = useCallback(() => {
        const newSaved = !localSaved;
        setLocalSaved(newSaved);
        setInteraction('omzo', omzo.id, { is_saved: newSaved });

        api.toggleSaveOmzo(omzo.id).then(response => {
            if (response.success) {
                setLocalSaved((response as any).is_saved);
                onSaveToggle?.(omzo.id, (response as any).is_saved);
            } else {
                setLocalSaved(localSaved);
            }
        }).catch(error => {
            console.error('Error toggling save:', error);
            setLocalSaved(localSaved);
        });
    }, [localSaved, omzo.id, setInteraction, onSaveToggle]);

    const handleShare = useCallback(() => {
        setPaused(true);
        setShowShareSheet(true);
        console.log('Opening share sheet for omzo:', omzo.id);
    }, [omzo.id]);

    const handleShareSuccess = () => {
        setShareCount(prev => prev + 1);
        // If isActive, resume play after a short delay
        if (isActive) {
            setTimeout(() => setPaused(false), 500);
        }
    };

    const handleRepost = useCallback(() => {
        const newReposted = !localReposted;
        const newCount = localReposted ? Math.max(0, localRepostCount - 1) : localRepostCount + 1;

        // Update LOCAL state IMMEDIATELY
        setLocalReposted(newReposted);
        setLocalRepostCount(newCount);

        // Persist to store
        setInteraction('omzo', omzo.id, {
            is_reposted: newReposted,
            repost_count: newCount
        });

        // Fire API call in background
        api.toggleRepostOmzo(omzo.id).then(response => {
            if (response.success) {
                const actualReposted = response.is_reposted ?? newReposted;
                setLocalReposted(actualReposted);
                const msg = response.action === 'removed'
                    ? 'Repost removed from your profile'
                    : 'Reposted to your profile';
                Alert.alert('', msg, [{ text: 'OK' }]);
            } else {
                setLocalReposted(localReposted);
                setLocalRepostCount(localRepostCount);
            }
        }).catch(err => {
            setLocalReposted(localReposted);
            setLocalRepostCount(localRepostCount);
            Alert.alert('Error', err?.message || 'Failed to repost');
        });
    }, [localReposted, localRepostCount, omzo.id, setInteraction]);

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
    const isAvatarGif = avatarUri.toLowerCase().endsWith('.gif');
    const avatarUriWithBuster = avatarUri;
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
                    resizeMode="contain"
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

            {/* Tap Gestures for Pause/Play and Like */}
            <TapGestureHandler
                onHandlerStateChange={onSingleTap}
                waitFor={doubleTapRef}
            >
                <TapGestureHandler
                    ref={doubleTapRef}
                    onHandlerStateChange={onDoubleTap}
                    numberOfTaps={2}
                >
                    <View style={styles.tapArea} />
                </TapGestureHandler>
            </TapGestureHandler>

            {/* Heart Animation Overlay */}
            <Animated.View 
                style={[
                    styles.heartOverlay,
                    {
                        opacity: heartOpacity,
                        transform: [{ scale: heartScale }]
                    }
                ]}
                pointerEvents="none"
            >
                <Icon name="heart" size={100} color="#FF3B5C" />
            </Animated.View>

            {/* Top Controls - Title and Options */}
            <View style={styles.topBar}>
                <Text style={styles.topTitle}>Omzo</Text>
                <TouchableOpacity style={styles.menuCircle} onPress={handleMoreActions} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Icon name="ellipsis-vertical" size={26} color="#FFFFFF" style={{ textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }} />
                </TouchableOpacity>
            </View>

            {/* Mute/Unmute Button */}
            <TouchableOpacity
                style={styles.muteButton}
                onPress={toggleMute}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Icon
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={32}
                    color="#FFFFFF"
                    style={{ textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
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
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <View style={styles.avatarContainer}>
                            {hasValidAvatar ? (
                                <Image
                                    source={{ uri: avatarUriWithBuster }}
                                    style={styles.avatarImage}
                                />
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
                <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={localLiked ? 'heart' : 'heart-outline'}
                            size={34}
                            color={localLiked ? '#FF3B5C' : '#FFFFFF'}
                            style={styles.iconShadow}
                        />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(localLikeCount)}</Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.actionButton} onPress={handleComments} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="chatbubble-outline" size={32} color="#FFFFFF" style={styles.iconShadow} />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
                </TouchableOpacity>

                {/* Repost */}
                <TouchableOpacity style={styles.actionButton} onPress={handleRepost} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={localReposted ? 'repeat' : 'repeat-outline'}
                            size={32}
                            color={localReposted ? '#10B981' : '#FFFFFF'}
                            style={styles.iconShadow}
                        />
                    </View>
                    <Text style={[styles.actionCount, localReposted && { color: '#10B981' }]}>
                        {formatCount(localRepostCount)}
                    </Text>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="paper-plane-outline" size={32} color="#FFFFFF" style={[{ marginLeft: -2, marginTop: 2 }, styles.iconShadow]} />
                    </View>
                </TouchableOpacity>

                {/* Bookmark */}
                <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={localSaved ? 'bookmark' : 'bookmark-outline'}
                            size={32}
                            color={localSaved ? '#FFFFFF' : '#FFFFFF'}
                            style={styles.iconShadow}
                        />
                    </View>
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
                onClose={() => {
                    setShowActions(false);
                    if (isActive) setPaused(false);
                }}
                omzo={{
                    ...omzo,
                    is_liked: localLiked,
                    like_count: localLikeCount,
                    is_saved: localSaved,
                    is_reposted: localReposted,
                    reposts: localRepostCount
                }}
                isSaved={localSaved}
                onToggleSave={handleToggleSave}
                isReposted={localReposted}
                onToggleRepost={handleRepost}
                isOwnOmzo={currentUser?.username === username}
            />

            <ShareSheet
                isVisible={showShareSheet}
                onClose={() => {
                    setShowShareSheet(false);
                    if (isActive) setPaused(false);
                }}
                contentId={omzo.id}
                contentType="omzo"
                contentUrl={`https://odnix.com/omzo/${omzo.id}/`}
                onShareSuccess={handleShareSuccess}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: SCREEN_WIDTH,
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
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Mute Button
    muteButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 70,
        right: 16,
        zIndex: 10,
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconShadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    actionCount: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    heartOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
});
