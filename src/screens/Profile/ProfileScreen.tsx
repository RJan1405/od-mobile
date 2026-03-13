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

// Format counts like web version (1K, 1M)
const formatCount = (count: number): string => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
};

export default function ProfileScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors, theme } = useThemeStore();
    const { user: currentUser } = useAuthStore();
    const { username } = (route.params as { username?: string }) || {};

    const [user, setUser] = useState<User | null>(null);
    const [scribes, setScribes] = useState<Scribe[]>([]);
    const [reposts, setReposts] = useState<Scribe[]>([]);
    const [omzos, setOmzos] = useState<Omzo[]>([]);
    const [savedItems, setSavedItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'scribes' | 'reposts' | 'omzos' | 'saved'>('scribes');

    // Global stores — shared across all screens/components
    const { followStates, setFollowState, batchSetFollowStates } = useFollowStore();
    const { interactions, setInteraction } = useInteractionStore();
    const { repostStates, setRepostState } = useRepostStore(); // keep for proxy compatibility if needed elsewhere
    const profileUsername = username || currentUser?.username || '';
    const isFollowing = followStates[profileUsername] ?? false;

    const themeInfo = THEME_INFO[theme];
    const isOwnProfile = !username || username === currentUser?.username;

    useEffect(() => {
        loadProfile();

        const scribePostedListener = DeviceEventEmitter.addListener('SCRIBE_POSTED', () => {
            console.log('🔄 ProfileScreen received SCRIBE_POSTED event. Refreshing...');
            loadProfile();
        });

        return () => {
            scribePostedListener.remove();
        };
    }, [username, currentUser]);

    const loadProfile = async () => {
        setIsLoading(true);
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

                    // Use getFollowStates as single authoritative source (same as ExploreScreen)
                    // Seed initial value from profile response while we wait
                    setFollowState(username, (profileData as any).is_following || false);

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

                        // Update global store — propagates to all mounted subscribers
                        setFollowState(username, nowFollowing);

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
        const newFollowing = !isFollowing;

        // Optimistic update — global store propagates instantly to all subscribers
        setFollowState(profileUsername, newFollowing);
        setUser(prev => prev ? {
            ...prev,
            follower_count: newFollowing ? prev.follower_count + 1 : Math.max(0, prev.follower_count - 1),
        } : null);

        try {
            const response = await api.toggleFollow(user.username);
            if (response.success) {
                // Authoritative server state
                const nowFollowing = (response as any).is_following ?? newFollowing;

                // Update global store with authoritative value
                setFollowState(profileUsername, nowFollowing);

                // Update viewed profile's follower_count
                setUser(prev => prev ? {
                    ...prev,
                    follower_count: nowFollowing
                        ? prev.follower_count + (prevFollowing ? 0 : 1)  // only add if wasn't already following
                        : Math.max(0, prev.follower_count - (prevFollowing ? 1 : 0)),
                } : null);

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
                // Revert on failure
                setFollowState(profileUsername, prevFollowing);
                setUser(prev => prev ? {
                    ...prev,
                    follower_count: prevFollowing
                        ? prev.follower_count + 1
                        : Math.max(0, prev.follower_count - 1),
                } : null);
            }
        } catch {
            setFollowState(profileUsername, prevFollowing);
            setUser(prev => prev ? {
                ...prev,
                follower_count: prevFollowing
                    ? prev.follower_count + 1
                    : Math.max(0, prev.follower_count - 1),
            } : null);
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
                <View>
                    <Text style={[styles.headerName, { color: colors.text }]}>
                        {user.full_name || user.username}
                    </Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={handleShare} style={styles.headerIconWrapper}>
                        <Icon name="share-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
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
                        <Image
                            source={{ uri: (user as any).cover_image_url }}
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
                            <Image
                                source={{ uri: profilePicUri }}
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
                                            backgroundColor: isFollowing ? colors.background : colors.primary,
                                            borderWidth: isFollowing ? 1 : 0,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <Text style={[styles.followButtonText, { color: isFollowing ? colors.text : '#FFFFFF' }]}>
                                        {isFollowing ? 'Following' : 'Follow'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleMessage}
                                    style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }]}
                                >
                                    <Icon name="chatbubble-outline" size={20} color={colors.text} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleCall('voice')}
                                    style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }]}
                                >
                                    <Icon name="call-outline" size={20} color={colors.text} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleCall('video')}
                                    style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 }]}
                                >
                                    <Icon name="videocam-outline" size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* User Info Section */}
                <View style={styles.userInfoSection}>
                    <Text style={[styles.fullNameText, { color: colors.text }]}>
                        {user.full_name || user.username}
                    </Text>
                    <Text style={[styles.usernameText, { color: colors.textSecondary }]}>
                        @{user.username}
                    </Text>

                    {user.bio && (
                        <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text>
                    )}

                    <View style={styles.locationJoinedRow}>
                        <View style={styles.infoItem}>
                            <Icon name="calendar-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Joined 2024</Text>
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
                    {activeTab === 'scribes' && (
                        scribes.length > 0 ? (
                            scribes.map(scribe => (
                                <ScribeCard key={scribe.id} scribe={scribe} />
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
                                                    user: omzo.user,
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
                                                        resizeMode="cover"
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
                                            is_liked: false,
                                            is_disliked: false,
                                            is_saved: true,
                                            original_type: item.original_type,
                                            original_data: item.original_data,
                                        };
                                        return (
                                            <ScribeCard
                                                key={`scribe-${item.id}`}
                                                scribe={scribe}
                                                onSaveToggle={handleScribeSaveToggle}
                                            />
                                        );
                                    } else if (item.type === 'omzo') {
                                        // Inline component for saved omzo with local unsave interaction
                                        const SavedOmzoCard = () => {
                                            const key = `omzo_${item.id}`;
                                            const currentInteraction = interactions[key] || {
                                                is_liked: item.is_liked || false,
                                                is_disliked: item.is_disliked || false,
                                                is_reposted: item.is_reposted || false,
                                                is_saved: item.is_saved || false,
                                                like_count: item.likes || 0,
                                                dislike_count: item.dislikes || 0,
                                                repost_count: item.reposts || 0,
                                            };

                                            const handleUnsave = async () => {
                                                const prevInteraction = { ...currentInteraction };
                                                setInteraction('omzo', item.id, { is_saved: false }); // Optimistic update
                                                try {
                                                    const response = await api.toggleSaveOmzo(item.id);
                                                    if (response.success) {
                                                        handleOmzoSaveToggle(item.id, response.is_saved || false);
                                                        setInteraction('omzo', item.id, { is_saved: response.is_saved }); // Authoritative update
                                                    } else {
                                                        setInteraction('omzo', item.id, prevInteraction); // Revert on failure
                                                    }
                                                } catch (error) {
                                                    console.error('Error unsaving omzo:', error);
                                                    setInteraction('omzo', item.id, prevInteraction); // Revert on failure
                                                }
                                            };

                                            const hasValidAvatar =
                                                item.user?.profile_picture_url &&
                                                item.user.profile_picture_url.startsWith('http');
                                            const hasValidVideo =
                                                item.video_url && item.video_url.startsWith('http');

                                            return (
                                                <View
                                                    style={[
                                                        styles.scribeCard,
                                                        {
                                                            backgroundColor: colors.surface,
                                                            borderColor: colors.border,
                                                        },
                                                    ]}
                                                >
                                                    <View style={styles.scribeHeader}>
                                                        <View style={styles.scribeUserInfo}>
                                                            {hasValidAvatar ? (
                                                                <Image
                                                                    source={{ uri: item.user.profile_picture_url }}
                                                                    style={styles.scribeAvatar}
                                                                />
                                                            ) : (
                                                                <View
                                                                    style={[
                                                                        styles.scribeAvatar,
                                                                        {
                                                                            backgroundColor: colors.primary,
                                                                            justifyContent: 'center',
                                                                            alignItems: 'center',
                                                                        },
                                                                    ]}
                                                                >
                                                                    <Text style={styles.scribeAvatarText}>
                                                                        {item.user?.username?.[0]?.toUpperCase() || 'O'}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            <View>
                                                                <View style={styles.scribeNameRow}>
                                                                    <Text style={[styles.scribeUsername, { color: colors.text }]}>
                                                                        {item.user?.full_name || item.user?.username || 'Unknown'}
                                                                    </Text>
                                                                    {item.user?.is_verified && (
                                                                        <Icon
                                                                            name="checkmark-circle"
                                                                            size={14}
                                                                            color={colors.primary}
                                                                        />
                                                                    )}
                                                                </View>
                                                                <Text style={[styles.scribeTimestamp, { color: colors.textSecondary }]}>
                                                                    @{item.user?.username || 'unknown'} · Omzo Video
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <TouchableOpacity>
                                                            <Icon
                                                                name="ellipsis-horizontal"
                                                                size={20}
                                                                color={colors.textSecondary}
                                                            />
                                                        </TouchableOpacity>
                                                    </View>

                                                    {item.caption && (
                                                        <Text style={[styles.scribeContent, { color: colors.text }]}>
                                                            {item.caption}
                                                        </Text>
                                                    )}

                                                    {hasValidVideo && (
                                                        <TouchableOpacity
                                                            style={styles.scribeImageContainer}
                                                            onPress={() => {
                                                                const transformedOmzo = {
                                                                    id: item.id,
                                                                    user: item.user,
                                                                    video_file: item.video_url,
                                                                    video_url: item.video_url,
                                                                    url: item.video_url,
                                                                    caption: item.caption || '',
                                                                    created_at: item.created_at,
                                                                    views_count: item.views || 0,
                                                                    like_count: item.likes || 0,
                                                                    dislike_count: item.dislikes || 0,
                                                                    comment_count: item.comments || 0,
                                                                    is_liked: currentInteraction.is_liked,
                                                                    is_disliked: currentInteraction.is_disliked,
                                                                    is_saved: currentInteraction.is_saved,
                                                                };
                                                                (navigation as any).navigate('OmzoViewer', { omzo: transformedOmzo });
                                                            }}
                                                            activeOpacity={0.9}
                                                        >
                                                            <Video
                                                                source={{ uri: item.video_url }}
                                                                style={styles.scribeImage}
                                                                paused={true}
                                                                muted={true}
                                                                resizeMode="cover"
                                                                poster={item.video_url}
                                                                posterResizeMode="cover"
                                                            />
                                                            <View style={styles.videoOverlay} pointerEvents="none">
                                                                <View style={styles.playButton}>
                                                                    <Icon name="play" size={32} color="#FFFFFF" />
                                                                </View>
                                                            </View>
                                                        </TouchableOpacity>
                                                    )}

                                                    <View style={[styles.scribeActions, { borderTopColor: `${colors.border}80` }]}>
                                                        {/* Like */}
                                                        <TouchableOpacity
                                                            style={styles.scribeActionButton}
                                                            onPress={async () => {
                                                                const key = `omzo_${item.id}`;
                                                                const currentInteraction = interactions[key] || {
                                                                    is_liked: item.is_liked || false,
                                                                    like_count: item.likes || 0
                                                                };
                                                                const prevInteraction = { ...currentInteraction };

                                                                const newIsLiked = !currentInteraction.is_liked;
                                                                const newLikeCount = currentInteraction.is_liked
                                                                    ? Math.max(0, (currentInteraction.like_count || 0) - 1)
                                                                    : (currentInteraction.like_count || 0) + 1;

                                                                setInteraction('omzo', item.id, {
                                                                    is_liked: newIsLiked,
                                                                    like_count: newLikeCount
                                                                });

                                                                try {
                                                                    const resp = await api.toggleOmzoLike(item.id);
                                                                    if (resp.success) {
                                                                        setInteraction('omzo', item.id, {
                                                                            is_liked: (resp as any).is_liked,
                                                                            like_count: (resp as any).like_count
                                                                        });
                                                                    } else {
                                                                        setInteraction('omzo', item.id, prevInteraction);
                                                                    }
                                                                } catch (err) {
                                                                    setInteraction('omzo', item.id, prevInteraction);
                                                                }
                                                            }}
                                                        >
                                                            <Icon
                                                                name={(interactions[`omzo_${item.id}`]?.is_liked ?? item.is_liked) ? "heart" : "heart-outline"}
                                                                size={20}
                                                                color={(interactions[`omzo_${item.id}`]?.is_liked ?? item.is_liked) ? "#EF4444" : colors.textSecondary}
                                                            />
                                                            <Text style={[styles.scribeActionText, { color: (interactions[`omzo_${item.id}`]?.is_liked ?? item.is_liked) ? "#EF4444" : colors.textSecondary }]}>
                                                                {formatCount(interactions[`omzo_${item.id}`]?.like_count ?? (item.likes || 0))}
                                                            </Text>
                                                        </TouchableOpacity>

                                                        {/* Dislike */}
                                                        <TouchableOpacity
                                                            style={styles.scribeActionButton}
                                                            onPress={async () => {
                                                                const key = `omzo_${item.id}`;
                                                                const currentInteraction = interactions[key] || {
                                                                    is_disliked: item.is_disliked || false,
                                                                    dislike_count: item.dislikes || 0
                                                                };
                                                                const prevInteraction = { ...currentInteraction };

                                                                const newIsDisliked = !currentInteraction.is_disliked;
                                                                const newDislikeCount = currentInteraction.is_disliked
                                                                    ? Math.max(0, (currentInteraction.dislike_count || 0) - 1)
                                                                    : (currentInteraction.dislike_count || 0) + 1;

                                                                setInteraction('omzo', item.id, {
                                                                    is_disliked: newIsDisliked,
                                                                    dislike_count: newDislikeCount
                                                                });

                                                                try {
                                                                    const resp = await api.toggleOmzoDislike(item.id);
                                                                    if (resp.success) {
                                                                        setInteraction('omzo', item.id, {
                                                                            is_disliked: (resp as any).is_disliked,
                                                                            dislike_count: (resp as any).dislike_count
                                                                        });
                                                                    } else {
                                                                        setInteraction('omzo', item.id, prevInteraction);
                                                                    }
                                                                } catch (err) {
                                                                    setInteraction('omzo', item.id, prevInteraction);
                                                                }
                                                            }}
                                                        >
                                                            <Icon
                                                                name={(interactions[`omzo_${item.id}`]?.is_disliked ?? item.is_disliked) ? "thumbs-down" : "thumbs-down-outline"}
                                                                size={20}
                                                                color={(interactions[`omzo_${item.id}`]?.is_disliked ?? item.is_disliked) ? "#EF4444" : colors.textSecondary}
                                                            />
                                                            <Text style={[styles.scribeActionText, { color: (interactions[`omzo_${item.id}`]?.is_disliked ?? item.is_disliked) ? "#EF4444" : colors.textSecondary }]}>
                                                                {formatCount(interactions[`omzo_${item.id}`]?.dislike_count ?? (item.dislikes || 0))}
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <View style={styles.scribeActionButton}>
                                                            <Icon name="chatbubble-outline" size={20} color={colors.textSecondary} />
                                                            <Text style={[styles.scribeActionText, { color: colors.textSecondary }]}>
                                                                {formatCount(item.comments || 0)}
                                                            </Text>
                                                        </View>

                                                        <TouchableOpacity
                                                            style={styles.scribeActionButton}
                                                            onPress={async () => {
                                                                const key = `omzo_${item.id}`;
                                                                const currentInteraction = interactions[key] || {
                                                                    is_reposted: item.is_reposted || false,
                                                                    repost_count: item.reposts || 0
                                                                };
                                                                const prevInteraction = { ...currentInteraction };

                                                                const newReposted = !currentInteraction.is_reposted;
                                                                const newCount = currentInteraction.is_reposted
                                                                    ? Math.max(0, (currentInteraction.repost_count || 0) - 1)
                                                                    : (currentInteraction.repost_count || 0) + 1;

                                                                setInteraction('omzo', item.id, {
                                                                    is_reposted: newReposted,
                                                                    repost_count: newCount
                                                                });

                                                                try {
                                                                    const resp = await api.toggleRepostOmzo(item.id);
                                                                    if (resp.success) {
                                                                        const actual = resp.is_reposted ?? newReposted;
                                                                        setInteraction('omzo', item.id, { is_reposted: actual });
                                                                    } else {
                                                                        setInteraction('omzo', item.id, prevInteraction);
                                                                    }
                                                                } catch (err) {
                                                                    setInteraction('omzo', item.id, prevInteraction);
                                                                }
                                                            }}
                                                        >
                                                            <Icon
                                                                name={(interactions[`omzo_${item.id}`]?.is_reposted ?? item.is_reposted) ? "repeat" : "repeat-outline"}
                                                                size={20}
                                                                color={(interactions[`omzo_${item.id}`]?.is_reposted ?? item.is_reposted) ? "#10B981" : colors.textSecondary}
                                                            />
                                                            <Text style={[styles.scribeActionText, { color: (interactions[`omzo_${item.id}`]?.is_reposted ?? item.is_reposted) ? "#10B981" : colors.textSecondary }]}>
                                                                {formatCount(interactions[`omzo_${item.id}`]?.repost_count ?? (item.reposts || 0))}
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <View style={styles.scribeActionButton}>
                                                            <Icon name="share-social-outline" size={20} color={colors.textSecondary} />
                                                        </View>
                                                        <View style={{ flex: 1 }} />
                                                        <TouchableOpacity
                                                            style={styles.scribeActionButton}
                                                            onPress={handleUnsave}
                                                        >
                                                            <Icon
                                                                name={(interactions[`omzo_${item.id}`]?.is_saved ?? item.is_saved) ? 'bookmark' : 'bookmark-outline'}
                                                                size={20}
                                                                color={(interactions[`omzo_${item.id}`]?.is_saved ?? item.is_saved) ? colors.primary : colors.textSecondary}
                                                            />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        };
                                        return <SavedOmzoCard key={`omzo-${item.id}`} />;
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
                            reposts.map(repost => (
                                <ScribeCard key={repost.id} scribe={repost} />
                            ))
                        ) : (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No reposts yet
                            </Text>
                        )
                    )}
                </View>
            </ScrollView>
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
        borderRadius: 40,
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
});
