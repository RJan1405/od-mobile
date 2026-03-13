import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
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

export default function ScribeCard({ scribe, onSaveToggle, onPress }: ScribeCardProps) {
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
                repost_count: displayScribe.repost_count || 0
            });
        }
    }, [displayScribe.id, interactions[interactionKey]]);

    const isOwnScribe = currentUser?.username === displayScribe.user?.username;

    const handleLike = async () => {
        const prevInteraction = interaction;

        // Optimistic update
        const newIsLiked = !isLiked;
        const newLikeCount = isLiked ? Math.max(0, likeCount - 1) : likeCount + 1;

        setInteraction('scribe', scribe.id, {
            is_liked: newIsLiked,
            like_count: newLikeCount
        });

        try {
            const response = await api.toggleLike(scribe.id);
            if (response.success) {
                setInteraction('scribe', scribe.id, {
                    is_liked: (response as any).is_liked,
                    like_count: (response as any).like_count,
                    is_disliked: (response as any).is_disliked,
                    dislike_count: (response as any).dislike_count
                });
            } else {
                setInteraction('scribe', scribe.id, prevInteraction);
            }
        } catch {
            setInteraction('scribe', scribe.id, prevInteraction);
        }
    };

    const handleSave = async () => {
        const prevSaved = isSaved;

        // Optimistic update
        setInteraction('scribe', scribe.id, { is_saved: !isSaved });

        try {
            const response = await api.toggleSaveScribe(scribe.id);
            if (response.success) {
                setInteraction('scribe', scribe.id, { is_saved: (response as any).is_saved });
                onSaveToggle?.(scribe.id, (response as any).is_saved);
            } else {
                setInteraction('scribe', scribe.id, { is_saved: prevSaved });
            }
        } catch {
            setInteraction('scribe', scribe.id, { is_saved: prevSaved });
        }
    };

    const handleRepost = async () => {
        const prevInteraction = interaction;

        // Optimistic update in global store
        const newReposted = !isReposted;
        const newCount = isReposted ? Math.max(0, repostCount - 1) : repostCount + 1;

        setInteraction('scribe', displayScribe.id, {
            is_reposted: newReposted,
            repost_count: newCount
        });

        try {
            const response = await api.toggleRepostScribe(displayScribe.id);
            if (response.success) {
                const actualReposted = response.is_reposted ?? newReposted;
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
                    body { margin: 0; padding: 0; }
                    ${displayScribe.code_css || ''}
                </style>
            </head>
            <body>
                ${displayScribe.code_html || ''}
                <script>
                    ${displayScribe.code_js || ''}
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
        <View style={styles.card}>
            {/* Repost Header Banner - Show if this is a repost of any kind */}
            {(isSimpleRepost || isQuoteScribe) && (
                <View style={styles.repostBanner}>
                    <Icon name="repeat-outline" size={14} color="#6B7280" />
                    <Text style={styles.repostBannerText}>
                        {scribe.user?.full_name || scribe.user?.username || 'Someone'} reposted
                    </Text>
                </View>
            )}

            {/* If Quote Scribe, show the original content in a box */}
            {isQuoteScribe && originalScribe && (
                <View style={styles.originalContentBox}>
                    <View style={styles.originalHeader}>
                        <View style={styles.originalAvatarWrap}>
                            {originalScribe.user?.profile_picture_url || originalScribe.user?.avatar ? (
                                <Image source={{ uri: originalScribe.user.profile_picture_url || originalScribe.user.avatar }} style={styles.originalAvatar} />
                            ) : (
                                <View style={[styles.originalAvatar, styles.avatarFallback]}>
                                    <Text style={styles.avatarLetter}>
                                        {originalScribe.user?.username?.[0]?.toUpperCase() || originalScribe.user?.display_name?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View>
                            <Text style={styles.originalDisplayName}>
                                {originalScribe.user?.full_name || originalScribe.user?.display_name || originalScribe.user?.username || 'Unknown'}
                            </Text>
                            <Text style={styles.originalHandle}>@{originalScribe.user?.username || 'unknown'}</Text>
                        </View>
                    </View>
                    {originalScribe.content ? (
                        <Text style={styles.originalContent}>{originalScribe.content}</Text>
                    ) : null}
                    {(originalScribe.media_url || originalScribe.image_url || originalScribe.image) ? (
                        <Image
                            source={{ uri: (originalScribe.media_url || originalScribe.image_url || originalScribe.image)! }}
                            style={styles.originalImage}
                            resizeMode="cover"
                        />
                    ) : null}
                </View>
            )}

            {/* If Quote Scribe of an Omzo, show Omzo preview */}
            {isQuoteScribe && originalOmzo && (
                <View style={styles.originalContentBox}>
                    <View style={styles.originalHeader}>
                        <View style={styles.originalAvatarWrap}>
                            {originalOmzo.user?.profile_picture_url || originalOmzo.user_avatar || originalOmzo.user?.avatar ? (
                                <Image source={{ uri: (originalOmzo.user?.profile_picture_url || originalOmzo.user_avatar || originalOmzo.user?.avatar)! }} style={styles.originalAvatar} />
                            ) : (
                                <View style={[styles.originalAvatar, styles.avatarFallback]}>
                                    <Text style={styles.avatarLetter}>
                                        {(originalOmzo.user?.username || originalOmzo.user?.display_name || originalOmzo.username || '?')[0]?.toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View>
                            <Text style={styles.originalDisplayName}>
                                {originalOmzo.user?.full_name || originalOmzo.user?.display_name || originalOmzo.user?.username || originalOmzo.username || 'Unknown'}
                            </Text>
                            <Text style={styles.originalHandle}>@{originalOmzo.user?.username || originalOmzo.username || 'unknown'}</Text>
                        </View>
                    </View>
                    <View style={styles.omzoBadge}>
                        <Icon name="videocam-outline" size={14} color="#6366F1" />
                        <Text style={styles.omzoBadgeText}>Omzo · {originalOmzo.caption || 'Video'}</Text>
                    </View>
                    {(originalOmzo.video_url || originalOmzo.video_file || originalOmzo.media_url) ? (
                        <View style={styles.originalVideoContainer}>
                            <Video
                                source={{ uri: (originalOmzo.video_url || originalOmzo.video_file || originalOmzo.media_url)! }}
                                style={styles.originalImage}
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
                                <View style={[styles.avatar, styles.cardAvatarFallback]}>
                                    <Text style={styles.cardAvatarLetter}>
                                        {displayScribe.user?.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={styles.headerMid}>
                            <View style={styles.nameRow}>
                                <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.85}>
                                    <Text style={styles.displayName}>
                                        {displayScribe.user?.full_name || displayScribe.user?.username || 'Unknown'}
                                    </Text>
                                </TouchableOpacity>
                                {displayScribe.user?.is_verified && (
                                    <Icon name="checkmark-circle" size={14} color="#3B82F6" style={{ marginLeft: 3 }} />
                                )}
                                {relativeTime ? (
                                    <Text style={styles.dotSep}>·</Text>
                                ) : null}
                                {relativeTime ? (
                                    <Text style={styles.timestamp}>{relativeTime}</Text>
                                ) : null}
                            </View>
                            <Text style={styles.handle}>@{displayScribe.user?.username || 'unknown'}</Text>
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
                    {displayScribe.content ? renderContent(displayScribe.content, '#111827') : null}

                    {/* Code snippets & Live Preview */}
                    {hasCode && (
                        <View style={styles.codeContainer}>
                            <View style={styles.tabContainer}>
                                <TouchableOpacity
                                    style={[styles.tabButton, activeTab === 'preview' && styles.tabButtonActive]}
                                    onPress={() => setActiveTab('preview')}
                                >
                                    <Icon name="play" size={14} color={activeTab === 'preview' ? '#3B82F6' : '#6B7280'} />
                                    <Text style={[styles.tabText, activeTab === 'preview' && styles.tabTextActive]}>Live Preview</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabButton, activeTab === 'code' && styles.tabButtonActive]}
                                    onPress={() => setActiveTab('code')}
                                >
                                    <Icon name="code" size={14} color={activeTab === 'code' ? '#3B82F6' : '#6B7280'} />
                                    <Text style={[styles.tabText, activeTab === 'code' && styles.tabTextActive]}>Source Code</Text>
                                </TouchableOpacity>
                            </View>

                            {activeTab === 'preview' ? (
                                <View style={styles.webviewContainer}>
                                    <WebView
                                        source={{ html: generateHtmlContent() }}
                                        style={styles.webview}
                                        scrollEnabled={false}
                                        showsVerticalScrollIndicator={false}
                                        showsHorizontalScrollIndicator={false}
                                    />
                                </View>
                            ) : (
                                <View>
                                    {displayScribe.code_html ? (
                                        <View style={styles.codeBlock}>
                                            <View style={styles.codeHeader}>
                                                <Text style={styles.codeLang}>HTML</Text>
                                                <Icon name="code-slash" size={14} color="#3B82F6" />
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
                                                <Text style={styles.codeText}>{displayScribe.code_html.trimEnd()}</Text>
                                            </ScrollView>
                                        </View>
                                    ) : null}

                                    {displayScribe.code_css ? (
                                        <View style={styles.codeBlock}>
                                            <View style={styles.codeHeader}>
                                                <Text style={styles.codeLang}>CSS</Text>
                                                <Icon name="color-palette-outline" size={14} color="#10B981" />
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
                                                <Text style={styles.codeText}>{displayScribe.code_css.trimEnd()}</Text>
                                            </ScrollView>
                                        </View>
                                    ) : null}

                                    {displayScribe.code_js ? (
                                        <View style={styles.codeBlock}>
                                            <View style={styles.codeHeader}>
                                                <Text style={styles.codeLang}>JS</Text>
                                                <Icon name="logo-javascript" size={14} color="#F59E0B" />
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeScroll}>
                                                <Text style={styles.codeText}>{displayScribe.code_js.trimEnd()}</Text>
                                            </ScrollView>
                                        </View>
                                    ) : null}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Image */}
                    {hasValidImage && !hasValidVideo && (
                        <ScribeImage uri={imageUri} />
                    )}

                    {/* Video (for Omzo simple reposts) */}
                    {hasValidVideo && (
                        <View style={styles.originalVideoContainer}>
                            <Video
                                source={{ uri: videoUri }}
                                style={styles.originalImage}
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
                        {formatCount(displayScribe.comment_count || 0)}
                    </Text>
                </TouchableOpacity>

                {/* Repost */}
                <TouchableOpacity style={styles.actionBtn} onPress={handleRepost} activeOpacity={0.7}>
                    <Icon
                        name={isReposted ? 'repeat' : 'repeat-outline'}
                        size={20}
                        color={isReposted ? '#10B981' : '#9CA3AF'}
                    />
                    <Text style={[styles.actionCount, isReposted && { color: '#10B981' }]}>
                        {formatCount(repostCount)}
                    </Text>
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
    repostBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    repostBannerText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    originalContentBox: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        backgroundColor: '#F9FAFB',
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
        backgroundColor: '#3B82F6',
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
        color: '#111827',
    },
    originalHandle: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    originalContent: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        marginBottom: 6,
    },
    originalImage: {
        width: '100%',
        height: 160,
        borderRadius: 8,
        marginTop: 6,
        backgroundColor: '#E5E7EB',
    },
    omzoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    omzoBadgeText: {
        fontSize: 13,
        color: '#6366F1',
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
        backgroundColor: '#3B82F6',
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
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: '#F3F4F6', // show light grey background while loading
    },
    codeContainer: {
        marginBottom: 12,
        gap: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 4,
        marginBottom: 4,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 6,
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#3B82F6',
    },
    webviewContainer: {
        height: 400, // Increased height for better visibility
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    codeBlock: {
        backgroundColor: '#F3F4F6',
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
        backgroundColor: '#E5E7EB',
        borderBottomWidth: 1,
        borderBottomColor: '#D1D5DB',
    },
    codeLang: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    codeScroll: {
        padding: 12,
        maxHeight: 400, // Let source code box expand up to 400px
    },
    codeText: {
        fontFamily: 'monospace',
        fontSize: 13,
        color: '#1F2937',
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
