import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Platform,
    Share,
    DeviceEventEmitter,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Video from 'react-native-video';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useFollowStore } from '@/stores/followStore';
import { useInteractionStore } from '@/stores/interactionStore';
import api from '@/services/api';
import type { Scribe } from '@/types';

interface ScribeCardProps {
    scribe: Scribe;
    onSaveToggle?: (scribeId: number, isSaved: boolean) => void;
    onPress?: () => void;
    onCommentPress?: () => void;
    onDelete?: (scribeId: number) => void;
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
function renderContent(content: string, textColor: string, hashtagColor: string) {
    const parts = content.split(/(#\w+|@\w+)/g);
    return (
        <Text style={[styles.content, { color: textColor }]}>
            {parts.map((part, idx) => {
                if (part.startsWith('#') || part.startsWith('@')) {
                    return (
                        <Text key={idx} style={[styles.hashtag, { color: hashtagColor }]}>
                            {part}
                        </Text>
                    );
                }
                return <Text key={idx}>{part}</Text>;
            })}
        </Text>
    );
}

const ScribeImage = ({ uri }: { uri: string }) => {
    const [aspectRatio, setAspectRatio] = useState<number>(1.5); // Default landscape ratio

    React.useEffect(() => {
        if (!uri) return;
        Image.getSize(
            uri,
            (width, height) => {
                if (width && height && height > 0) {
                    setAspectRatio(Math.max(0.5, Math.min(width / height, 2.5))); // Bound the aspect ratio to avoid excessively tall/wide images
                }
            },
            () => {
                // Ignore error, fallback to default
            }
        );
    }, [uri]);

    return (
        <Image
            source={{ uri }}
            style={[styles.image, { height: undefined, aspectRatio }]}
            resizeMode="cover"
        />
    );
};

export default function ScribeCard({ scribe, onSaveToggle, onPress, onCommentPress, onDelete }: ScribeCardProps) {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user: currentUser } = useAuthStore();
    // Determine if this is a simple repost or a quote scribe
    const isSimpleRepost = !!(scribe.original_scribe || scribe.original_omzo || (scribe.original_type && scribe.original_data) || scribe.is_repost) && !scribe.content;
    const isQuoteScribe = !!(scribe.original_scribe || scribe.original_omzo || (scribe.original_type && scribe.original_data) || scribe.is_repost) && !!scribe.content;

    // For simple reposts, we display the original post as the main content
    const displayScribe = isSimpleRepost ? (scribe.original_scribe || scribe.original_data || scribe) : scribe;

    // Display settings
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [webviewHeight, setWebviewHeight] = useState(300);

    // Global stores
    const { interactions, setInteraction } = useInteractionStore();
    const interactionKey = `scribe_${displayScribe.id}`;
    const interaction = interactions[interactionKey] || {
        is_liked: displayScribe.is_liked || false,
        like_count: displayScribe.like_count || 0,
        is_saved: displayScribe.is_saved || false,
        is_reposted: displayScribe.is_reposted || isSimpleRepost,
        repost_count: displayScribe.repost_count || 0
    };

    const isLiked = interaction.is_liked;
    const likeCount = interaction.like_count || 0;
    const isSaved = interaction.is_saved;
    const isReposted = interaction.is_reposted;
    const repostCount = interaction.repost_count || 0;

    // Read follow state from global store — updates instantly when any screen toggles follow
    const scribeAuthorUsername = scribe.user?.username || '';
    const { followStates, setFollowState } = useFollowStore();
    const storeValue = followStates[scribeAuthorUsername];
    // Fallback chain: store > scribe.is_following > scribe.user.is_following > false
    const isFollowing = storeValue !== undefined
        ? storeValue
        : ((scribe as any).is_following ?? (scribe.user as any)?.is_following ?? (scribe.user as any)?.isFollowing ?? false);

    // Seed follow store
    React.useEffect(() => {
        if (storeValue === undefined && scribeAuthorUsername) {
            const propValue =
                (scribe as any).is_following ??
                (scribe.user as any)?.is_following ??
                (scribe.user as any)?.isFollowing;
            if (propValue !== undefined) {
                setFollowState(scribeAuthorUsername, propValue);
            }
        }
    }, [scribeAuthorUsername, storeValue]);

    // Seed interaction store
    React.useEffect(() => {
        if (interactions[interactionKey] === undefined && displayScribe.id) {
            setInteraction('scribe', displayScribe.id, {
                is_liked: displayScribe.is_liked || false,
                like_count: displayScribe.like_count || 0,
                is_saved: displayScribe.is_saved || false,
                is_reposted: displayScribe.is_reposted || isSimpleRepost,
                repost_count: displayScribe.repost_count || 0,
                comment_count: displayScribe.comment_count || 0
            });
        }
    }, [displayScribe.id, interactions[interactionKey]]);

    const isOwnScribe = currentUser?.username === displayScribe.user?.username;

    const handleLike = async () => {
        const prevInteraction = interaction;

        // Optimistic update
        const newIsLiked = !isLiked;
        const newLikeCount = isLiked ? Math.max(0, likeCount - 1) : likeCount + 1;

        setInteraction('scribe', displayScribe.id, {
            is_liked: newIsLiked,
            like_count: newLikeCount
        });

        try {
            // Use the correct API based on content type
            const isOmzo = displayScribe.original_type === 'omzo' || !!displayScribe.original_omzo;
            const response = isOmzo 
                ? await api.toggleOmzoLike(displayScribe.id)
                : await api.toggleLike(displayScribe.id);

            if (response.success) {
                setInteraction('scribe', displayScribe.id, {
                    is_liked: (response as any).is_liked,
                    like_count: (response as any).like_count,
                    is_disliked: (response as any).is_disliked,
                    dislike_count: (response as any).dislike_count
                });
            } else {
                setInteraction('scribe', displayScribe.id, prevInteraction);
            }
        } catch {
            setInteraction('scribe', displayScribe.id, prevInteraction);
        }
    };

    const handleSave = async () => {
        const prevInteraction = interaction;

        // Optimistic update
        const newIsSaved = !isSaved;
        setInteraction('scribe', displayScribe.id, { is_saved: newIsSaved });

        try {
            // Use correct API based on content type
            const isOmzo = displayScribe.original_type === 'omzo' || !!displayScribe.original_omzo;
            const response = isOmzo
                ? await api.toggleSaveOmzo(displayScribe.id)
                : await api.toggleSaveScribe(displayScribe.id);

            if (response.success) {
                const actual = response.is_saved ?? newIsSaved;
                setInteraction('scribe', displayScribe.id, { is_saved: actual });
                onSaveToggle?.(displayScribe.id, actual);
            } else {
                setInteraction('scribe', displayScribe.id, prevInteraction);
            }
        } catch {
            setInteraction('scribe', displayScribe.id, prevInteraction);
        }
    };

    const handleRepost = async () => {
        const prevInteraction = interaction;

        // Optimistic update
        const newIsReposted = !isReposted;
        const newCount = isReposted ? Math.max(0, repostCount - 1) : repostCount + 1;

        setInteraction('scribe', displayScribe.id, {
            is_reposted: newIsReposted,
            repost_count: newCount
        });

        try {
            // Use correct API based on content type
            const isOmzo = displayScribe.original_type === 'omzo' || !!displayScribe.original_omzo;
            const response = isOmzo
                ? await api.toggleRepostOmzo(displayScribe.id)
                : await api.toggleRepostScribe(displayScribe.id);

            if (response.success) {
                const actualReposted = response.is_reposted ?? newIsReposted;
                setInteraction('scribe', displayScribe.id, {
                    is_reposted: actualReposted
                });

                const msg = response.action === 'removed'
                    ? 'Repost removed from your profile'
                    : 'Reposted to your profile';
                Alert.alert('', msg, [{ text: 'OK' }]);
            } else {
                setInteraction('scribe', displayScribe.id, prevInteraction);
                Alert.alert('Error', response.error || 'Failed to repost');
            }
        } catch (err: any) {
            setInteraction('scribe', displayScribe.id, prevInteraction);
            Alert.alert('Error', err?.message || 'Failed to repost');
        }
    };

    const handleFollow = async () => {
        if (!scribeAuthorUsername) return;
        const prev = isFollowing;
        const newVal = !isFollowing;

        // Optimistic update in global store — all subscribers update instantly
        setFollowState(scribeAuthorUsername, newVal);

        try {
            const response = await api.toggleFollow(scribeAuthorUsername);
            if (response.success) {
                const nowFollowing = (response as any).is_following ?? newVal;
                setFollowState(scribeAuthorUsername, nowFollowing);

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
                setFollowState(scribeAuthorUsername, prev); // Revert
            }
        } catch {
            setFollowState(scribeAuthorUsername, prev); // Revert
        }
    };

    const handleMorePress = () => {
        const options = [];
        
        if (isOwnScribe) {
            options.push({
                text: 'Delete Scribe',
                style: 'destructive' as const,
                onPress: () => {
                    Alert.alert(
                        'Delete Scribe',
                        'Are you sure you want to delete this post? This action cannot be undone.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                                text: 'Delete', 
                                style: 'destructive',
                                onPress: async () => {
                                    try {
                                        const response = await api.deleteScribe(displayScribe.id);
                                        if (response.success) {
                                            onDelete?.(displayScribe.id);
                                            DeviceEventEmitter.emit('SCRIBE_DELETED', { scribeId: displayScribe.id });
                                        } else {
                                            Alert.alert('Error', response.error || 'Failed to delete scribe');
                                        }
                                    } catch (err) {
                                        Alert.alert('Error', 'An error occurred while deleting');
                                    }
                                }
                            }
                        ]
                    );
                }
            });
        } else {
            options.push({
                text: 'Report Scribe',
                onPress: () => Alert.alert('Report', 'Thank you for reporting. We will review this content.')
            });
        }

        options.push({ text: 'Cancel', style: 'cancel' as const });

        Alert.alert('Options', '', options);
    };

