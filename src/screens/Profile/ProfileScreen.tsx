import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Share,
    DeviceEventEmitter,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Video from 'react-native-video';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useFollowStore } from '@/stores/followStore';
import { useInteractionStore } from '@/stores/interactionStore';
import { useRepostStore } from '@/stores/repostStore';
import { THEME_INFO } from '@/config';
import api from '@/services/api';
import type { User, Scribe, Omzo } from '@/types';
import ScribeCard from '@/components/ScribeCard';
import OmzoCard from '@/components/OmzoCard';
import ScribeCommentsSheet from '@/components/ScribeCommentsSheet';
import OmzoCommentsSheet from '@/components/OmzoCommentsSheet';

// Format counts like web version (1K, 1M)
const formatCount = (count: number | undefined | null): string => {
    const value = count || 0;
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
};

export default function ProfileScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors, theme } = useThemeStore();
    const { user: currentUser } = useAuthStore();
    const { username } = (route.params as { username?: string }) || {};
    const isOwnProfile = !username || username === currentUser?.username;

    const [user, setUser] = useState<User | null>(isOwnProfile && currentUser ? currentUser : null);
    const [scribes, setScribes] = useState<Scribe[]>([]);
    const [reposts, setReposts] = useState<Scribe[]>([]);
    const [omzos, setOmzos] = useState<Omzo[]>([]);
    const [savedItems, setSavedItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(!user);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'scribes' | 'reposts' | 'omzos' | 'saved'>('scribes');

    // Comment sheet states
    const [isScribeCommentsVisible, setIsScribeCommentsVisible] = useState(false);
    const [isOmzoCommentsVisible, setIsOmzoCommentsVisible] = useState(false);
    const [commentScribeId, setCommentScribeId] = useState<number | null>(null);
    const [commentOmzoId, setCommentOmzoId] = useState<number | null>(null);
    const [commentCountForSheet, setCommentCountForSheet] = useState(0);
    // Global stores — shared across all screens/components
    const { followStates, setFollowState, batchSetFollowStates, getRequestStatus } = useFollowStore();
    const { interactions, setInteraction } = useInteractionStore();
    const { repostStates, setRepostState } = useRepostStore(); // keep for proxy compatibility if needed elsewhere
    const profileUsername = (username || currentUser?.username || '').toLowerCase();
    const isFollowing = followStates[profileUsername] ?? false;
    const followRequestStatus = getRequestStatus(profileUsername) ?? null;

    const themeInfo = THEME_INFO[theme];
    const isPrivate = user?.is_private && !isFollowing && !isOwnProfile;

    useEffect(() => {
        loadProfile();

        const scribePostedListener = DeviceEventEmitter.addListener('SCRIBE_POSTED', () => {
            console.log('🔄 ProfileScreen received SCRIBE_POSTED event. Refreshing...');
            loadProfile();
        });

        const scribeDeletedListener = DeviceEventEmitter.addListener('SCRIBE_DELETED', ({ scribeId }) => {
            console.log('🗑️ ProfileScreen received SCRIBE_DELETED event. ID:', scribeId);
            setScribes(prev => prev.filter(s => s.id !== scribeId));
            setReposts(prev => prev.filter(s => s.id !== scribeId));
            setOmzos(prev => prev.filter(o => o.id !== scribeId));
        });

        return () => {
            scribePostedListener.remove();
            scribeDeletedListener.remove();
        };
    }, [username, currentUser]);

    const loadProfile = async () => {
        if (!user) setIsLoading(true);
        try {
            if (isOwnProfile) {
                if (currentUser?.username) {
                    const response = await api.getUserProfile(currentUser.username);
                    if (response.success && (response.data || response.user)) {
                        const profileData = (response.data || response.user) as User;
                        setUser(profileData);
                        setScribes(response.scribes || []);
                        setReposts(response.reposts || []);
                        setOmzos(response.omzos || []);
                        // Own profile — never following yourself
                        setFollowState(profileUsername, false);
                    } else {
                        console.error('Response not successful or no data:', response);
                    }
                }
                setIsLoading(false);
            } else if (username) {
                const response = await api.getUserProfile(username);
                if (response.success && (response.data || response.user)) {
                    const profileData = (response.data || response.user) as User;
                    setUser(profileData);
                    const initialRequestStatus = (profileData as any).follow_request_status || null;
                    const initialIsFollowing = profileData.is_following ?? false;
                    setFollowState(profileUsername, initialIsFollowing, initialRequestStatus);

                    const scribesRaw = response.scribes || [];
                    const repostsRaw = response.reposts || [];
                    const omzosRaw = response.omzos || [];
                    setScribes(scribesRaw);
                    setReposts(repostsRaw);
                    setOmzos(omzosRaw);

                    // Batch-fetch authoritative follow state for this user
                    api.getFollowStates([username]).then(statesResponse => {
                        const states = (statesResponse as any).follow_states as Record<string, { is_following: boolean }>;
                        if (!statesResponse.success || !states) return;

                        const nowFollowing = states[username]?.is_following ?? (profileData as any).is_following ?? false;
                        const nowRequestStatus = (states[username] as any)?.follow_request_status ?? (profileData as any).follow_request_status ?? null;

                        // Update global store — propagates to all mounted subscribers
                        setFollowState(username, nowFollowing, nowRequestStatus);

                        // Stamp is_following onto every scribe so ScribeCard initializes correctly
                        setScribes(prev => prev.map(s => ({
                            ...s,
                            is_following: nowFollowing,
                            user: { ...s.user, is_following: nowFollowing },
                        })));

                        // Stamp is_following onto every omzo so OmzoViewerScreen initializes correctly
                        setOmzos(prev => prev.map(o => ({
                            ...o,
                            is_following: nowFollowing,
                            user: { ...o.user, is_following: nowFollowing },
                        } as any)));

                        // Stamp is_following onto every repost
                        setReposts(prev => prev.map(s => ({
                            ...s,
                            is_following: nowFollowing,
                            user: { ...s.user, is_following: nowFollowing },
                        })));
                    }).catch(() => {/* non-critical */ });
                }
                setIsLoading(false);
            } else {
                console.log('No username and not own profile');
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            setIsLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!user) return;
        try {
            const response = await api.createChat(user.username);
            if (response.success && response.data?.chatId) {
                (navigation as any).navigate('Chat', { chatId: response.data.chatId });
            }
        } catch (error) {
            console.error('Error creating chat:', error);
        }
    };

    const handleCall = async (type: 'voice' | 'video') => {
        if (!user) return;
        try {
            const response = await api.createChat(user.username);
            if (response.success && response.data?.chatId) {
                const screen = type === 'voice' ? 'VoiceCall' : 'VideoCall';
                (navigation as any).navigate(screen, {
                    user: user,
                    chatId: response.data.chatId,
                });
            }
        } catch (error) {
            console.error('Error creating chat for call:', error);
        }
    };

    const handleFollow = async () => {
        if (!user) return;
        const prevFollowing = isFollowing;
        const prevRequestStatus = followRequestStatus;

        // Only update optimistically for PUBLIC accounts OR when unfollowing
        // For private accounts, we don't want to show "Following" (isFollowing=true) if it's just a request
        const shouldUpdateOptimistically = !user.is_private || isFollowing;
        const newFollowing = !isFollowing;

        if (shouldUpdateOptimistically) {
            setFollowState(profileUsername, newFollowing);
            setUser(prev => prev ? {
                ...prev,
                follower_count: newFollowing ? prev.follower_count + 1 : Math.max(0, prev.follower_count - 1),
            } : null);
        } else if (user.is_private) {
            // For private account follow attempt — show "Requested" optimistically if not already following
            setFollowState(profileUsername, isFollowing, 'pending');
        }

        try {
            const response = await api.toggleFollow(user.username);
            if (response.success) {
                const nowFollowing = (response as any).is_following ?? (shouldUpdateOptimistically ? newFollowing : false);
                const nowRequestStatus = (response as any).follow_request_status || null;

                setFollowState(profileUsername, nowFollowing, nowRequestStatus);

                // Re-sync follower count with authoritative result
                setUser(prev => prev ? {
                    ...prev,
                    follower_count: nowFollowing
                        ? (prevFollowing ? prev.follower_count : prev.follower_count + 1)
                        : (prevFollowing ? Math.max(0, prev.follower_count - 1) : prev.follower_count),
                } : null);

                // Update MY following_count in authStore
                const { user: me, updateUser } = useAuthStore.getState();
                if (me) {
                    updateUser({
                        ...me,
                        following_count: nowFollowing
                            ? me.following_count + (prevFollowing ? 0 : 1)
                            : Math.max(0, me.following_count - (prevFollowing ? 1 : 0)),
                    });
                }
            } else {
                // Revert
                setFollowState(profileUsername, prevFollowing, prevRequestStatus);
            }
        } catch {
            setFollowState(profileUsername, prevFollowing, prevRequestStatus);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out @${user?.username} on Odnix!`,
            });
        } catch (error) {
            console.error('Error sharing profile:', error);
        }
    };

    const loadSavedItems = async () => {
        if (!isOwnProfile) return;
        setIsLoadingSaved(true);
        try {
            const response = await api.getSavedItems();
            if (response.success && (response as any).saved_items) {
                setSavedItems((response as any).saved_items);
            }
        } catch (error) {
            console.error('Error loading saved items:', error);
        } finally {
            setIsLoadingSaved(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'saved' && isOwnProfile) {
            loadSavedItems();
        }
    }, [activeTab]);

    useFocusEffect(
        React.useCallback(() => {
            if (activeTab === 'saved' && isOwnProfile) {
                loadSavedItems();
            }
        }, [activeTab, isOwnProfile])
    );

    const handleScribeSaveToggle = (scribeId: number, isSaved: boolean) => {
        if (!isSaved && activeTab === 'saved') {
            setSavedItems(prev =>
                prev.filter(item => item.type !== 'scribe' || item.id !== scribeId)
            );
        }
    };

    const handleOmzoSaveToggle = (omzoId: number, isSaved: boolean) => {
        if (!isSaved && activeTab === 'saved') {
            setSavedItems(prev =>
                prev.filter(item => item.type !== 'omzo' || item.id !== omzoId)
            );
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <StatusBar
                    barStyle={themeInfo.isDark ? 'light-content' : 'dark-content'}
                    backgroundColor={colors.background}
                />
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    if (!user) {
        return (
            <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <StatusBar
                    barStyle={themeInfo.isDark ? 'light-content' : 'dark-content'}
                    backgroundColor={colors.background}
                />
                <Text style={[styles.errorText, { color: colors.text }]}>User not found</Text>
            </SafeAreaView>
        );
    }

    // Validate profile picture URL
    const profilePicUri = user.profile_picture_url || user.profile_picture || '';
    const hasValidProfilePic =
        profilePicUri &&
        profilePicUri !== 'null' &&
        profilePicUri.trim().length > 0 &&
        profilePicUri.startsWith('http');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={themeInfo.isDark ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.headerName, { color: colors.text }]}>
                        {user.full_name || user.username}
                    </Text>
                    {user.is_verified && (
                        <Icon name="checkmark-circle" size={16} color="#3897f0" style={{ marginLeft: 4 }} />
                    )}
                </View>
                <View style={styles.headerRight}>
                    {/*<TouchableOpacity onPress={handleShare} style={styles.headerIconWrapper}>
                        <Icon name="share-outline" size={24} color={colors.text} />
                    </TouchableOpacity>*/}
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Settings' as never)}
                        style={styles.headerIconWrapper}
                    >
                        <Icon name="settings-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Cover Image Area */}
                <View style={[styles.coverContainer, { backgroundColor: colors.primary + '20' }]}>
                    {(user as any).cover_image_url ? (
                        <FastImage
                            source={{
                                uri: (user as any).cover_image_url,
                                priority: FastImage.priority.normal,
                                cache: FastImage.cacheControl.immutable,
                            }}
                            style={styles.coverImage}
                        />
                    ) : (
                        <View style={[styles.coverPlaceholder, { backgroundColor: colors.primary + '30' }]} />
                    )}
                </View>

                <View style={styles.profileHeaderSection}>
                    {/* Profile Picture (Overlapping) */}
                    <View style={styles.profileImageWrapper}>
                        {hasValidProfilePic ? (
                            <FastImage
                                source={{
                                    uri: profilePicUri,
                                    priority: FastImage.priority.high,
                                    cache: FastImage.cacheControl.immutable,
                                }}
                                style={[styles.profileImage, { borderColor: colors.background, borderWidth: 4 }]}
                            />
                        ) : (
                            <View
                                style={[
                                    styles.profileImage,
                                    styles.profileImagePlaceholder,
                                    { backgroundColor: colors.primary, borderColor: colors.background, borderWidth: 4 },
                                ]}
                            >
                                <Text style={styles.profileImageText}>
                                    {user.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.profileActions}>
                        {isOwnProfile ? (
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.editButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                                    onPress={() => navigation.navigate('EditProfile' as never)}
                                >
                                    <Text style={[styles.editButtonText, { color: colors.text }]}>Edit Profile</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.shareButton, { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }]}
                                    onPress={handleShare}
                                >
                                    <Text style={[styles.shareButtonText, { color: colors.text }]}>Share</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    onPress={handleFollow}
                                    style={[
                                        styles.followButton,
                                        {
                                            backgroundColor: (isFollowing || followRequestStatus === 'pending') ? colors.background : colors.primary,
                                            borderWidth: (isFollowing || followRequestStatus === 'pending') ? 1 : 0,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <Text style={[styles.followButtonText, { color: (isFollowing || followRequestStatus === 'pending') ? colors.text : '#FFFFFF' }]}>
                                        {isFollowing ? 'Following' : followRequestStatus === 'pending' ? 'Requested' : 'Follow'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleMessage}
                                    style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }]}
                                >
                                    <Icon name="chatbubble-outline" size={20} color={colors.text} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleCall('video')}
                                    style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }]}
                                >
                                    <Icon name="videocam-outline" size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {!isOwnProfile && user?.is_requesting_follow && (
                            <View style={[styles.requestActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Text style={[styles.requestText, { color: colors.text }]}>@{user.username} wants to follow you</Text>
                                <View style={styles.requestButtons}>
                                    <TouchableOpacity
                                        style={[styles.requestButton, styles.acceptRequestButton]}
                                        onPress={async () => {
                                            const res = await api.manageFollowRequest(user.username, 'accept');
                                            if (res.success) {
                                                setUser(prev => prev ? { ...prev, is_requesting_follow: false } : null);
                                            }
                                        }}
                                    >
                                        <Text style={styles.requestButtonText}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.requestButton, styles.declineRequestButton, { borderColor: colors.border }]}
                                        onPress={async () => {
                                            const res = await api.manageFollowRequest(user.username, 'decline');
                                            if (res.success) {
                                                setUser(prev => prev ? { ...prev, is_requesting_follow: false } : null);
                                            }
                                        }}
                                    >
                                        <Text style={[styles.requestButtonText, { color: colors.textSecondary }]}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* User Info Section */}
                <View style={styles.userInfoSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={[styles.fullNameText, { color: colors.text }]}>
                            {user.full_name || user.username}
                        </Text>
                        {user.is_verified && (
                            <Icon name="checkmark-circle" size={18} color="#3897f0" style={{ marginLeft: 4 }} />
                        )}
                    </View>
                    <Text style={[styles.usernameText, { color: colors.textSecondary }]}>
                        @{user.username}
                    </Text>

                    {user.bio && (
                        <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text>
                    )}

                    <View style={styles.locationJoinedRow}>
                        <View style={styles.infoItem}>
                            <Icon name="calendar-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Joined {new Date((user as any).date_joined || (user as any).created_at || Date.now()).getFullYear()}</Text>
                        </View>
                        <View style={[styles.infoItem, { marginLeft: 16 }]}>
                            <Icon name="location-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Worldwide</Text>
                        </View>
                    </View>

                    <View style={styles.newStatsRow}>
                        <View style={styles.newStatItem}>
                            <Text style={[styles.newStatValue, { color: colors.text }]}>{user.post_count || 0}</Text>
                            <Text style={[styles.newStatLabel, { color: colors.textSecondary }]}>Posts</Text>
                        </View>
                        <View style={styles.newStatItem}>
                            <Text style={[styles.newStatValue, { color: colors.text }]}>{formatCount(user.follower_count)}</Text>
                            <Text style={[styles.newStatLabel, { color: colors.textSecondary }]}>Followers</Text>
                        </View>
                        <View style={styles.newStatItem}>
                            <Text style={[styles.newStatValue, { color: colors.text }]}>{formatCount(user.following_count)}</Text>
                            <Text style={[styles.newStatLabel, { color: colors.textSecondary }]}>Following</Text>
                        </View>
                    </View>
                </View>

                {/* Tabs */}
                <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'scribes' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                        onPress={() => setActiveTab('scribes')}
                    >
                        <Icon
                            name={activeTab === 'scribes' ? 'grid' : 'grid-outline'}
                            size={20}
                            color={activeTab === 'scribes' ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.tabLabel, { color: activeTab === 'scribes' ? colors.primary : colors.textSecondary }]}>
                            Scribes
                        </Text>
                    </TouchableOpacity>



                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'omzos' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                        onPress={() => setActiveTab('omzos')}
                    >
                        <Icon
                            name={activeTab === 'omzos' ? 'film' : 'film-outline'}
                            size={20}
                            color={activeTab === 'omzos' ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.tabLabel, { color: activeTab === 'omzos' ? colors.primary : colors.textSecondary }]}>
                            Omzos
                        </Text>
                    </TouchableOpacity>

                    {isOwnProfile && (
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'saved' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                            onPress={() => setActiveTab('saved')}
                        >
                            <Icon
                                name={activeTab === 'saved' ? 'bookmark' : 'bookmark-outline'}
                                size={20}
                                color={activeTab === 'saved' ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[styles.tabLabel, { color: activeTab === 'saved' ? colors.primary : colors.textSecondary }]}>
                                Saved
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'reposts' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                        onPress={() => setActiveTab('reposts')}
                    >
                        <Icon
                            name={activeTab === 'reposts' ? 'repeat' : 'repeat-outline'}
                            size={20}
                            color={activeTab === 'reposts' ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.tabLabel, { color: activeTab === 'reposts' ? colors.primary : colors.textSecondary }]}>
                            Reposts
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <View style={styles.content}>
                    {isPrivate ? (
                        <View style={styles.privateContainer}>
                            <View style={[styles.privateIconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Icon name="lock-closed" size={40} color={colors.text} />
                            </View>
                            <Text style={[styles.privateTitle, { color: colors.text }]}>This account is private</Text>
                            <Text style={[styles.privateSubtitle, { color: colors.textSecondary }]}>
                                Follow this account to see their scribes and omzos.
                            </Text>
                        </View>
                    ) : (
                        <>
                            {activeTab === 'scribes' && (
                                scribes.length > 0 ? (
                                    scribes.map(scribe => (
                                        <ScribeCard
                                            key={scribe.id}
                                            scribe={scribe}
                                            onCommentPress={() => {
                                                setCommentScribeId(scribe.id);
                                                setCommentCountForSheet(scribe.comment_count || 0);
                                                setIsScribeCommentsVisible(true);
                                            }}
                                        />
                                    ))
                                ) : (
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No scribes yet
                                    </Text>
                                )
                            )}



                            {activeTab === 'omzos' && (
                                omzos.length > 0 ? (
                                    <View style={styles.omzosGrid}>
                                        {omzos.map(omzo => {
                                            const videoUri = omzo.video_url || omzo.video_file || '';
                                            const hasValidVideo =
                                                videoUri &&
                                                videoUri !== 'null' &&
                                                videoUri.trim().length > 0 &&
                                                videoUri.startsWith('http');

                                            return (
                                                <TouchableOpacity
                                                    key={omzo.id}
                                                    style={styles.omzoThumbnail}
                                                    onPress={() => {
                                                        console.log('Omzo clicked:', omzo.id);
                                                        const transformedOmzo = {
                                                            id: omzo.id,
                                                            user: omzo.user || (user as any),
                                                            video_file: videoUri,
                                                            video_url: videoUri,
                                                            url: videoUri,
                                                            caption: omzo.caption || '',
                                                            created_at: omzo.created_at,
                                                            views_count: omzo.views || omzo.views_count || 0,
                                                            like_count: omzo.likes || omzo.like_count || 0,
                                                            dislike_count: omzo.dislikes || omzo.dislike_count || 0,
                                                            comment_count: omzo.comments || omzo.comment_count || 0,
                                                            is_liked: omzo.is_liked || false,
                                                            is_disliked: omzo.is_disliked || false,
                                                            is_saved: omzo.is_saved || false,
                                                            is_muted: !!(omzo as any).is_muted,
                                                            // Pass follow state so OmzoViewerScreen initializes correctly
                                                            is_following: (omzo as any).is_following ?? isFollowing,
                                                        };
                                                        (navigation as any).navigate('OmzoViewer', { omzo: transformedOmzo });
                                                    }}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={styles.omzoThumbnailImage} pointerEvents="none">
                                                        {hasValidVideo ? (
                                                            <Video
                                                                source={{ uri: videoUri }}
                                                                style={{ width: '100%', height: '100%' }}
                                                                paused={true}
                                                                muted={true}
                                                                resizeMode="contain"
                                                                poster={videoUri}
                                                                posterResizeMode="cover"
                                                            />
                                                        ) : (
                                                            <View
                                                                style={[
                                                                    {
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        backgroundColor: colors.border,
                                                                        justifyContent: 'center',
                                                                        alignItems: 'center',
                                                                    },
                                                                ]}
                                                            >
                                                                <Icon name="videocam" size={40} color={colors.textSecondary} />
                                                            </View>
                                                        )}
                                                    </View>
                                                    {omzo.is_saved && (
                                                        <View style={styles.savedBadge} pointerEvents="none">
                                                            <Icon name="bookmark" size={16} color="#FFFFFF" />
                                                        </View>
                                                    )}
                                                    <View style={styles.omzoInfo} pointerEvents="none">
                                                        <Icon name="play" size={16} color="#FFFFFF" />
                                                        <Text style={styles.omzoViewCount}>
                                                            {formatCount(omzo.views || omzo.views_count || 0)}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No omzos yet
                                    </Text>
                                )
                            )}

                            {activeTab === 'saved' && (
                                isLoadingSaved ? (
                                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                                ) : savedItems.length > 0 ? (
                                    <View>
                                        {savedItems.map(item => {
                                            if (item.type === 'scribe') {
                                                // Transform saved item to Scribe format
                                                const scribe: Scribe = {
                                                    id: Number(item.id),
                                                    user: {
                                                        ...item.user,
                                                        id: Number(item.user.id),
                                                    } as User,
                                                    content: item.content || '',
                                                    content_type: item.media_type || 'text',
                                                    image_url: item.image_url || '',
                                                    createdAt: item.created_at,
                                                    code_html: item.code_html || '',
                                                    code_css: item.code_css || '',
                                                    code_js: item.code_js || '',
                                                    like_count: item.likes || 0,
                                                    dislike_count: item.dislikes || 0,
                                                    comment_count: item.comments || 0,
                                                    repost_count: item.reposts || 0,
                                                    is_liked: item.is_liked || false,
                                                    is_disliked: item.is_disliked || false,
                                                    is_saved: true,
                                                    original_type: item.original_type,
                                                    original_data: item.original_data,
                                                };
                                                return (
                                                    <ScribeCard
                                                        key={`scribe-${item.id}`}
                                                        scribe={scribe}
                                                        onSaveToggle={handleScribeSaveToggle}
                                                        onCommentPress={() => {
                                                            setCommentScribeId(scribe.id);
                                                            setCommentCountForSheet(scribe.comment_count);
                                                            setIsScribeCommentsVisible(true);
                                                        }}
                                                    />
                                                );
                                            } else if (item.type === 'omzo') {
                                                const scribeOmzo: Scribe = {
                                                    id: Number(item.id),
                                                    user: {
                                                        ...item.user,
                                                        id: Number(item.user.id),
                                                    } as User,
                                                    content: item.caption || '',
                                                    content_type: 'video',
                                                    media_url: item.video_url || '',
                                                    image_url: item.video_url || '',
                                                    createdAt: item.created_at,
                                                    like_count: item.likes || 0,
                                                    dislike_count: item.dislikes || 0,
                                                    comment_count: item.comments || 0,
                                                    repost_count: item.reposts || 0,
                                                    is_liked: item.is_liked || false,
                                                    is_disliked: item.is_disliked || false,
                                                    is_saved: true,
                                                    original_type: 'omzo',
                                                };
                                                return (
                                                    <ScribeCard
                                                        key={`omzo-${item.id}`}
                                                        scribe={scribeOmzo}
                                                        onSaveToggle={handleOmzoSaveToggle}
                                                        onCommentPress={() => {
                                                            setCommentOmzoId(scribeOmzo.id);
                                                            setCommentCountForSheet(scribeOmzo.comment_count);
                                                            setIsOmzoCommentsVisible(true);
                                                        }}
                                                        onPress={() => {
                                                            (navigation as any).navigate('OmzoViewer', { omzo: item });
                                                        }}
                                                    />
                                                );

                                            }
                                            return null;
                                        })}
                                    </View>
                                ) : (
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No saved items yet
                                    </Text>
                                )
                            )}
                            {activeTab === 'reposts' && (
                                reposts.length > 0 ? (
                                    reposts.map(repost => {
                                        // If repost is a simple repost, pass the original content as scribe
                                        const isSimpleRepost = !!(repost.original_scribe || repost.original_omzo || (repost.original_type && repost.original_data) || repost.is_repost) && !repost.content;
                                        let scribeToShow = repost;
                                        if (isSimpleRepost) {
                                            // Prefer original_scribe, then original_omzo, then original_data, then fallback
                                            scribeToShow = repost.original_scribe || repost.original_omzo || repost.original_data || repost;
                                            // Ensure follow state is preserved from repost wrapper if missing
                                            if (scribeToShow && repost.user && scribeToShow.user && scribeToShow.user.username === repost.user.username) {
                                                scribeToShow = {
                                                    ...scribeToShow,
                                                    is_following: repost.is_following,
                                                    user: { ...scribeToShow.user, is_following: repost.is_following }
                                                };
                                            }
                                        }
                                        return (
                                            <ScribeCard
                                                key={repost.id}
                                                scribe={scribeToShow}
                                                onCommentPress={() => {
                                                    const isOmzo = !!(repost.original_omzo || (repost.original_type === 'omzo' && repost.original_data));
                                                    if (isOmzo) {
                                                        const id = repost.original_omzo?.id || repost.original_data?.id || repost.id;
                                                        setCommentOmzoId(id);
                                                        setIsOmzoCommentsVisible(true);
                                                    } else {
                                                        const id = repost.original_scribe?.id || repost.original_data?.id || repost.id;
                                                        setCommentScribeId(id);
                                                        setIsScribeCommentsVisible(true);
                                                    }
                                                    setCommentCountForSheet(scribeToShow.comment_count || 0);
                                                }}
                                                onPress={() => {
                                                    const isOmzo = !!(repost.original_omzo || (repost.original_type === 'omzo' && repost.original_data));
                                                    if (isOmzo) {
                                                        const omzoData = repost.original_omzo || (repost.original_type === 'omzo' ? repost.original_data : null);
                                                        if (omzoData) {
                                                            (navigation as any).navigate('OmzoViewer', { omzo: omzoData });
                                                        }
                                                    }
                                                }}
                                            />
                                        );
                                    })
                                ) : (
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No reposts yet
                                    </Text>
                                )
                            )}
                        </>
                    )}
                </View>
            </ScrollView>

            {/* Comment Sheets */}
            {commentScribeId && (
                <ScribeCommentsSheet
                    isVisible={isScribeCommentsVisible}
                    onClose={() => {
                        setIsScribeCommentsVisible(false);
                        setCommentScribeId(null);
                    }}
                    scribeId={commentScribeId}
                    initialCommentCount={commentCountForSheet}
                />
            )}
            {commentOmzoId && (
                <OmzoCommentsSheet
                    isVisible={isOmzoCommentsVisible}
                    onClose={() => {
                        setIsOmzoCommentsVisible(false);
                        setCommentOmzoId(null);
                    }}
                    omzoId={commentOmzoId}
                    initialCommentCount={commentCountForSheet}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerName: {
        fontSize: 16,
        fontWeight: '700',
    },
    headerPostCount: {
        fontSize: 12,
    },
    coverContainer: {
        height: 120,
        width: '100%',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    coverPlaceholder: {
        width: '100%',
        height: '100%',
    },
    profileHeaderSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        marginTop: -40,
    },
    profileImageWrapper: {
        padding: 4,
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 16,
    },
    profileImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileImageText: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: '700',
    },
    profileActions: {
        marginBottom: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    shareButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    shareButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    followButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    followButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfoSection: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
    },
    fullNameText: {
        fontSize: 18,
        fontWeight: '700',
    },
    usernameText: {
        fontSize: 14,
        marginTop: 2,
    },
    bioText: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
    },
    locationJoinedRow: {
        flexDirection: 'row',
        marginTop: 8,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    infoText: {
        fontSize: 13,
    },
    newStatsRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 20,
    },
    newStatItem: {
        alignItems: 'center',
    },
    newStatValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    newStatLabel: {
        fontSize: 12,
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    content: {
        paddingBottom: 80,
        marginTop: 12,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 15,
    },
    omzosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 1,
    },
    omzoThumbnail: {
        width: '33.33%',
        aspectRatio: 9 / 16,
        padding: 1,
        position: 'relative',
    },
    omzoThumbnailImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111',
    },
    savedBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
    },
    omzoInfo: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    omzoViewCount: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 18,
    },
    // Saved omzo card styles
    scribeCard: {
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    scribeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    scribeUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    scribeAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    scribeAvatarText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    scribeNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    scribeUsername: {
        fontSize: 15,
        fontWeight: '600',
    },
    scribeTimestamp: {
        fontSize: 13,
        marginTop: 2,
    },
    scribeContent: {
        fontSize: 15,
        lineHeight: 20,
        marginBottom: 12,
    },
    scribeImageContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        position: 'relative',
    },
    scribeImage: {
        width: '100%',
        height: 200,
    },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    playButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scribeActions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
    },
    scribeActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    scribeActionText: {
        fontSize: 13,
        marginLeft: 4,
    },
    headerIconWrapper: {
        marginLeft: 15,
        padding: 5,
    },
    privateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    privateIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    privateTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    privateSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    requestActionCard: {
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    requestText: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    requestButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    requestButton: {
        paddingHorizontal: 24,
        paddingVertical: 8,
        borderRadius: 8,
        marginHorizontal: 6,
    },
    acceptRequestButton: {
        backgroundColor: '#3B82F6',
    },
    declineRequestButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    requestButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
