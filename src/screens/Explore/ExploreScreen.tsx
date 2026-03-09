import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
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
    const { user } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [exploreFeed, setExploreFeed] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(false);   // first page spinner
    const [isLoadingMore, setIsLoadingMore] = useState(false);   // pagination spinner
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [selectedScribe, setSelectedScribe] = useState<any | null>(null);
    const [selectedOmzo, setSelectedOmzo] = useState<any | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isOmzoModalVisible, setIsOmzoModalVisible] = useState(false);

    // Refs to prevent concurrent fetches and track loaded state
    const isLoadingRef = useRef(false);
    const hasLoadedRef = useRef(false);
    const currentPageRef = useRef(1);
    const hasMoreRef = useRef(true);

    // Modal interaction states
    const [modalLiked, setModalLiked] = useState(false);
    const [modalDisliked, setModalDisliked] = useState(false);
    const [modalSaved, setModalSaved] = useState(false);
    const [modalLikeCount, setModalLikeCount] = useState(0);
    const [modalDislikeCount, setModalDislikeCount] = useState(0);
    const [modalCommentCount, setModalCommentCount] = useState(0);
    const [modalRepostCount, setModalRepostCount] = useState(0);
    const [commentText, setCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Load first page once on mount
    useEffect(() => {
        if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            loadExploreFeed(1);
        }
    }, []);

    // On screen focus: only silently sync interaction states of already-loaded items
    // Do NOT reload page 1 — that would reset the feed and waste bandwidth
    useFocusEffect(
        useCallback(() => {
            // no-op: state is kept in sync via updateFeedItem after each action
        }, [])
    );

    // Sync modal state when feed item updates
    useEffect(() => {
        if (selectedScribe && isModalVisible) {
            const updatedItem = exploreFeed.find(item => item.id === selectedScribe.id);
            if (updatedItem) {
                setModalLiked(updatedItem.isLiked || false);
                setModalDisliked(updatedItem.isDisliked || false);
                setModalSaved(updatedItem.isSaved || false);
                setModalLikeCount(updatedItem.likes || 0);
                setModalDislikeCount(updatedItem.dislikes || 0);
                setModalCommentCount(updatedItem.comments || 0);
                setModalRepostCount(updatedItem.reposts || updatedItem.shares || 0);
            }
        }
    }, [exploreFeed, selectedScribe?.id, isModalVisible]);

    // Sync omzo modal state when feed item updates
    useEffect(() => {
        if (selectedOmzo && isOmzoModalVisible) {
            const updatedItem = exploreFeed.find(item => item.id === selectedOmzo.id);
            if (updatedItem) {
                setModalLiked(updatedItem.isLiked || false);
                setModalDisliked(updatedItem.isDisliked || false);
                setModalSaved(updatedItem.isSaved || false);
                setModalLikeCount(updatedItem.likes || 0);
                setModalDislikeCount(updatedItem.dislikes || 0);
                setModalCommentCount(updatedItem.comments || 0);
                setModalRepostCount(updatedItem.shares || 0);
            }
        }
    }, [exploreFeed, selectedOmzo?.id, isOmzoModalVisible]);

    // Core paginated loader — safe to call concurrently via ref guard
    const loadExploreFeed = async (page: number = 1) => {
        if (isLoadingRef.current) return;  // ref-based guard — always current unlike state
        if (page > 1 && !hasMoreRef.current) return; // nothing left to load

        isLoadingRef.current = true;

        if (page === 1 && !isRefreshing) {
            setIsInitialLoad(true);
        } else if (page > 1) {
            setIsLoadingMore(true);
        }

        try {
            const response = await api.getExploreFeed(page);

            if (response.success && response.results) {
                const incoming = response.results;
                setExploreFeed(prev => page === 1 ? incoming : [...prev, ...incoming]);

                const more = response.has_more || false;
                hasMoreRef.current = more;
                currentPageRef.current = page;
                setHasMore(more);
                setCurrentPage(page);
            } else {
                if (page === 1) setExploreFeed([]);
                hasMoreRef.current = false;
                setHasMore(false);
            }
        } catch (error) {
            console.error('❌ Error loading explore feed:', error);
            if (page === 1) setExploreFeed([]);
            hasMoreRef.current = false;
            setHasMore(false);
        } finally {
            isLoadingRef.current = false;
            setIsInitialLoad(false);
            setIsLoadingMore(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        hasMoreRef.current = true;
        currentPageRef.current = 1;
        await loadExploreFeed(1);
        setIsRefreshing(false);
    };

    const openScribeModal = (item: any) => {
        setSelectedScribe(item);
        setModalLiked(item.isLiked || false);
        setModalDisliked(item.isDisliked || false);
        setModalSaved(item.isSaved || false);
        setModalLikeCount(item.likes || 0);
        setModalDislikeCount(item.dislikes || 0);
        setModalCommentCount(item.comments || 0);
        setModalRepostCount(item.reposts || item.shares || 0);
        setIsModalVisible(true);
    };

    const closeScribeModal = () => {
        setIsModalVisible(false);
        setCommentText('');
        setTimeout(() => {
            setSelectedScribe(null);
        }, 300);
    };

    const openOmzoModal = (item: any) => {
        // Transform and navigate to full screen omzo viewer
        const transformedItem = {
            id: item.id,
            user: item.user,
            video_file: item.videoUrl,
            video_url: item.videoUrl,
            videoUrl: item.videoUrl,
            url: item.videoUrl,
            caption: item.caption || '',
            created_at: item.created_at || item.createdAt,
            views_count: item.views || 0,
            like_count: item.likes || 0,
            dislike_count: item.dislikes || 0,
            comment_count: item.comments || 0,
            is_liked: item.isLiked || false,
            is_disliked: item.isDisliked || false,
            is_saved: item.isSaved || false,
        };
        navigation.navigate('OmzoViewer' as never, { omzo: transformedItem } as never);
    };

    const closeOmzoModal = () => {
        setIsOmzoModalVisible(false);
        setCommentText('');
        setTimeout(() => {
            setSelectedOmzo(null);
        }, 300);
    };

    const handleModalLike = async () => {
        if (!selectedScribe) return;

        const prevLiked = modalLiked;
        const prevCount = modalLikeCount;
        const prevDisliked = modalDisliked;
        const prevDislikeCount = modalDislikeCount;

        // Optimistic update
        if (modalLiked) {
            setModalLiked(false);
            setModalLikeCount(prev => Math.max(0, prev - 1));
        } else {
            setModalLiked(true);
            setModalLikeCount(prev => prev + 1);
            if (modalDisliked) {
                setModalDisliked(false);
                setModalDislikeCount(prev => Math.max(0, prev - 1));
            }
        }

        try {
            const response = await api.toggleLike(parseInt(selectedScribe.id));
            if (response.success) {
                setModalLiked((response as any).is_liked);
                setModalLikeCount((response as any).like_count);
                setModalDisliked((response as any).is_disliked);
                setModalDislikeCount((response as any).dislike_count);
                // Update in feed with complete state
                updateFeedItem(selectedScribe.id, {
                    isLiked: (response as any).is_liked,
                    likes: (response as any).like_count,
                    isDisliked: (response as any).is_disliked,
                    dislikes: (response as any).dislike_count
                });
            } else {
                setModalLiked(prevLiked);
                setModalLikeCount(prevCount);
                setModalDisliked(prevDisliked);
                setModalDislikeCount(prevDislikeCount);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            setModalLiked(prevLiked);
            setModalLikeCount(prevCount);
            setModalDisliked(prevDisliked);
            setModalDislikeCount(prevDislikeCount);
        }
    };

    const handleModalDislike = async () => {
        if (!selectedScribe) return;

        const prevDisliked = modalDisliked;
        const prevCount = modalDislikeCount;
        const prevLiked = modalLiked;
        const prevLikeCount = modalLikeCount;

        // Optimistic update
        if (modalDisliked) {
            setModalDisliked(false);
            setModalDislikeCount(prev => Math.max(0, prev - 1));
        } else {
            setModalDisliked(true);
            setModalDislikeCount(prev => prev + 1);
            if (modalLiked) {
                setModalLiked(false);
                setModalLikeCount(prev => Math.max(0, prev - 1));
            }
        }

        try {
            const response = await api.toggleDislike(parseInt(selectedScribe.id));
            if (response.success) {
                setModalDisliked((response as any).is_disliked);
                setModalDislikeCount((response as any).dislike_count);
                setModalLiked((response as any).is_liked);
                setModalLikeCount((response as any).like_count);
                // Update in feed with complete state
                updateFeedItem(selectedScribe.id, {
                    isDisliked: (response as any).is_disliked,
                    dislikes: (response as any).dislike_count,
                    isLiked: (response as any).is_liked,
                    likes: (response as any).like_count
                });
            } else {
                setModalDisliked(prevDisliked);
                setModalDislikeCount(prevCount);
                setModalLiked(prevLiked);
                setModalLikeCount(prevLikeCount);
            }
        } catch (error) {
            console.error('Error toggling dislike:', error);
            setModalDisliked(prevDisliked);
            setModalDislikeCount(prevCount);
            setModalLiked(prevLiked);
            setModalLikeCount(prevLikeCount);
        }
    };

    const handleModalSave = async () => {
        if (!selectedScribe) return;

        const prevSaved = modalSaved;
        setModalSaved(!modalSaved);

        try {
            const response = await api.toggleSaveScribe(parseInt(selectedScribe.id));
            if (response.success) {
                setModalSaved((response as any).is_saved);
                // Update in feed
                updateFeedItem(selectedScribe.id, { isSaved: (response as any).is_saved });
            } else {
                setModalSaved(prevSaved);
            }
        } catch (error) {
            console.error('Error toggling save:', error);
            setModalSaved(prevSaved);
        }
    };

    const handleModalComment = () => {
        // Navigate to scribe detail with comments
        closeScribeModal();
        // navigation.navigate('ScribeDetail' as never, { scribeId: selectedScribe.id } as never);
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || !selectedScribe || isSubmittingComment) return;

        setIsSubmittingComment(true);
        try {
            const response = await api.addComment(parseInt(selectedScribe.id), commentText.trim());
            if (response.success) {
                setCommentText('');
                setModalCommentCount(prev => prev + 1);
                // Update in feed
                updateFeedItem(selectedScribe.id, { comments: modalCommentCount + 1 });
            }
        } catch (error) {
            console.error('Error posting comment:', error);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // Omzo Modal Handlers
    const handleOmzoModalLike = async () => {
        if (!selectedOmzo) return;

        const prevLiked = modalLiked;
        const prevCount = modalLikeCount;
        const prevDisliked = modalDisliked;
        const prevDislikeCount = modalDislikeCount;

        // Optimistic update
        if (modalLiked) {
            setModalLiked(false);
            setModalLikeCount(prev => Math.max(0, prev - 1));
        } else {
            setModalLiked(true);
            setModalLikeCount(prev => prev + 1);
            if (modalDisliked) {
                setModalDisliked(false);
                setModalDislikeCount(prev => Math.max(0, prev - 1));
            }
        }

        try {
            const response = await api.toggleOmzoLike(parseInt(selectedOmzo.id));
            if (response.success) {
                setModalLiked((response as any).is_liked);
                setModalLikeCount((response as any).like_count);
                setModalDisliked((response as any).is_disliked);
                setModalDislikeCount((response as any).dislike_count);
                // Update in feed with complete state
                updateFeedItem(selectedOmzo.id, {
                    isLiked: (response as any).is_liked,
                    likes: (response as any).like_count,
                    isDisliked: (response as any).is_disliked,
                    dislikes: (response as any).dislike_count
                });
            } else {
                setModalLiked(prevLiked);
                setModalLikeCount(prevCount);
                setModalDisliked(prevDisliked);
                setModalDislikeCount(prevDislikeCount);
            }
        } catch (error) {
            console.error('Error toggling omzo like:', error);
            setModalLiked(prevLiked);
            setModalLikeCount(prevCount);
            setModalDisliked(prevDisliked);
            setModalDislikeCount(prevDislikeCount);
        }
    };

    const handleOmzoModalDislike = async () => {
        if (!selectedOmzo) return;

        const prevDisliked = modalDisliked;
        const prevCount = modalDislikeCount;
        const prevLiked = modalLiked;
        const prevLikeCount = modalLikeCount;

        // Optimistic update
        if (modalDisliked) {
            setModalDisliked(false);
            setModalDislikeCount(prev => Math.max(0, prev - 1));
        } else {
            setModalDisliked(true);
            setModalDislikeCount(prev => prev + 1);
            if (modalLiked) {
                setModalLiked(false);
                setModalLikeCount(prev => Math.max(0, prev - 1));
            }
        }

        try {
            const response = await api.toggleOmzoDislike(parseInt(selectedOmzo.id));
            if (response.success) {
                setModalDisliked(response.is_disliked);
                setModalDislikeCount(response.dislike_count);
                setModalLiked(response.is_liked);
                setModalLikeCount(response.like_count);
                // Update in feed with complete state
                updateFeedItem(selectedOmzo.id, {
                    isDisliked: response.is_disliked,
                    dislikes: response.dislike_count,
                    isLiked: response.is_liked,
                    likes: response.like_count
                });
            } else {
                setModalDisliked(prevDisliked);
                setModalDislikeCount(prevCount);
                setModalLiked(prevLiked);
                setModalLikeCount(prevLikeCount);
            }
        } catch (error) {
            console.error('Error toggling omzo dislike:', error);
            setModalDisliked(prevDisliked);
            setModalDislikeCount(prevCount);
            setModalLiked(prevLiked);
            setModalLikeCount(prevLikeCount);
        }
    };

    const handleOmzoModalSave = async () => {
        if (!selectedOmzo) return;

        const prevSaved = modalSaved;
        setModalSaved(!modalSaved);

        try {
            const response = await api.toggleSaveOmzo(parseInt(selectedOmzo.id));
            if (response.success) {
                setModalSaved(response.is_saved);
                // Update in feed
                updateFeedItem(selectedOmzo.id, { isSaved: response.is_saved });
            } else {
                setModalSaved(prevSaved);
            }
        } catch (error) {
            console.error('Error toggling omzo save:', error);
            setModalSaved(prevSaved);
        }
    };

    const handleOmzoModalComment = () => {
        // Navigate to omzo detail with comments
        closeOmzoModal();
        // navigation.navigate('OmzoDetail' as never, { omzoId: selectedOmzo.id } as never);
    };

    const handleAddOmzoComment = async () => {
        if (!commentText.trim() || !selectedOmzo || isSubmittingComment) return;

        setIsSubmittingComment(true);
        try {
            const response = await api.addOmzoComment(parseInt(selectedOmzo.id), commentText.trim());
            if (response.success) {
                setCommentText('');
                setModalCommentCount(prev => prev + 1);
                // Update in feed
                updateFeedItem(selectedOmzo.id, { comments: modalCommentCount + 1 });
            }
        } catch (error) {
            console.error('Error posting omzo comment:', error);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const updateFeedItem = (itemId: string, updates: any) => {
        setExploreFeed(prev => prev.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
        ));
    };

    // Handle like on scribe in masonry grid
    const handleScribeLike = async (scribeId: string, currentLiked: boolean) => {
        const currentItem = exploreFeed.find(i => i.id === scribeId);
        const optimisticUpdates = {
            isLiked: !currentLiked,
            likes: currentLiked ? Math.max(0, (currentItem?.likes || 1) - 1) : (currentItem?.likes || 0) + 1
        };
        updateFeedItem(scribeId, optimisticUpdates);

        try {
            const response = await api.toggleLike(parseInt(scribeId));
            if (response.success) {
                updateFeedItem(scribeId, {
                    isLiked: response.is_liked,
                    likes: response.like_count,
                    isDisliked: response.is_disliked,
                    dislikes: response.dislike_count
                });
            } else {
                updateFeedItem(scribeId, { isLiked: currentLiked });
            }
        } catch (error) {
            console.error('Error liking scribe:', error);
            updateFeedItem(scribeId, { isLiked: currentLiked });
        }
    };

    // Handle save on scribe in masonry grid
    const handleScribeSave = async (scribeId: string, currentSaved: boolean) => {
        const optimisticUpdates = { isSaved: !currentSaved };
        updateFeedItem(scribeId, optimisticUpdates);

        try {
            const response = await api.toggleSaveScribe(parseInt(scribeId));
            if (response.success) {
                updateFeedItem(scribeId, { isSaved: response.is_saved });
            } else {
                updateFeedItem(scribeId, { isSaved: currentSaved });
            }
        } catch (error) {
            console.error('Error saving scribe:', error);
            updateFeedItem(scribeId, { isSaved: currentSaved });
        }
    };

    // Handle like on omzo in masonry grid
    const handleOmzoLike = async (omzoId: string, currentLiked: boolean) => {
        const currentItem = exploreFeed.find(i => i.id === omzoId);
        const optimisticUpdates = {
            isLiked: !currentLiked,
            likes: currentLiked ? Math.max(0, (currentItem?.likes || 1) - 1) : (currentItem?.likes || 0) + 1
        };
        updateFeedItem(omzoId, optimisticUpdates);

        try {
            const response = await api.toggleOmzoLike(parseInt(omzoId));
            if (response.success) {
                updateFeedItem(omzoId, {
                    isLiked: response.is_liked,
                    likes: response.like_count,
                    isDisliked: response.is_disliked,
                    dislikes: response.dislike_count
                });
            } else {
                updateFeedItem(omzoId, { isLiked: currentLiked });
            }
        } catch (error) {
            console.error('Error liking omzo:', error);
            updateFeedItem(omzoId, { isLiked: currentLiked });
        }
    };

    // Handle save on omzo in masonry grid
    const handleOmzoSave = async (omzoId: string, currentSaved: boolean) => {
        const optimisticUpdates = { isSaved: !currentSaved };
        updateFeedItem(omzoId, optimisticUpdates);

        try {
            const response = await api.toggleSaveOmzo(parseInt(omzoId));
            if (response.success) {
                updateFeedItem(omzoId, { isSaved: response.is_saved });
            } else {
                updateFeedItem(omzoId, { isSaved: currentSaved });
            }
        } catch (error) {
            console.error('Error saving omzo:', error);
            updateFeedItem(omzoId, { isSaved: currentSaved });
        }
    };

    // Safe paginated load — uses refs so it's never stale when called from onEndReached
    const handleLoadMore = useCallback(() => {
        if (isLoadingRef.current || !hasMoreRef.current || searchQuery) return;
        loadExploreFeed(currentPageRef.current + 1);
    }, [searchQuery]);

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

    const handleFollowUser = async (username: string, event?: any) => {
        // Stop event propagation to prevent parent TouchableOpacity from being triggered
        if (event) {
            event.stopPropagation();
        }

        if (!username) {
            console.error('❌ No username provided for follow action');
            return;
        }

        console.log('👤 Following user:', username);
        try {
            const response = await api.toggleFollow(username);
            console.log('✅ Follow response:', JSON.stringify(response, null, 2));

            if (response.success) {
                console.log('✅ Successfully toggled follow for:', username);
                const nowFollowing = (response as any).is_following;

                // Update search results
                setSearchResults(prev => prev.map(item => {
                    if (item.type === 'person' &&
                        (item.data?.username === username || item.subtitle?.replace('@', '') === username)) {
                        return {
                            ...item,
                            data: {
                                ...item.data,
                                is_following: nowFollowing
                            }
                        };
                    }
                    return item;
                }));

                // Update explore feed — update isFollowing on all matching user items
                setExploreFeed(prev => prev.map(feedItem => {
                    if (feedItem.user?.username === username) {
                        return {
                            ...feedItem,
                            user: {
                                ...feedItem.user,
                                isFollowing: nowFollowing,
                            },
                        };
                    }
                    return feedItem;
                }));
            } else {
                console.error('❌ Follow request failed:', response.message || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Error following user:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
        }
    };

    const renderSearchResultItem = ({ item }: { item: any }) => {
        if (item.type === 'person') {
            const hasAvatar = item.image_url && item.image_url.trim() !== '' && item.image_url.startsWith('http');

            // Extract username from multiple possible sources
            let username = '';
            if (item.data?.username) {
                username = item.data.username;
            } else if (item.subtitle) {
                // Remove @ if present
                username = item.subtitle.replace('@', '');
            } else if (item.username) {
                username = item.username;
            }

            console.log('Search result item:', {
                title: item.title,
                subtitle: item.subtitle,
                username: username,
                data: item.data
            });

            return (
                <TouchableOpacity
                    style={[styles.resultItem, { backgroundColor: colors.surface }]}
                    onPress={() => {
                        console.log('Navigating to profile:', username);
                        navigation.navigate('Profile' as never, { username: username } as never);
                    }}
                    activeOpacity={0.7}
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
                        onPress={(e) => {
                            e.stopPropagation();
                            console.log('Follow button pressed for:', username);
                            handleFollowUser(username);
                        }}
                        activeOpacity={0.8}
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
            const scribe: Scribe = {
                id: parseInt(item.id),
                user: {
                    id: parseInt(item.user?.id) || 0,
                    username: item.user?.username || '',
                    full_name: item.user?.displayName,
                    profile_picture_url: item.user?.avatar,
                    is_verified: item.user?.isVerified,
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
                is_following: item.user?.isFollowing || false,
            };

            return (
                <ScribeCard
                    key={`scribe-${item.id}`}
                    scribe={scribe}
                    onPress={() => openScribeModal(item)}
                    onSaveToggle={(scribeId, isSaved) => updateFeedItem(item.id, { isSaved })}
                />
            );
        }

        if (item.type === 'omzo') {
            const hasAvatar = item.user?.avatar && item.user.avatar.trim() !== '' && item.user.avatar.startsWith('http');
            const thumbUri: string | null = item.thumbnailUrl || item.thumbnail_url || null;
            const hasThumb = thumbUri && thumbUri.startsWith('http');
            const isOwnOmzo = user?.username === item.user?.username;
            const isFollowingOmzoUser = item.user?.isFollowing || false;

            return (
                <TouchableOpacity
                    key={`omzo-${item.id}`}
                    style={styles.exploreOmzoCard}
                    onPress={() => openOmzoModal(item)}
                    activeOpacity={0.92}
                >
                    {/* Header */}
                    <View style={styles.exploreOmzoHeader}>
                        <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => navigation.navigate('Profile' as never, { username: item.user?.username } as never)}
                            activeOpacity={0.8}
                        >
                            {hasAvatar ? (
                                <Image source={{ uri: item.user.avatar }} style={styles.exploreOmzoAvatar} />
                            ) : (
                                <View style={[styles.exploreOmzoAvatar, { backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                                        {item.user?.displayName?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                <Text style={styles.exploreOmzoName}>
                                    {item.user?.displayName || item.user?.username || 'Unknown'}
                                </Text>
                                {item.user?.isVerified && (
                                    <Icon name="checkmark-circle" size={14} color="#3B82F6" />
                                )}
                                <View style={styles.omzoBadge}>
                                    <Icon name="videocam" size={10} color="#fff" />
                                    <Text style={styles.omzoBadgeText}>Omzo</Text>
                                </View>
                            </View>
                            <Text style={styles.exploreOmzoHandle}>@{item.user?.username || 'unknown'}</Text>
                        </View>

                        {/* Follow button — only show when not own post and not already following */}
                        {!isOwnOmzo && !isFollowingOmzoUser && (
                            <TouchableOpacity
                                style={styles.exploreFollowBtn}
                                onPress={() => handleFollowUser(item.user?.username, undefined)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.exploreFollowBtnText}>Follow</Text>
                            </TouchableOpacity>
                        )}

                        <Icon name="ellipsis-horizontal" size={18} color="#9CA3AF" style={{ marginLeft: 6 }} />
                    </View>


                    {/* Caption */}
                    {item.caption ? (
                        <Text style={styles.exploreOmzoCaption} numberOfLines={3}>{item.caption}</Text>
                    ) : null}

                    {/* Thumbnail — pointerEvents='none' so all touches reach the card TouchableOpacity above.
                        Never uses <Video> in list (Video intercepts native touches on Android). */}
                    <View style={styles.omzoThumbContainer} pointerEvents="none">
                        {hasThumb ? (
                            <Image
                                source={{ uri: thumbUri as string }}
                                style={styles.omzoThumb}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={[styles.omzoThumb, { backgroundColor: '#1a1a3e', justifyContent: 'center', alignItems: 'center' }]}>
                                <Icon name="videocam" size={40} color="rgba(255,255,255,0.2)" />
                            </View>
                        )}
                        <View style={styles.playOverlay}>
                            <View style={styles.playButton}>
                                <Icon name="play" size={24} color="#3B82F6" />
                            </View>
                        </View>
                    </View>

                    {/* Action bar */}
                    <View style={styles.exploreOmzoActions}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleOmzoLike(item.id, item.isLiked || false)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Icon name={item.isLiked ? 'heart' : 'heart-outline'} size={20} color={item.isLiked ? '#EF4444' : '#9CA3AF'} />
                            <Text style={[styles.actionCount, item.isLiked && { color: '#EF4444' }]}>{item.likes || 0}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => openOmzoModal(item)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Icon name="chatbubble-outline" size={20} color="#9CA3AF" />
                            <Text style={styles.actionCount}>{item.comments || 0}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                            <Icon name="repeat-outline" size={20} color="#9CA3AF" />
                            <Text style={styles.actionCount}>{item.shares || 0}</Text>
                        </TouchableOpacity>

                        <View style={{ flex: 1 }} />

                        <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleOmzoSave(item.id, item.isSaved || false)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Icon name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={item.isSaved ? '#3B82F6' : '#9CA3AF'} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionIconBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                            <Icon name="paper-plane-outline" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        }


        return null;
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
                    onPress={() => openScribeModal(item)}
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
                        <TouchableOpacity
                            style={styles.cardAction}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleScribeLike(item.id, item.isLiked || false);
                            }}
                        >
                            <Icon
                                name={item.isLiked ? "heart" : "heart-outline"}
                                size={18}
                                color={item.isLiked ? "#EF4444" : colors.textSecondary}
                            />
                            <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{item.likes || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cardAction}
                            onPress={(e) => {
                                e.stopPropagation();
                                openScribeModal(item);
                            }}
                        >
                            <Icon name="chatbubble-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{item.comments || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cardAction}>
                            <Icon name="repeat-outline" size={18} color={colors.textSecondary} />
                            <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{item.shares || 0}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cardAction}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleScribeSave(item.id, item.isSaved || false);
                            }}
                        >
                            <Icon
                                name={item.isSaved ? "bookmark" : "bookmark-outline"}
                                size={18}
                                color={item.isSaved ? colors.primary : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        }

        if (item.type === 'omzo') {
            const hasVideo = item.videoUrl && item.videoUrl.trim() !== '';

            return (
                <TouchableOpacity
                    key={`${item.type}-${item.id}-${index}`}
                    style={[
                        styles.masonryCard,
                        styles.omzoMasonryCard,
                        { backgroundColor: '#1a1a1a' },
                        isLarge && styles.masonryCardLarge,
                    ]}
                    onPress={() => openOmzoModal(item)}
                    activeOpacity={0.9}
                >
                    {/* Thumbnail/Video Preview */}
                    {hasVideo ? (
                        <View style={styles.omzoMasonryVideo} pointerEvents="none">
                            <Video
                                source={{ uri: item.videoUrl }}
                                style={{ width: '100%', height: '100%' }}
                                paused={true}
                                muted={true}
                                resizeMode="cover"
                                poster={item.videoUrl}
                                posterResizeMode="cover"
                            />
                        </View>
                    ) : (
                        <View style={[styles.omzoMasonryVideo, { backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
                            <Icon name="videocam" size={48} color="#666666" />
                        </View>
                    )}

                    {/* Bottom Info Overlay */}
                    <View style={styles.omzoBottomOverlay} pointerEvents="box-none">
                        {/* User Info */}
                        <View style={styles.omzoUserSection} pointerEvents="none">
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
                            <TouchableOpacity
                                style={styles.omzoStatItem}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleOmzoLike(item.id, item.isLiked || false);
                                }}
                            >
                                <Icon
                                    name={item.isLiked ? "heart" : "heart-outline"}
                                    size={16}
                                    color={item.isLiked ? "#EF4444" : "#FFFFFF"}
                                />
                                <Text style={styles.omzoStatText}>{item.likes || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.omzoStatItem}>
                                <Icon name="chatbubble-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.omzoStatText}>{item.comments || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.omzoStatItem}>
                                <Icon name="repeat-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.omzoStatText}>{item.shares || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.omzoStatItem}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleOmzoSave(item.id, item.isSaved || false);
                                }}
                            >
                                <Icon
                                    name={item.isSaved ? "bookmark" : "bookmark-outline"}
                                    size={16}
                                    color={item.isSaved ? "#3B82F6" : "#FFFFFF"}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        return null;
    };

    // Footer shown at bottom of feed when loading more pages
    const renderFooter = () => {
        if (!isLoadingMore || isRefreshing) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator color="#3B82F6" />
                <Text style={{ color: '#9CA3AF', marginTop: 6, fontSize: 13 }}>Loading more...</Text>
            </View>
        );
    };

    const isShowingSearch = searchQuery.trim().length > 0;
    const dataToShow = isShowingSearch ? searchResults : exploreFeed;
    const isLoading = isShowingSearch ? isSearching : isInitialLoad;

    return (
        <View style={[styles.container, { backgroundColor: '#F3F4F6' }]}>
            {/* Search Bar */}
            <View style={styles.searchBarRow}>
                <View style={styles.searchBarInner}>
                    <Icon name="search" size={18} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search scribes, people, tags..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Icon name="close-circle" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : (
                <FlatList
                    data={dataToShow}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    renderItem={isShowingSearch
                        ? renderSearchResultItem
                        : renderExploreFeedItem
                    }
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.feedContainer}
                    refreshControl={
                        !isShowingSearch ? (
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={handleRefresh}
                                tintColor="#3B82F6"
                            />
                        ) : undefined
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.6}
                    ListFooterComponent={renderFooter}
                    // Performance / windowing
                    initialNumToRender={5}
                    maxToRenderPerBatch={5}
                    windowSize={7}
                    updateCellsBatchingPeriod={50}
                    removeClippedSubviews={true}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Icon
                                name={isShowingSearch ? 'search' : 'sparkles'}
                                size={48}
                                color="#9CA3AF"
                            />
                            <Text style={styles.emptyTitle}>
                                {isShowingSearch ? 'No Results Found' : 'Start Exploring'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {isShowingSearch
                                    ? 'Try searching for something else'
                                    : 'Discover amazing content from creators'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Scribe Detail Modal */}
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={closeScribeModal}
                >
                    <TouchableOpacity
                        style={styles.modalContainer}
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={closeScribeModal}
                        >
                            <View style={[styles.closeButtonCircle, { backgroundColor: colors.surface }]}>
                                <Icon name="close" size={24} color={colors.text} />
                            </View>
                        </TouchableOpacity>

                        {selectedScribe ? (
                            <View style={[styles.modalScribeCard, { backgroundColor: colors.surface }]}>
                                {/* User Header */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardUserInfo}>
                                        {selectedScribe.user?.avatar && selectedScribe.user.avatar.startsWith('http') ? (
                                            <Image source={{ uri: selectedScribe.user.avatar }} style={styles.modalAvatar} />
                                        ) : (
                                            <View style={[styles.modalAvatar, { backgroundColor: colors.primary }]}>
                                                <Text style={styles.modalAvatarText}>
                                                    {selectedScribe.user?.username?.[0]?.toUpperCase() || 'U'}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={styles.cardUserDetails}>
                                            <View style={styles.userNameRow}>
                                                <Text style={[styles.modalUsername, { color: colors.text }]}>
                                                    {selectedScribe.user?.displayName || selectedScribe.user?.username}
                                                </Text>
                                                {selectedScribe.user?.isVerified && (
                                                    <Icon name="checkmark-circle" size={16} color="#3B82F6" />
                                                )}
                                            </View>
                                            <Text style={[styles.modalHandle, { color: colors.textSecondary }]}>
                                                @{selectedScribe.user?.username}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <ScrollView
                                    style={styles.modalScrollContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Content */}
                                    {selectedScribe.content && (
                                        <Text style={[styles.modalContentText, { color: colors.text }]}>
                                            {selectedScribe.content}
                                        </Text>
                                    )}

                                    {/* Media */}
                                    {selectedScribe.mediaUrl && selectedScribe.mediaUrl.trim() !== '' && selectedScribe.mediaUrl.startsWith('http') && (
                                        <Image
                                            source={{ uri: selectedScribe.mediaUrl }}
                                            style={styles.modalImage}
                                            resizeMode="cover"
                                        />
                                    )}

                                    {/* Timestamp */}
                                    {selectedScribe.createdAt && (
                                        <Text style={[styles.modalTimestamp, { color: colors.textSecondary }]}>
                                            {new Date(selectedScribe.createdAt).toLocaleString()}
                                        </Text>
                                    )}
                                </ScrollView>

                                {/* Stats Row - Fixed */}
                                <View style={styles.modalStats}>
                                    <View style={styles.modalStatItem}>
                                        <Text style={[styles.modalStatNumber, { color: colors.text }]}>
                                            {modalLikeCount}
                                        </Text>
                                        <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>
                                            Likes
                                        </Text>
                                    </View>
                                    <View style={styles.modalStatItem}>
                                        <Text style={[styles.modalStatNumber, { color: colors.text }]}>
                                            {modalCommentCount}
                                        </Text>
                                        <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>
                                            Comments
                                        </Text>
                                    </View>
                                    <View style={styles.modalStatItem}>
                                        <Text style={[styles.modalStatNumber, { color: colors.text }]}>
                                            {modalRepostCount}
                                        </Text>
                                        <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>
                                            Reposts
                                        </Text>
                                    </View>
                                    <View style={styles.modalStatItem}>
                                        <Text style={[styles.modalStatNumber, { color: colors.text }]}>
                                            {modalDislikeCount}
                                        </Text>
                                        <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>
                                            Dislikes
                                        </Text>
                                    </View>
                                </View>

                                {/* Action Bar - Fixed */}
                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={styles.modalActionButton} onPress={handleModalLike}>
                                        <Icon
                                            name={modalLiked ? "heart" : "heart-outline"}
                                            size={26}
                                            color={modalLiked ? "#EF4444" : colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalActionButton} onPress={handleModalComment}>
                                        <Icon name="chatbubble-outline" size={26} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalActionButton}>
                                        <Icon name="repeat-outline" size={26} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalActionButton} onPress={handleModalSave}>
                                        <Icon
                                            name={modalSaved ? "bookmark" : "bookmark-outline"}
                                            size={26}
                                            color={modalSaved ? colors.primary : colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalActionButton} onPress={handleModalDislike}>
                                        <Icon
                                            name={modalDisliked ? "thumbs-down" : "thumbs-down-outline"}
                                            size={26}
                                            color={modalDisliked ? "#F59E0B" : colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Comment Input */}
                                <KeyboardAvoidingView
                                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                                >
                                    <View style={[styles.commentInputContainer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                                        {user?.profile_picture_url ? (
                                            <Image
                                                source={{ uri: user.profile_picture_url }}
                                                style={styles.commentUserAvatar}
                                            />
                                        ) : (
                                            <View style={[styles.commentUserAvatar, { backgroundColor: colors.primary }]}>
                                                <Text style={styles.commentAvatarText}>
                                                    {user?.username?.[0]?.toUpperCase() || '?'}
                                                </Text>
                                            </View>
                                        )}
                                        <TextInput
                                            style={[styles.commentInput, { color: colors.text, backgroundColor: colors.background }]}
                                            placeholder="Add a comment..."
                                            placeholderTextColor={colors.textSecondary}
                                            value={commentText}
                                            onChangeText={setCommentText}
                                            multiline
                                            maxLength={500}
                                        />
                                        <TouchableOpacity
                                            onPress={handleAddComment}
                                            disabled={!commentText.trim() || isSubmittingComment}
                                            style={styles.sendButton}
                                        >
                                            {isSubmittingComment ? (
                                                <ActivityIndicator size="small" color={colors.primary} />
                                            ) : (
                                                <Icon
                                                    name="send"
                                                    size={24}
                                                    color={commentText.trim() ? colors.primary : colors.textSecondary}
                                                />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </KeyboardAvoidingView>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    // New clean search bar styles (Image 2 design)
    searchBarRow: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#F3F4F6',
    },
    searchBarInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
        paddingVertical: 0,
    },
    feedContainer: {
        paddingTop: 4,
        paddingBottom: 16,
    },
    // Shared action bar styles (used by both ScribeCard & Omzo in Explore)
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
    // Explore Omzo card styles
    exploreOmzoCard: {
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
    exploreOmzoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    exploreOmzoAvatar: {
        width: 44,
        height: 44,
        borderRadius: 10,
    },
    exploreOmzoName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    exploreOmzoHandle: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 2,
    },
    exploreOmzoCaption: {
        fontSize: 15,
        lineHeight: 22,
        color: '#111827',
        marginBottom: 12,
    },
    exploreFollowBtn: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#3B82F6',
        backgroundColor: 'transparent',
        marginRight: 4,
    },
    exploreFollowBtnText: {
        color: '#3B82F6',
        fontSize: 12,
        fontWeight: '700',
    },
    exploreOmzoActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    omzoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#6366F1',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 4,
    },
    omzoBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    omzoThumbContainer: {
        width: '100%',
        height: 260,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        backgroundColor: '#111',
    },
    omzoThumb: {
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
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
    },
    playButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
        gap: 10,
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
    handle: {
        color: '#9CA3AF',
        fontSize: 13,
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    // Legacy floating search (kept for other uses)
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
        //backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContainer: {
        width: '100%',
        maxWidth: SCREEN_WIDTH - 32,
        maxHeight: SCREEN_HEIGHT * 0.85,
        borderRadius: 20,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
    },
    closeButtonCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    modalScrollContent: {
        maxHeight: SCREEN_HEIGHT * 0.35,
        paddingBottom: 10,
    },
    modalScribeCard: {
        borderRadius: 20,
        padding: 20,
        paddingTop: 60,
    },
    modalAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalAvatarText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
    },
    modalUsername: {
        fontSize: 18,
        fontWeight: '700',
    },
    modalHandle: {
        fontSize: 15,
        marginTop: 2,
    },
    modalContentText: {
        fontSize: 16,
        lineHeight: 24,
        marginVertical: 16,
    },
    modalImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        marginVertical: 16,
    },
    modalOmzoVideo: {
        width: '100%',
        aspectRatio: 9 / 16,
        borderRadius: 16,
        marginVertical: 16,
        backgroundColor: '#000000',
    },
    modalTimestamp: {
        fontSize: 14,
        marginTop: 12,
        marginBottom: 16,
    },
    modalStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(128, 128, 128, 0.2)',
        marginTop: 12,
    },
    modalStatItem: {
        alignItems: 'center',
    },
    modalStatNumber: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    modalStatLabel: {
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        paddingBottom: 12,
    },
    modalActionButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
        borderTopWidth: 1,
    },
    commentUserAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentAvatarText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    commentInput: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
    },
    sendButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