    const handleProfilePress = () => {
        if (!scribe.user?.username) return;
        (navigation as any).navigate('Profile', { username: scribe.user.username });
    };

    const avatarUri = displayScribe.user?.profile_picture_url || (displayScribe.user as any)?.avatar || '';
    const imageUri = displayScribe.media_url || displayScribe.image_url || (displayScribe as any).mediaUrl || (displayScribe as any).image || '';
    const videoUri = (displayScribe as any).video_url || (displayScribe as any).video_file || ((displayScribe as any).original_type === 'omzo' ? displayScribe.media_url : '');

    const hasValidAvatar = avatarUri && avatarUri !== 'null' && avatarUri.startsWith('http');
    const hasValidImage = !!imageUri && imageUri !== '' && !imageUri.endsWith('null') && !imageUri.endsWith('undefined');
    const hasValidVideo = !!videoUri && videoUri !== '' && !videoUri.endsWith('null') && !videoUri.endsWith('undefined');




    const generateHtmlContent = () => {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <style>
                    body { 
                        margin: 0; 
                        padding: 0; 
                        overflow: hidden; 
                        background: #FFFFFF;
                    }
                    ${displayScribe.code_css || ''}
                </style>
            </head>
            <body>
                <div id="content-wrapper">
                    ${displayScribe.code_html || ''}
                </div>
                <script>
                    ${displayScribe.code_js || ''}
                    
                    // Function to send height to React Native
                    function sendHeight() {
                        const height = document.getElementById('content-wrapper').scrollHeight;
                        window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
                    }

                    // Send height on load and any changes
                    window.onload = sendHeight;
                    
                    // Optional: MutationObserver to detect content changes
                    const observer = new MutationObserver(sendHeight);
                    observer.observe(document.getElementById('content-wrapper'), {
                        childList: true,
                        subtree: true,
                        attributes: true
                    });
                </script>
            </body>
            </html>
        `;
    };

    const hasCode = !!(displayScribe.code_html || displayScribe.code_css || displayScribe.code_js);

    const createdAt = displayScribe.timestamp || (displayScribe as any).createdAt || (displayScribe as any).created_at;
    const relativeTime = formatRelativeTime(createdAt);

    const originalScribe = scribe.original_scribe || (scribe.original_type === 'scribe' ? scribe.original_data : null);
    const originalOmzo = scribe.original_omzo || (scribe.original_type === 'omzo' ? scribe.original_data : null);

    return (
        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.text }]}>
            {/* Repost Header Banner - Show if this is a repost of any kind */}
            {(isSimpleRepost || isQuoteScribe) && (
                <View style={styles.repostBanner}>
                    <Icon name="repeat-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.repostBannerText, { color: colors.textSecondary }]}>
                        {scribe.user?.full_name || scribe.user?.username || 'Someone'} reposted
                    </Text>
                </View>
            )}

            {/* If Quote Scribe, show the original content in a box */}
            {isQuoteScribe && originalScribe && (
                <View style={[styles.originalContentBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <View style={styles.originalHeader}>
                        <View style={styles.originalAvatarWrap}>
                            {originalScribe.user?.profile_picture_url || originalScribe.user?.avatar ? (
                                <Image source={{ uri: originalScribe.user.profile_picture_url || originalScribe.user.avatar }} style={styles.originalAvatar} />
                            ) : (
                                <View style={[styles.originalAvatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.avatarLetter}>
                                        {originalScribe.user?.username?.[0]?.toUpperCase() || originalScribe.user?.display_name?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View>
                            <Text style={[styles.originalDisplayName, { color: colors.text }]}>
                                {originalScribe.user?.full_name || originalScribe.user?.display_name || originalScribe.user?.username || 'Unknown'}
                            </Text>
                            <Text style={[styles.originalHandle, { color: colors.textSecondary }]}>@{originalScribe.user?.username || 'unknown'}</Text>
                        </View>
                    </View>
                    {originalScribe.content ? (
                        <Text style={[styles.originalContent, { color: colors.textSecondary }]}>{originalScribe.content}</Text>
                    ) : null}
                    {(originalScribe.media_url || originalScribe.image_url || originalScribe.image) ? (
                        <Image
                            source={{ uri: (originalScribe.media_url || originalScribe.image_url || originalScribe.image)! }}
                            style={[styles.originalImage, { backgroundColor: colors.border }]}
                            resizeMode="cover"
                        />
                    ) : null}
                </View>
            )}

            {/* If Quote Scribe of an Omzo, show Omzo preview */}
            {isQuoteScribe && originalOmzo && (
                <View style={[styles.originalContentBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <View style={styles.originalHeader}>
                        <View style={styles.originalAvatarWrap}>
                            {originalOmzo.user?.profile_picture_url || originalOmzo.user_avatar || originalOmzo.user?.avatar ? (
                                <Image source={{ uri: (originalOmzo.user?.profile_picture_url || originalOmzo.user_avatar || originalOmzo.user?.avatar)! }} style={styles.originalAvatar} />
                            ) : (
                                <View style={[styles.originalAvatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.avatarLetter}>
                                        {(originalOmzo.user?.username || originalOmzo.user?.display_name || originalOmzo.username || '?')[0]?.toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View>
                            <Text style={[styles.originalDisplayName, { color: colors.text }]}>
                                {originalOmzo.user?.full_name || originalOmzo.user?.display_name || originalOmzo.user?.username || originalOmzo.username || 'Unknown'}
                            </Text>
                            <Text style={[styles.originalHandle, { color: colors.textSecondary }]}>@{originalOmzo.user?.username || originalOmzo.username || 'unknown'}</Text>
                        </View>
                    </View>
                    <View style={styles.omzoBadge}>
                        <Icon name="videocam-outline" size={14} color={colors.secondary} />
                        <Text style={[styles.omzoBadgeText, { color: colors.secondary }]}>Omzo · {originalOmzo.caption || 'Video'}</Text>
                    </View>
                    {(originalOmzo.video_url || originalOmzo.video_file || originalOmzo.media_url) ? (
                        <View style={styles.originalVideoContainer}>
                            <Video
                                source={{ uri: (originalOmzo.video_url || originalOmzo.video_file || originalOmzo.media_url)! }}
                                style={[styles.originalImage, { backgroundColor: colors.border }]}
                                paused={true}
                                resizeMode="cover"
                                poster={(originalOmzo.thumbnail_url || originalOmzo.video_url || originalOmzo.video_file || originalOmzo.media_url)!}
                                posterResizeMode="cover"
                            />
                            <View style={styles.playIconOverlay}>
                                <Icon name="play" size={40} color="#FFFFFF" />
                            </View>
                        </View>
                    ) : null}
                </View>
            )}

            {/* Tappable Area - used for both regular posts and Simple Reposts */}
            {!isQuoteScribe && (
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
                                <View style={[styles.avatar, styles.cardAvatarFallback, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.cardAvatarLetter}>
                                        {displayScribe.user?.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={styles.headerMid}>
                            <View style={styles.nameRow}>
                                <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.85}>
                                    <Text style={[styles.displayName, { color: colors.text }]}>
                                        {displayScribe.user?.full_name || displayScribe.user?.username || 'Unknown'}
                                    </Text>
                                </TouchableOpacity>
                                {displayScribe.user?.is_verified && (
                                    <Icon name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 1 }} />
                                )}
                                
                                {!isOwnScribe && (
                                    <TouchableOpacity
                                        onPress={handleFollow}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.followLinkText, 
                                            { color: colors.primary },
                                            isFollowing && { color: colors.textSecondary }
                                        ]}>
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {relativeTime ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={[styles.dotSep, { color: colors.textSecondary }]}>·</Text>
                                        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>{relativeTime}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text style={[styles.handle, { color: colors.textSecondary }]}>@{displayScribe.user?.username || 'unknown'}</Text>
                        </View>

                        <TouchableOpacity 
                            style={styles.moreBtn} 
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={handleMorePress}
                        >
                            <Icon name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {displayScribe.content ? renderContent(displayScribe.content, colors.text, colors.primary) : null}

                    {/* Code snippets & Live Preview */}
                    {/* Code snippets & Live Preview - macOS Style Window */}
                    {hasCode && (
                        <View style={[styles.windowContainer, { borderColor: colors.border + '40', borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginTop: 12 }]}>
                            <View style={[styles.windowHeader, { backgroundColor: colors.background }]}>
                                <View style={styles.windowDots}>
                                    <View style={[styles.windowDot, { backgroundColor: '#FF5F56' }]} />
                                    <View style={[styles.windowDot, { backgroundColor: '#FFBD2E' }]} />
                                    <View style={[styles.windowDot, { backgroundColor: '#27C93F' }]} />
                                </View>
                                <Text style={[styles.windowTitle, { color: colors.textSecondary }]}>HTML Preview</Text>
                            </View>
                            
                            <View style={[
                                styles.webviewContainer, 
                                { 
                                    height: Math.max(200, webviewHeight),
                                    backgroundColor: '#FFFFFF', 
                                    borderTopWidth: 1,
                                    borderTopColor: colors.border + '40'
                                }
                            ]}>
                                <WebView
                                    source={{ html: generateHtmlContent() }}
                                    style={styles.webview}
                                    scrollEnabled={false}
                                    showsVerticalScrollIndicator={false}
                                    showsHorizontalScrollIndicator={false}
                                    onMessage={(event) => {
                                        try {
                                            const data = JSON.parse(event.nativeEvent.data);
                                            if (data.height) {
                                                setWebviewHeight(data.height + 20); // Add some padding
                                            }
                                        } catch (e) {
                                            console.warn("Failed to parse height from WebView", e);
                                        }
                                    }}
                                />
                            </View>
                        </View>
                    )}

                    {/* Image */}
                    {hasValidImage && !hasValidVideo && (
                        <View style={[styles.image, { backgroundColor: colors.background }]}>
                            <ScribeImage uri={imageUri} />
                        </View>
                    )}

                    {/* Video (for Omzo simple reposts) */}
                    {hasValidVideo && (
                        <View style={styles.originalVideoContainer}>
                            <Video
                                source={{ uri: videoUri }}
                                style={[styles.originalImage, { backgroundColor: colors.background }]}
                                paused={true}
                                resizeMode="cover"
                                poster={imageUri || videoUri}
                                posterResizeMode="cover"
                            />
                            <View style={styles.playIconOverlay}>
                                <Icon name="play" size={40} color="#FFFFFF" />
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            )}

            <View style={[styles.actions, { backgroundColor: colors.background, borderColor: colors.border + '40' }]}>
                {/* Like */}
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
                    <Icon
                        name={isLiked ? 'heart' : 'heart-outline'}
                        size={22}
                        color={isLiked ? '#FF3B5C' : colors.textSecondary}
                    />
                    <Text style={[styles.actionCount, { color: colors.textSecondary }, isLiked && { color: '#FF3B5C' }]}>
                        {formatCount(likeCount)}
                    </Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onCommentPress || onPress}>
                    <Icon name="chatbubble-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.actionCount, { color: colors.textSecondary }]}>
                        {formatCount(interactions[interactionKey]?.comment_count ?? displayScribe.comment_count ?? 0)}
                    </Text>
                </TouchableOpacity>

                {/* Repost */}
                <TouchableOpacity style={styles.actionBtn} onPress={handleRepost} activeOpacity={0.7}>
                    <Icon
                        name={isReposted ? 'repeat' : 'repeat-outline'}
                        size={22}
                        color={isReposted ? colors.success : colors.textSecondary}
                    />
                    <Text style={[styles.actionCount, { color: colors.textSecondary }, isReposted && { color: colors.success }]}>
                        {formatCount(repostCount)}
                    </Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                {/* Bookmark */}
                <TouchableOpacity style={styles.actionIconBtn} onPress={handleSave} activeOpacity={0.7}>
                    <Icon
                        name={isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={isSaved ? colors.primary : colors.textSecondary}
                    />
                </TouchableOpacity>

                {/* Share / Send */}
                <TouchableOpacity 
                    style={styles.actionIconBtn} 
                    activeOpacity={0.7}
                    onPress={async () => {
                        try {
                            const shareUrl = `https://odnix.com/${displayScribe.original_type === 'omzo' ? 'omzo' : 'post'}/${displayScribe.id}`;
                            const message = displayScribe.original_type === 'omzo'
                                ? `Check out this video by @${displayScribe.user?.username} on Odnix: ${displayScribe.content || ''}\n${shareUrl}`
                                : `Check out this post by @${displayScribe.user?.username} on Odnix: ${displayScribe.content || ''}\n${shareUrl}`;
                            
                            await Share.share({
                                message,
                                url: shareUrl,
                            });
                        } catch (error) {
                            console.error('Error sharing:', error);
                        }
                    }}
                >
                    <Icon name="paper-plane-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    repostBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    repostBannerText: {
        fontSize: 12,
        fontWeight: '500',
    },
    originalContentBox: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    originalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    originalAvatarWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        overflow: 'hidden',
    },
    originalAvatar: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    avatarFallback: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    originalDisplayName: {
        fontSize: 13,
        fontWeight: '700',
    },
    originalHandle: {
        fontSize: 12,
    },
    originalContent: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 6,
    },
    originalImage: {
        width: '100%',
        height: 160,
        borderRadius: 8,
        marginTop: 6,
    },
    omzoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    omzoBadgeText: {
        fontSize: 13,
        fontWeight: '500',
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
    cardAvatarFallback: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardAvatarLetter: {
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
    },
    followLinkText: {
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 6,
    },
    dotSep: {
        fontSize: 13,
    },
    timestamp: {
        fontSize: 13,
    },
    handle: {
        fontSize: 13,
        marginTop: 2,
    },
    moreBtn: {
        paddingTop: 2,
    },
    content: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 12,
    },
    hashtag: {
        fontWeight: '500',
    },
    image: {
        width: '100%',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
    },
    windowContainer: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    windowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
    },
    windowDots: {
        flexDirection: 'row',
        gap: 6,
    },
    windowDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    windowTitle: {
        fontSize: 12,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    webviewContainer: {
        overflow: 'hidden',
        borderTopWidth: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    codeBlock: {
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 8,
    },
    codeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomWidth: 1,
    },
    codeLang: {
        fontSize: 12,
        fontWeight: '600',
    },
    codeScroll: {
        padding: 12,
        maxHeight: 400,
    },
    codeText: {
        fontFamily: 'monospace',
        fontSize: 13,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        marginTop: 12,
        borderWidth: 1,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginRight: 16,
    },
    actionCount: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    actionIconBtn: {
        paddingHorizontal: 8,
    },
    originalVideoContainer: {
        position: 'relative',
        width: '100%',
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
    },
    playIconOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
});
