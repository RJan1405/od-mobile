import React, { useState, useRef, useEffect, useCallback } from 'react';
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

// NEW: Import optimistic interactions hook
import { useOptimisticInteractions } from '@/hooks/useOptimisticInteractions';
import { useSyncInteractionStateOptimized } from '@/hooks/useSyncInteractionState';

import OmzoCommentsSheet from './OmzoCommentsSheet';
import OmzoActionsSheet from './OmzoActionsSheet';
import ShareSheet from './ShareSheet';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

let globalMuteState = false;

interface OmzoCardProps {
    omzo: Omzo;
    isActive: boolean;
    containerHeight?: number;
    onSaveToggle?: (omzoId: number, isSaved: boolean) => void;
    onLikeToggle?: (omzoId: number, isLiked: boolean, likeCount: number) => void;
}

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

    // NEW: Get all interaction states from optimistic hook
    const {
        isLiked,
        likeCount,
        isDisliked,
        dislikeCount,
        isSaved,
        isReposted,
        repostCount,
        commentCount,
        toggleLike,
        toggleDislike,
        toggleSave,
        toggleRepost,
        updateInteraction
    } = useOptimisticInteractions('omzo', omzo.id);

    // NEW: Sync with scribe if this omzo is in a scribe
    if (omzo.scribe_id) {
        useSyncInteractionStateOptimized('omzo', omzo.id, 'scribe', omzo.scribe_id);
    }

    // Local UI state (not interaction state)
    const [commentCount, setCommentCount] = useState(omzo.comment_count);
    const [shareCount, setShareCount] = useState(0);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [paused, setPaused] = useState(!isActive);
    const [isMuted, setIsMuted] = useState(globalMuteState);
    const [showComments, setShowComments] = useState(false);
    const [showActions, setShowActions] = useState(false);

    // Get follow store
    const { followStates, setFollowState } = useFollowStore();
    const username = omzo.user?.username || omzo.username || '';
    const followStoreValue = followStates[username];
    const isFollowing = followStoreValue !== undefined ? followStoreValue : (omzo.is_following || false);

    // NEW: Initialize cache from props on mount
    useEffect(() => {
        updateInteraction({
            is_liked: omzo.is_liked,
            like_count: omzo.like_count,
            is_disliked: omzo.is_disliked,
            dislike_count: omzo.dislike_count,
            is_saved: omzo.is_saved,
            is_reposted: omzo.is_reposted,
            repost_count: omzo.reposts,
            comment_count: omzo.comment_count
        });
    }, [omzo.id]);

    // Seed follow store
    useEffect(() => {
        if (followStoreValue === undefined && username) {
            setFollowState(username, omzo.is_following || false);
        }
    }, [username, followStoreValue, omzo.is_following, setFollowState]);

    // NEW: Simplified like handler - just call the hook function
    const handleLike = useCallback(() => {
        toggleLike();
        onLikeToggle?.(omzo.id, !isLiked, isLiked ? likeCount - 1 : likeCount + 1);
    }, [toggleLike, onLikeToggle, omzo.id, isLiked, likeCount]);

    // NEW: Simplified dislike handler
    const handleDislike = useCallback(() => {
        toggleDislike();
    }, [toggleDislike]);

    // Follow handler remains the same
    const handleFollow = useCallback(() => {
        if (!username) return;

        const isFollowingNow = followStoreValue !== undefined ? followStoreValue : (omzo.is_following || false);
        const newFollowing = !isFollowingNow;

        setFollowState(username, newFollowing);

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

    // NEW: Simplified save toggle
    const handleToggleSave = useCallback(() => {
        toggleSave();
        onSaveToggle?.(omzo.id, !isSaved);
    }, [toggleSave, onSaveToggle, omzo.id, isSaved]);

    const handleShare = useCallback(() => {
        setPaused(true);
        setShowShareSheet(true);
        console.log('Opening share sheet for omzo:', omzo.id);
    }, [omzo.id]);

    const handleShareSuccess = () => {
        setShareCount(prev => prev + 1);
        if (isActive) {
            setTimeout(() => setPaused(false), 500);
        }
    };

    // NEW: Simplified repost toggle
    const handleRepost = useCallback(() => {
        toggleRepost();
    }, [toggleRepost]);

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

    const avatarUri = omzo.user?.profile_picture_url || omzo.user_avatar || '';
    const hasValidAvatar = avatarUri && avatarUri !== 'null' && avatarUri.length > 0 && avatarUri.startsWith('http');

    const videoUri = omzo.video_file || omzo.video_url || omzo.url || '';
    const hasValidVideo = videoUri && videoUri !== 'null' && videoUri.length > 0 && videoUri.startsWith('http');

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

            <TouchableOpacity
                style={styles.tapArea}
                activeOpacity={1}
                onPress={togglePlayPause}
            />

            <View style={styles.topBar}>
                <Text style={styles.topTitle}>Omzo</Text>
                <TouchableOpacity style={styles.menuCircle} onPress={handleMoreActions}>
                    <Icon name="ellipsis-vertical" size={26} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.muteButton}
                onPress={toggleMute}
            >
                <Icon
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={32}
                    color="#FFFFFF"
                />
            </TouchableOpacity>

            {paused && (
                <View style={styles.playIconContainer} pointerEvents="none">
                    <Icon name="play-circle" size={80} color="rgba(255, 255, 255, 0.9)" />
                </View>
            )}

            <View style={styles.bottomShadow} pointerEvents="none" />

            {/* Right Side Actions - NOW USING HOOK VALUES */}
            <View style={styles.actionsColumn}>
                {/* Like */}
                <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={34}
                            color={isLiked ? '#FF3B5C' : '#FFFFFF'}
                            style={styles.iconShadow}
                        />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.actionButton} onPress={handleComments} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="chatbubble-outline" size={32} color="#FFFFFF" style={styles.iconShadow} />
                    </View>
                    <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
                </TouchableOpacity>

                {/* Repost */}
                <TouchableOpacity style={styles.actionButton} onPress={handleRepost} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={isReposted ? 'repeat' : 'repeat-outline'}
                            size={32}
                            color={isReposted ? '#10B981' : '#FFFFFF'}
                            style={styles.iconShadow}
                        />
                    </View>
                    <Text style={[styles.actionCount, isReposted && { color: '#10B981' }]}>
                        {formatCount(repostCount)}
                    </Text>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon name="paper-plane-outline" size={32} color="#FFFFFF" style={styles.iconShadow} />
                    </View>
                </TouchableOpacity>

                {/* Bookmark */}
                <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave} activeOpacity={0.7}>
                    <View style={styles.actionIconContainer}>
                        <Icon
                            name={isSaved ? 'bookmark' : 'bookmark-outline'}
                            size={32}
                            color="#FFFFFF"
                            style={styles.iconShadow}
                        />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Sheets remain the same */}
            <OmzoCommentsSheet
                isVisible={showComments}
                onClose={handleCloseComments}
                omzoId={omzo.id}
            />

            <OmzoActionsSheet
                isVisible={showActions}
                onClose={handleCloseActions}
                omzo={{
                    ...omzo,
                    is_liked: isLiked,
                    like_count: likeCount,
                    is_saved: isSaved,
                    is_reposted: isReposted,
                    reposts: repostCount
                }}
                isSaved={isSaved}
                onToggleSave={handleToggleSave}
                isReposted={isReposted}
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
        right: 100,
        bottom: 200,
        zIndex: 1,
    },
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
    },
    menuCircle: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    muteButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 70,
        right: 16,
        zIndex: 10,
    },
    playIconContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -40,
        marginLeft: -40,
        zIndex: 5,
    },
    bottomShadow: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent)',
    },
    actionsColumn: {
        position: 'absolute',
        right: 12,
        bottom: 100,
        alignItems: 'center',
        zIndex: 5,
    },
    actionButton: {
        alignItems: 'center',
        marginVertical: 16,
    },
    actionIconContainer: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionCount: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
    },
    iconShadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
