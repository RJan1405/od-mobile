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
} from 'react-native';
import Video from 'react-native-video';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
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
    const [omzos, setOmzos] = useState<Omzo[]>([]);
    const [savedItems, setSavedItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [activeTab, setActiveTab] = useState<'scribes' | 'omzos' | 'saved'>('scribes');
    const [postCount, setPostCount] = useState(0);

    const themeInfo = THEME_INFO[theme];
    const isOwnProfile = !username || username === currentUser?.username;

    useEffect(() => {
        loadProfile();
    }, [username, currentUser]);

    const loadProfile = async () => {
        setIsLoading(true);
        try {
            if (isOwnProfile) {
                // Use getUserProfile with currentUser's username to get scribes and omzos
                if (currentUser?.username) {
                    const response = await api.getUserProfile(currentUser.username);
                    console.log('====== PROFILE API RESPONSE ======');
                    console.log('Full response:', JSON.stringify(response, null, 2));
                    console.log('Success?:', response.success);
                    console.log('Has data?:', !!response.data);

                    if (response.success && response.data) {
                        console.log('Setting user data...');
                        setUser(response.data);

                        if (response.scribes) {
                            setScribes(response.scribes);
                        } else {
                            setScribes([]);
                        }

                        if (response.omzos) {
                            setOmzos(response.omzos);
                        } else {
                            setOmzos([]);
                        }
                    } else {
                        console.error('Response not successful or no data:', response);
                    }
                }
                setIsLoading(false);
            } else if (username) {
                const response = await api.getUserProfile(username);
                if (response.success && response.data) {
                    setUser(response.data);
                    if (response.scribes) {
                        setScribes(response.scribes);
                    } else {
                        setScribes([]);
                    }

                    if (response.omzos) {
                        setOmzos(response.omzos);
                    } else {
                        setOmzos([]);
                    }
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

    const handleFollow = async () => {
        if (!user) return;

        try {
            const response = await api.toggleFollow(user.username);
            if (response.success) {
                setIsFollowing(!isFollowing);
                setUser(prev => prev ? {
                    ...prev,
                    follower_count: isFollowing ? prev.follower_count - 1 : prev.follower_count + 1,
                } : null);
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
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
            console.log('📌 Saved items response:', response);
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

    // Reload saved items when screen gains focus
    useFocusEffect(
        React.useCallback(() => {
            if (activeTab === 'saved' && isOwnProfile) {
                loadSavedItems();
            }
        }, [activeTab, isOwnProfile])
    );

    // Handle save toggle callback from ScribeCard
    const handleScribeSaveToggle = (scribeId: number, isSaved: boolean) => {
        if (!isSaved && activeTab === 'saved') {
            // Remove from saved items if unsaved
            setSavedItems(prev => prev.filter(item => item.type !== 'scribe' || item.id !== scribeId));
        }
    };

    // Handle save toggle callback from saved omzo display
    const handleOmzoSaveToggle = (omzoId: number, isSaved: boolean) => {
        if (!isSaved && activeTab === 'saved') {
            // Remove from saved items if unsaved
            setSavedItems(prev => prev.filter(item => item.type !== 'omzo' || item.id !== omzoId));
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
    const hasValidProfilePic = profilePicUri && profilePicUri !== 'null' && profilePicUri.trim().length > 0 && profilePicUri.startsWith('http');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={themeInfo.isDark ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View>
                    <Text style={[styles.headerName, { color: colors.text }]}>{user.full_name || user.username}</Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={handleShare} style={styles.headerIconWrapper}>
                        <Icon name="share-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings' as never)} style={styles.headerIconWrapper}>
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
                            <View style={[styles.profileImage, styles.profileImagePlaceholder, { backgroundColor: colors.primary, borderColor: colors.background, borderWidth: 4 }]}>
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
                            <TouchableOpacity
                                onPress={handleFollow}
                                style={[styles.followButton, { backgroundColor: isFollowing ? colors.background : colors.primary, borderWidth: isFollowing ? 1 : 0, borderColor: colors.border }]}
                            >
                                <Text style={[styles.followButtonText, { color: isFollowing ? colors.text : '#FFFFFF' }]}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
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
                        <Text style={[styles.bioText, { color: colors.text }]}>
                            {user.bio}
                        </Text>
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
                            name={activeTab === 'scribes' ? "grid" : "grid-outline"}
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
                            name={activeTab === 'omzos' ? "film" : "film-outline"}
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
                                name={activeTab === 'saved' ? "bookmark" : "bookmark-outline"}
                                size={20}
                                color={activeTab === 'saved' ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[styles.tabLabel, { color: activeTab === 'saved' ? colors.primary : colors.textSecondary }]}>
                                Saved
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {activeTab === 'scribes' && (
                        scribes.length > 0 ? (
                            scribes.map((scribe) => (
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
                                {omzos.map((omzo) => {
                                    const videoUri = omzo.video_url || omzo.video_file || '';
                                    const hasValidVideo = videoUri &&
                                        videoUri !== 'null' &&
                                        videoUri.trim().length > 0 &&
                                        videoUri.startsWith('http');

                                    return (
                                        <TouchableOpacity
                                            key={omzo.id}
                                            style={styles.omzoThumbnail}
                                            onPress={() => {
                                                console.log('Omzo clicked:', omzo.id);
                                                // Navigate to OmzoViewer with transformed data
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
                                                    <View style={[{ width: '100%', height: '100%', backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
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
                                {savedItems.map((item) => {
                                    if (item.type === 'scribe') {
                                        // Transform saved item to Scribe format
                                        const scribe: Scribe = {
                                            id: item.id.toString(),
                                            user: {
                                                ...item.user,
                                                id: Number(item.user.id),
                                            } as User,
                                            content: item.content || '',
                                            content_type: item.media_type || 'text',
                                            image_url: item.image_url || '',
                                            created_at: item.created_at,
                                            like_count: item.likes || 0,
                                            dislike_count: item.dislikes || 0,
                                            comment_count: item.comments || 0,
                                            repost_count: item.reposts || 0,
                                            is_liked: false,
                                            is_disliked: false,
                                            is_saved: true,
                                        };
                                        return <ScribeCard key={`scribe-${item.id}`} scribe={scribe} onSaveToggle={handleScribeSaveToggle} />;
                                    } else if (item.type === 'omzo') {
                                        // Display omzo in scribe card format with interactive save
                                        const SavedOmzoCard = () => {
                                            const [localIsSaved, setLocalIsSaved] = useState(true);

                                            const handleUnsave = async () => {
                                                setLocalIsSaved(false);
                                                try {
                                                    const response = await api.toggleSaveOmzo(item.id);
                                                    if (response.success) {
                                                        handleOmzoSaveToggle(item.id, response.is_saved || false);
                                                    } else {
                                                        setLocalIsSaved(true);
                                                    }
                                                } catch (error) {
                                                    console.error('Error unsaving omzo:', error);
                                                    setLocalIsSaved(true);
                                                }
                                            };

                                            const hasValidAvatar = item.user?.profile_picture_url &&
                                                item.user.profile_picture_url.startsWith('http');
                                            const hasValidVideo = item.video_url && item.video_url.startsWith('http');

                                            return (
                                                <View
                                                    style={[styles.scribeCard, {
                                                        backgroundColor: colors.surface,
                                                        borderColor: colors.border
                                                    }]}
                                                >
                                                    <View style={styles.scribeHeader}>
                                                        <View style={styles.scribeUserInfo}>
                                                            {hasValidAvatar ? (
                                                                <Image
                                                                    source={{ uri: item.user.profile_picture_url }}
                                                                    style={styles.scribeAvatar}
                                                                />
                                                            ) : (
                                                                <View style={[styles.scribeAvatar, {
                                                                    backgroundColor: colors.primary,
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center'
                                                                }]}>
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
                                                                        <Icon name="checkmark-circle" size={14} color={colors.primary} />
                                                                    )}
                                                                </View>
                                                                <Text style={[styles.scribeTimestamp, { color: colors.textSecondary }]}>
                                                                    @{item.user?.username || 'unknown'} · Omzo Video
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <TouchableOpacity>
                                                            <Icon name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
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
                                                                // Navigate to OmzoViewer with transformed data
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
                                                                    is_liked: item.is_liked || false,
                                                                    is_disliked: item.is_disliked || false,
                                                                    is_saved: localIsSaved,
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
                                                        <View style={styles.scribeActionButton}>
                                                            <Icon name="heart-outline" size={20} color={colors.textSecondary} />
                                                            <Text style={[styles.scribeActionText, { color: colors.textSecondary }]}>
                                                                {formatCount(item.likes || 0)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.scribeActionButton}>
                                                            <Icon name="thumbs-down-outline" size={20} color={colors.textSecondary} />
                                                            <Text style={[styles.scribeActionText, { color: colors.textSecondary }]}>
                                                                {formatCount(item.dislikes || 0)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.scribeActionButton}>
                                                            <Icon name="chatbubble-outline" size={20} color={colors.textSecondary} />
                                                            <Text style={[styles.scribeActionText, { color: colors.textSecondary }]}>
                                                                {formatCount(item.comments || 0)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.scribeActionButton}>
                                                            <Icon name="repeat-outline" size={20} color={colors.textSecondary} />
                                                            <Text style={[styles.scribeActionText, { color: colors.textSecondary }]}>
                                                                {formatCount(item.reposts || 0)}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.scribeActionButton}>
                                                            <Icon name="share-social-outline" size={20} color={colors.textSecondary} />
                                                        </View>
                                                        <View style={{ flex: 1 }} />
                                                        <TouchableOpacity style={styles.scribeActionButton} onPress={handleUnsave}>
                                                            <Icon
                                                                name={localIsSaved ? "bookmark" : "bookmark-outline"}
                                                                size={20}
                                                                color={localIsSaved ? colors.primary : colors.textSecondary}
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
        borderRadius: 12,
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
    userInfoSection: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 20,
    },
    fullNameText: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 2,
    },
    usernameText: {
        fontSize: 15,
        marginBottom: 12,
    },
    bioText: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 16,
    },
    locationJoinedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 14,
    },
    newStatsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    newStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    newStatValue: {
        fontSize: 16,
        fontWeight: '800',
    },
    newStatLabel: {
        fontSize: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        paddingHorizontal: 16,
        height: 38,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    shareButton: {
        paddingHorizontal: 16,
        height: 38,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    followButton: {
        paddingHorizontal: 24,
        height: 38,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    followButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    tabLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    content: {
        paddingVertical: 10,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 40,
        textAlign: 'center',
    },
    omzosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
    },
    omzoThumbnail: {
        width: '33.33%',
        aspectRatio: 9 / 16,
        position: 'relative',
        padding: 1,
    },
    omzoThumbnailImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    omzoInfo: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    omzoViewCount: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    savedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 12,
        padding: 4,
    },
    // Scribe card styles (reused for saved omzos)
    scribeCard: {
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
    },
    scribeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    scribeUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    scribeAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
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
    errorText: {
        fontSize: 18,
    },
    headerIconWrapper: {
        marginLeft: 15,
        padding: 5,
    },
});
