import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Image,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    ScrollView,
    Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';
import ScribeCard from '@/components/ScribeCard';
import type { User, Scribe, Omzo } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ExploreItem = {
    type: 'scribe' | 'omzo' | 'person' | 'group';
    id: string | number;
    data: any;
};

export default function ExploreScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [exploreFeed, setExploreFeed] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFeed, setIsLoadingFeed] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadExploreFeed();
    }, []);

    const loadExploreFeed = async (page: number = 1) => {
        if (isLoadingFeed) return;

        setIsLoadingFeed(true);
        try {
            const response = await api.getExploreFeed(page);
            console.log('📦 Explore Feed Response:', JSON.stringify(response, null, 2));

            if (response.success && response.results) {
                const newItems = page === 1 ? response.results : [...exploreFeed, ...response.results];
                setExploreFeed(newItems);
                setHasMore(response.has_more || false);
                setCurrentPage(page);
            } else {
                // If request fails or no results, set empty array for page 1
                if (page === 1) {
                    setExploreFeed([]);
                }
                setHasMore(false);
            }
        } catch (error) {
            console.error('❌ Error loading explore feed:', error);
            if (page === 1) {
                setExploreFeed([]);
            }
            setHasMore(false);
        } finally {
            setIsLoadingFeed(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadExploreFeed(1);
        setIsRefreshing(false);
    };

    const handleLoadMore = () => {
        if (!isLoadingFeed && hasMore && !searchQuery) {
            loadExploreFeed(currentPage + 1);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);

        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await api.globalSearch(query);
            console.log('🔍 Search Response:', JSON.stringify(response, null, 2));

            if (response.success && response.results) {
                setSearchResults(response.results);
            }
        } catch (error) {
            console.error('❌ Error searching:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFollowUser = async (username: string) => {
        try {
            await api.toggleFollow(username);
            // Refresh the item in results
            if (searchQuery) {
                handleSearch(searchQuery);
            }
        } catch (error) {
            console.error('Error following user:', error);
        }
    };

    const renderSearchResultItem = ({ item }: { item: any }) => {
        if (item.type === 'person') {
            const hasAvatar = item.image_url && item.image_url.trim() !== '' && item.image_url.startsWith('http');
            return (
                <TouchableOpacity
                    style={[styles.resultItem, { backgroundColor: colors.surface }]}
                    onPress={() => navigation.navigate('Profile' as never, { userId: item.id } as never)}
                >
                    {hasAvatar ? (
                        <Image
                            source={{ uri: item.image_url }}
                            style={styles.userAvatar}
                        />
                    ) : (
                        <View style={[styles.userAvatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
                                {item.title?.[0]?.toUpperCase() || 'U'}
                            </Text>
                        </View>
                    )}
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[styles.userUsername, { color: colors.textSecondary }]}>
                            {item.subtitle}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.followButton, { backgroundColor: colors.primary }]}
                        onPress={() => handleFollowUser(item.data?.username || '')}
                    >
                        <Text style={styles.followButtonText}>Follow</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            );
        }

        if (item.type === 'group') {
            return (
                <TouchableOpacity style={[styles.resultItem, { backgroundColor: colors.surface }]}>
                    <View style={[styles.groupIcon, { backgroundColor: colors.primary }]}>
                        <Icon name="people" size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[styles.userUsername, { color: colors.textSecondary }]}>
                            {item.subtitle}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }

        if (item.type === 'scribe' || item.type === 'post') {
            return (
                <View style={styles.scribeResult}>
                    <View style={styles.searchResultHeader}>
                        <Icon name="document-text" size={16} color={colors.primary} />
                        <Text style={[styles.resultType, { color: colors.textSecondary }]}>Post</Text>
                    </View>
                    <Text style={[styles.resultContent, { color: colors.text }]} numberOfLines={3}>
                        {item.subtitle}
                    </Text>
                </View>
            );
        }

        if (item.type === 'omzo') {
            return (
                <View style={styles.scribeResult}>
                    <View style={styles.searchResultHeader}>
                        <Icon name="videocam" size={16} color={colors.primary} />
                        <Text style={[styles.resultType, { color: colors.textSecondary }]}>Omzo</Text>
                    </View>
                    <Text style={[styles.resultContent, { color: colors.text }]} numberOfLines={2}>
                        {item.subtitle}
                    </Text>
                </View>
            );
        }

        return null;
    };

    const renderExploreFeedItem = ({ item }: { item: any }) => {
        if (item.type === 'scribe') {
            // Transform the explore feed item to Scribe format
            const scribe: Scribe = {
                id: parseInt(item.id),
                user: {
                    id: parseInt(item.user.id),
                    username: item.user.username,
                    full_name: item.user.displayName,
                    profile_picture_url: item.user.avatar,
                    is_verified: item.user.isVerified,
                },
                content: item.content || '',
                image_url: item.mediaUrl,
                content_type: item.scribeType || 'text',
                timestamp: item.createdAt,
                like_count: item.likes || 0,
                dislike_count: item.dislikes || 0,
                comment_count: item.comments || 0,
                repost_count: item.reposts || 0,
                is_liked: item.isLiked || false,
                is_disliked: item.isDisliked || false,
                is_saved: item.isSaved || false,
                code_html: item.code_html || '',
                code_css: item.code_css || '',
                code_js: item.code_js || '',
            };

            return <ScribeCard key={`scribe-${item.id}`} scribe={scribe} />;
        }

        if (item.type === 'omzo') {
            // Render omzo as a video card
            const hasAvatar = item.user?.avatar && item.user.avatar.trim() !== '' && item.user.avatar.startsWith('http');
            return (
                <TouchableOpacity
                    key={`omzo-${item.id}`}
                    style={[styles.omzoCard, { backgroundColor: colors.surface }]}
                    onPress={() => navigation.navigate('Omzo' as never)}
                >
                    <View style={styles.omzoHeader}>
                        {hasAvatar ? (
                            <Image
                                source={{ uri: item.user.avatar }}
                                style={styles.omzoAvatar}
                            />
                        ) : (
                            <View style={[styles.omzoAvatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                                    {item.user?.displayName?.[0]?.toUpperCase() || 'U'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.omzoUserInfo}>
                            <View style={styles.userNameRow}>
                                <Text style={[styles.omzoUsername, { color: colors.text }]}>
                                    {item.user.displayName}
                                </Text>
                                {item.user.isVerified && (
                                    <Icon name="checkmark-circle" size={14} color={colors.primary} />
                                )}
                            </View>
                            <Text style={[styles.omzoHandle, { color: colors.textSecondary }]}>
                                @{item.user.username}
                            </Text>
                        </View>
                    </View>

                    {item.videoUrl && (
                        <View style={styles.omzoVideoContainer}>
                            <Video
                                source={{ uri: item.videoUrl }}
                                style={styles.omzoVideo}
                                paused={true}
                                muted={true}
                                resizeMode="cover"
                            />
                            <View style={styles.playOverlay}>
                                <View style={styles.playButton}>
                                    <Icon name="play" size={32} color="#FFFFFF" />
                                </View>
                            </View>
                        </View>
                    )}

                    {item.caption && (
                        <Text style={[styles.omzoCaption, { color: colors.text }]} numberOfLines={2}>
                            {item.caption}
                        </Text>
                    )}

                    <View style={styles.omzoStats}>
                        <View style={styles.statItem}>
                            <Icon name="heart-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.statText, { color: colors.textSecondary }]}>
                                {item.likes || 0}
                            </Text>
                        </View>
                        <View style={styles.statItem}>
                            <Icon name="chatbubble-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.statText, { color: colors.textSecondary }]}>
                                {item.comments || 0}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        return null;
    };

    const renderFooter = () => {
        if (!isLoadingFeed || isRefreshing) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    };

    const renderMasonryItem = (item: any, index: number) => {
        const isLarge = index % 5 === 0; // Every 5th item is large
        const isMedium = index % 3 === 0; // Every 3rd item is medium

        if (item.type === 'scribe') {
            return (
                <TouchableOpacity
                    key={`${item.type}-${item.id}-${index}`}
                    style={[
                        styles.masonryCard,
                        { backgroundColor: colors.surface },
                        isLarge && styles.masonryCardLarge,
                        isMedium && !isLarge && styles.masonryCardMedium,
                    ]}
                >
                    {/* User Header */}
                    <View style={styles.cardHeader}>
                        <View style={styles.cardUserInfo}>
                            {item.user?.avatar && item.user.avatar.startsWith('http') ? (
                                <Image source={{ uri: item.user.avatar }} style={styles.cardAvatar} />
                            ) : (
                                <View style={[styles.cardAvatar, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.avatarText}>
                                        {item.user?.username?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.cardUserDetails}>
                                <View style={styles.userNameRow}>
                                    <Text style={[styles.cardUsername, { color: colors.text }]} numberOfLines={1}>
                                        {item.user?.displayName || item.user?.username}
                                    </Text>
                                    {item.user?.isVerified && (
                                        <Icon name="checkmark-circle" size={14} color="#3B82F6" />
                                    )}
                                </View>
                                <Text style={[styles.cardHandle, { color: colors.textSecondary }]} numberOfLines={1}>
                                    @{item.user?.username}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Content */}
                    {item.content && (
                        <Text style={[styles.cardContent, { color: colors.text }]} numberOfLines={isLarge ? 6 : isMedium ? 4 : 3}>
                            {item.content}
                        </Text>
                    )}

                    {/* Media */}
                    {item.mediaUrl && item.mediaUrl.trim() !== '' && item.mediaUrl.startsWith('http') && (
                        <Image
                            source={{ uri: item.mediaUrl }}
                            style={styles.cardImage}
                            resizeMode="cover"
                        />
                    )}

                    {/* Action Bar */}
                    <View style={styles.cardFooter}>
                        <TouchableOpacity style={styles.cardAction}>
                            <Icon name="heart-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{item.likes || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cardAction}>
                            <Icon name="chatbubble-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{item.comments || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cardAction}>
                            <Icon name="repeat-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{item.shares || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cardAction}>
                            <Icon name={item.is_saved ? "bookmark" : "bookmark-outline"} size={18} color={item.is_saved ? colors.primary : colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        }

        if (item.type === 'omzo') {
            const hasVideo = item.videoUrl && item.videoUrl.trim() !== '';

            return (
                <View
                    key={`${item.type}-${item.id}-${index}`}
                    style={[
                        styles.masonryCard,
                        styles.omzoMasonryCard,
                        { backgroundColor: '#1a1a1a' },
                        isLarge && styles.masonryCardLarge,
                    ]}
                >
                    {/* Thumbnail/Video Preview */}
                    {hasVideo ? (
                        <Video
                            source={{ uri: item.videoUrl }}
                            style={styles.omzoMasonryVideo}
                            paused={true}
                            muted={true}
                            resizeMode="cover"
                            poster={item.videoUrl}
                            posterResizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.omzoMasonryVideo, { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]}>
                            <Icon name="videocam" size={48} color="#666666" />
                        </View>
                    )}

                    {/* Play Button Overlay */}
                    <View style={styles.omzoPlayButton}>
                        <Icon name="play" size={28} color="#FFFFFF" />
                    </View>

                    {/* Bottom Info Overlay */}
                    <View style={styles.omzoBottomOverlay}>
                        {/* User Info */}
                        <View style={styles.omzoUserSection}>
                            {item.user?.avatar && item.user.avatar.startsWith('http') ? (
                                <Image source={{ uri: item.user.avatar }} style={styles.omzoAvatarSmall} />
                            ) : (
                                <View style={[styles.omzoAvatarSmall, { backgroundColor: colors.primary }]}>
                                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                                        {item.user?.username?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.omzoUserText}>
                                <Text style={styles.omzoDisplayName} numberOfLines={1}>
                                    {item.user?.displayName || item.user?.username}
                                </Text>
                                <Text style={styles.omzoHandle} numberOfLines={1}>
                                    @{item.user?.username}
                                </Text>
                            </View>
                        </View>

                        {/* Stats Row */}
                        <View style={styles.omzoStatsRow}>
                            <View style={styles.omzoStatItem}>
                                <Icon name="heart" size={16} color="#FFFFFF" />
                                <Text style={styles.omzoStatText}>{item.likes || 0}</Text>
                            </View>
                            <View style={styles.omzoStatItem}>
                                <Icon name="chatbubble" size={16} color="#FFFFFF" />
                                <Text style={styles.omzoStatText}>{item.comments || 0}</Text>
                            </View>
                            <View style={styles.omzoStatItem}>
                                <Icon name="repeat" size={16} color="#FFFFFF" />
                                <Text style={styles.omzoStatText}>{item.shares || 0}</Text>
                            </View>
                            <View style={styles.omzoStatItem}>
                                <Icon name={item.is_saved ? "bookmark" : "bookmark-outline"} size={16} color="#FFFFFF" />
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        return null;
    };

    const isShowingSearch = searchQuery.trim().length > 0;
    const dataToShow = isShowingSearch ? searchResults : exploreFeed;
    const isLoading = isShowingSearch ? isSearching : isLoadingFeed && currentPage === 1;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Floating Search Bar */}
            <View style={styles.floatingSearchContainer}>
                <View style={[styles.floatingSearch, {
                    backgroundColor: colors.surface,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 8,
                }]}>
                    <Icon name="search" size={22} color={colors.primary} />
                    <TextInput
                        style={[styles.floatingSearchInput, { color: colors.text }]}
                        placeholder="Discover amazing content..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Icon name="close-circle" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        !isShowingSearch ? (
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.primary}
                            />
                        ) : undefined
                    }
                    onScroll={({ nativeEvent }) => {
                        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                        const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
                        if (isCloseToBottom && !isShowingSearch) {
                            handleLoadMore();
                        }
                    }}
                    scrollEventThrottle={400}
                >
                    {dataToShow.length > 0 ? (
                        <View style={styles.masonryContainer}>
                            {dataToShow.map((item, index) =>
                                isShowingSearch ? renderSearchResultItem({ item } as any) : renderMasonryItem(item, index)
                            )}
                            {isLoadingFeed && !isRefreshing && (
                                <View style={styles.footer}>
                                    <ActivityIndicator color={colors.primary} />
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface }]}>
                                <Icon
                                    name={isShowingSearch ? "search" : "sparkles"}
                                    size={48}
                                    color={colors.textSecondary}
                                />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                                {isShowingSearch ? 'No Results Found' : 'Start Exploring'}
                            </Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {isShowingSearch
                                    ? 'Try searching for something else'
                                    : 'Discover amazing content from creators'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    floatingSearchContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        zIndex: 10,
    },
    floatingSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderRadius: 28,
        paddingHorizontal: 20,
        gap: 12,
    },
    floatingSearchInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    contentWrapper: {
        paddingTop: 8,
    },
    masonryContainer: {
        paddingHorizontal: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    masonryCard: {
        width: (SCREEN_WIDTH - 36) / 2,
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    masonryCardLarge: {
        width: SCREEN_WIDTH - 24,
    },
    masonryCardMedium: {
        width: (SCREEN_WIDTH - 36) / 2,
        minHeight: 200,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    cardAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    cardUserDetails: {
        flex: 1,
    },
    cardUsername: {
        fontSize: 14,
        fontWeight: '700',
    },
    cardHandle: {
        fontSize: 12,
        marginTop: 2,
    },
    cardContent: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    cardImage: {
        width: '100%',
        height: 180,
        borderRadius: 12,
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    cardAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardStatText: {
        fontSize: 13,
        fontWeight: '600',
    },
    omzoMasonryCard: {
        padding: 0,
        overflow: 'hidden',
        height: 300,
        position: 'relative',
    },
    omzoMasonryVideo: {
        width: '100%',
        height: '100%',
    },
    omzoPlayButton: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -30 }, { translateY: -30 }],
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    omzoBottomOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        paddingTop: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    omzoUserSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    omzoAvatarSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    omzoUserText: {
        flex: 1,
    },
    omzoDisplayName: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    omzoHandle: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
        marginTop: 2,
    },
    omzoStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    omzoStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    omzoStatText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyIconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    footer: {
        width: '100%',
        paddingVertical: 20,
        alignItems: 'center',
    },
    // Search results styles
    resultItem: {
        width: SCREEN_WIDTH - 24,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    groupIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
    },
    userUsername: {
        fontSize: 14,
        marginTop: 2,
    },
    followButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    followButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    scribeResult: {
        width: SCREEN_WIDTH - 24,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    searchResultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    resultType: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    resultContent: {
        fontSize: 14,
        lineHeight: 20,
    },
    // Old explore feed item styles (for compatibility)
    omzoCard: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    omzoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    omzoAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    omzoUserInfo: {
        flex: 1,
    },
    omzoUsername: {
        fontSize: 15,
        fontWeight: '600',
    },
    omzoHandle: {
        fontSize: 13,
        marginTop: 2,
    },
    omzoVideoContainer: {
        width: '100%',
        aspectRatio: 9 / 16,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
    },
    omzoVideo: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    playButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    omzoCaption: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    omzoStats: {
        flexDirection: 'row',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
