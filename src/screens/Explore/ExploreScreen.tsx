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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';
import ScribeCard from '@/components/ScribeCard';
import type { User, Scribe, Omzo } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
            }
        } catch (error) {
            console.error('❌ Error loading explore feed:', error);
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
            return (
                <TouchableOpacity 
                    style={[styles.resultItem, { backgroundColor: colors.surface }]}
                    onPress={() => navigation.navigate('Profile' as never, { userId: item.id } as never)}
                >
                    <Image
                        source={{ uri: item.image_url || 'https://via.placeholder.com/48' }}
                        style={styles.userAvatar}
                    />
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
            return (
                <TouchableOpacity 
                    key={`omzo-${item.id}`}
                    style={[styles.omzoCard, { backgroundColor: colors.surface }]}
                    onPress={() => navigation.navigate('Omzo' as never)}
                >
                    <View style={styles.omzoHeader}>
                        <Image
                            source={{ uri: item.user.avatar || 'https://via.placeholder.com/40' }}
                            style={styles.omzoAvatar}
                        />
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
                                poster={item.videoUrl}
                                posterResizeMode="cover"
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

    const isShowingSearch = searchQuery.trim().length > 0;
    const dataToShow = isShowingSearch ? searchResults : exploreFeed;
    const isLoading = isShowingSearch ? isSearching : isLoadingFeed && currentPage === 1;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
                    <Icon name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search users, posts, omzos..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Icon name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : dataToShow.length > 0 ? (
                <FlatList
                    data={dataToShow}
                    keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
                    renderItem={isShowingSearch ? renderSearchResultItem : renderExploreFeedItem}
                    contentContainerStyle={styles.feedContainer}
                    refreshControl={
                        !isShowingSearch ? (
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.primary}
                            />
                        ) : undefined
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                />
            ) : (
                <View style={styles.centered}>
                    <Icon 
                        name={isShowingSearch ? "search" : "compass-outline"} 
                        size={64} 
                        color={colors.textSecondary} 
                    />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {isShowingSearch 
                            ? 'No results found' 
                            : 'Discover new content'}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 16,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    feedContainer: {
        padding: 16,
        gap: 16,
    },
    resultItem: {
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
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
});
