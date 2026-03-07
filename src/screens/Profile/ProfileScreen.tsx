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
import { useRoute, useNavigation } from '@react-navigation/native';
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
    const [isLoading, setIsLoading] = useState(true);
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
                        console.log('Follower count:', response.data.follower_count);
                        console.log('Following count:', response.data.following_count);
                        console.log('Post count:', response.data.post_count);
                        setUser(response.data);

                        // Set scribes and omzos
                        if (response.scribes) {
                            console.log('Setting scribes:', response.scribes.length);
                            setScribes(response.scribes);
                        }
                        if (response.omzos) {
                            console.log('Setting omzos:', response.omzos.length);
                            setOmzos(response.omzos);
                        }
                    } else {
                        console.error('Response not successful or no data:', response);
                    }
                }
                setIsLoading(false);
            } else if (username) {
                const response = await api.getUserProfile(username);
                console.log('User profile response:', JSON.stringify(response, null, 2));
                if (response.success && response.data) {
                    setUser(response.data);
                    // Handle scribes and omzos if returned
                    if (response.scribes) {
                        console.log('Setting scribes:', response.scribes.length);
                        setScribes(response.scribes);
                    }
                    if (response.omzos) {
                        console.log('Setting omzos:', response.omzos.length);
                        setOmzos(response.omzos);
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
                <Text style={[styles.headerUsername, { color: colors.text }]}>@{user.username}</Text>
                {isOwnProfile && (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Settings' as never)}
                        style={styles.headerIcon}
                    >
                        <Icon name="settings-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    {/* Profile Picture */}
                    {hasValidProfilePic ? (
                        <Image
                            source={{ uri: profilePicUri }}
                            style={styles.profileImage}
                        />
                    ) : (
                        <View style={[styles.profileImage, styles.profileImagePlaceholder, { backgroundColor: colors.primary }]}>
                            <Text style={styles.profileImageText}>
                                {user.username?.[0]?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}

                    {/* Name and Username */}
                    <View style={styles.nameContainer}>
                        <Text style={[styles.fullName, { color: colors.text }]}>
                            {user.full_name || user.username}
                        </Text>
                        <Text style={[styles.username, { color: colors.textSecondary }]}>
                            @{user.username}
                        </Text>
                    </View>

                    {/* Bio */}
                    {user.bio && (
                        <Text style={[styles.bio, { color: colors.text }]}>
                            {user.bio}
                        </Text>
                    )}

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.text }]}>
                                {user.post_count || 0}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                Scribes
                            </Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.text }]}>
                                {user.follower_count}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                Followers
                            </Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.text }]}>
                                {user.following_count}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                Following
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    {isOwnProfile ? (
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.editButton, { backgroundColor: colors.primary }]}
                                onPress={() => navigation.navigate('Settings' as never)}
                            >
                                <Text style={styles.editButtonText}>Edit Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.shareButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                                onPress={handleShare}
                            >
                                <Text style={[styles.shareButtonText, { color: colors.text }]}>Share Profile</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={handleFollow}
                            style={[styles.followButton, { backgroundColor: isFollowing ? colors.surface : colors.primary, borderWidth: isFollowing ? 1 : 0, borderColor: colors.border }]}
                        >
                            <Text style={[styles.followButtonText, { color: isFollowing ? colors.text : '#FFFFFF' }]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs */}
                <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'scribes' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                        onPress={() => setActiveTab('scribes')}
                    >
                        <Icon
                            name="grid-outline"
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
                            name="play-circle-outline"
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
                                name="bookmark-outline"
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
                                {omzos.map((omzo) => (
                                    <View
                                        key={omzo.id}
                                        style={styles.omzoThumbnail}
                                    >
                                        <Image
                                            source={{ uri: omzo.thumbnail_url || omzo.video_url || omzo.video_file }}
                                            style={styles.omzoThumbnailImage}
                                        />
                                        <View style={styles.omzoInfo}>
                                            <Icon name="play" size={16} color="#FFFFFF" />
                                            <Text style={styles.omzoViewCount}>
                                                {formatCount(omzo.views || omzo.views_count || 0)}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No omzos yet
                            </Text>
                        )
                    )}
                    {activeTab === 'saved' && (
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No saved items yet
                        </Text>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerUsername: {
        fontSize: 18,
        fontWeight: '600',
    },
    headerIcon: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 12,
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
    nameContainer: {
        marginBottom: 8,
    },
    fullName: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 2,
    },
    username: {
        fontSize: 14,
    },
    bio: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 24,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    editButton: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    shareButton: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    shareButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    followButton: {
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    followButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '500',
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
    errorText: {
        fontSize: 18,
    },
});
