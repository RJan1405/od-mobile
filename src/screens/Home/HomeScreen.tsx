import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    TouchableOpacity,
    Image,
    ScrollView,
    TextInput,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import api from '@/services/api';
import websocketService from '@/services/websocket';
import type { Chat, Notification, Story, User } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import NotificationDropdown from '@/components/NotificationDropdown';
import CreateGroupModal from '@/components/CreateGroupModal';

type TabType = 'private' | 'public' | 'groups';

interface UserWithStories {
    user: User;
    stories: Story[];
    has_unviewed: boolean;
    story_count: number;
    is_own: boolean;
}

export default function HomeScreen() {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const { colors } = useThemeStore();
    const { chats, loadChats, isLoading } = useChatStore();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('private');
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [storiesData, setStoriesData] = useState<UserWithStories[]>([]);
    const [createGroupVisible, setCreateGroupVisible] = useState(false);

    // Refresh data when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            console.log('🏠 HomeScreen focused, refreshing data...');
            loadChats();
            fetchStories();
            fetchNotifications();
        }, [])
    );

    useEffect(() => {
        console.log('🏠 HomeScreen mounted, setting up websockets...');
        // Only fetch at mount once, focus effect handles subsequent ones
        // loadChats(); ... moved to focus effect

        // Connect to WebSocket for real-time notifications
        let cleanupNotify: (() => void) | undefined;
        let cleanupSidebar: (() => void) | undefined;
        if (user) {
            cleanupNotify = websocketService.connectToNotifications((event) => {
                console.log('🔔 Real-time notification received in HomeScreen:', event);
                // Refresh notifications on any general notification event
                const ignoredTypes = ['incoming.call', 'new.message', 'missed.call'];
                if (event.type && !ignoredTypes.includes(event.type)) {
                    fetchNotifications();
                }
            });

            // Subscribe to sidebar websocket for chat list updates
            // Debounce sidebar updates
            let sidebarTimeout: NodeJS.Timeout | null = null;
            let latestSidebarEvent: any = null;
            const sidebarHandler = (event: any) => {
                latestSidebarEvent = event;
                if (sidebarTimeout) clearTimeout(sidebarTimeout);
                sidebarTimeout = setTimeout(() => {
                    const e = latestSidebarEvent;
                    console.log('🟦 Debounced sidebar event applied:', e);
                    if (e.type === 'sidebar_update' && e.chat_id) {
                        const chats = useChatStore.getState().chats.map(chat => {
                            if (chat.id === Number(e.chat_id)) {
                                // Apply one-time message detection to the new content
                                const content = e.last_message;
                                let displayContent = content;

                                if (content) {
                                    console.log('🔍 Sidebar content analysis:', {
                                        chatId: e.chat_id,
                                        content: content,
                                        contentLength: content?.length
                                    });

                                    // Check for one-time message patterns
                                    if (content.length <= 3) {
                                        displayContent = '🔒 One-time view';
                                        console.log('🔒 Sidebar: Short content detected, hiding:', content);
                                    }
                                    else if (content.match(/^[a-z]{2,3}$/i)) {
                                        displayContent = '🔒 One-time view';
                                        console.log('🔒 Sidebar: Letter pattern detected, hiding:', content);
                                    }
                                    else if (content.includes('🔒')) {
                                        displayContent = '🔒 One-time view';
                                        console.log('🔒 Sidebar: Lock emoji detected, hiding:', content);
                                    }
                                }

                                return {
                                    ...chat,
                                    unread_count: typeof e.unread_count === 'number' ? e.unread_count : chat.unread_count,
                                    last_message: e.last_message ? {
                                        ...chat.last_message,
                                        content: displayContent,
                                        timestamp: new Date().toISOString(),
                                        one_time: content !== displayContent, // Mark as one-time if we changed it
                                    } as any : chat.last_message,
                                };
                            }
                            return chat;
                        });
                        useChatStore.setState({ chats });
                    } else if (e.type === 'new_chat' && e.chat && e.chat.id) {
                        const chats = useChatStore.getState().chats;
                        const chatIndex = chats.findIndex(chat => chat.id === e.chat.id);
                        let updatedChats;
                        if (chatIndex !== -1) {
                            updatedChats = chats.map(chat =>
                                chat.id === e.chat.id ? {
                                    ...chat,
                                    unread_count: e.chat.unread_count,
                                    last_message: e.chat.last_message ? {
                                        ...chat.last_message,
                                        content: e.chat.last_message,
                                        timestamp: new Date().toISOString(),
                                    } as any : chat.last_message,
                                    participants: e.chat.other_user ? [e.chat.other_user] : chat.participants,
                                } : chat
                            );
                        } else {
                            updatedChats = [...chats, {
                                id: e.chat.id,
                                chat_type: e.chat.type,
                                name: e.chat.other_user?.full_name || 'Unknown',
                                group_avatar: e.chat.other_user?.avatar_url || '',
                                participants: e.chat.other_user ? [e.chat.other_user] : [],
                                last_message: e.chat.last_message ? {
                                    content: e.chat.last_message,
                                    timestamp: new Date().toISOString(),
                                    sender: e.chat.other_user
                                } as any : undefined,
                                unread_count: e.chat.unread_count,
                                is_public: false,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            }];
                        }
                        useChatStore.setState({ chats: updatedChats as Chat[] });
                    }
                }, 120);
            };
            cleanupSidebar = websocketService.connectToSidebar(sidebarHandler);
        }
        return () => {
            if (cleanupNotify) cleanupNotify();
            if (cleanupSidebar) cleanupSidebar();
        };
    }, [user]);

    const fetchNotifications = async () => {
        try {
            const response = await api.getNotifications();
            if (response.success && response.data) {
                const val = await AsyncStorage.getItem('@notifications_last_viewed_server');
                const viewedTime = val ? Number(val) : 0;
                
                const updated = response.data.map((n: Notification) => {
                    const notifyTime = new Date(n.created_at).getTime();
                    return {
                        ...n,
                        is_read: n.is_read || (!isNaN(notifyTime) && notifyTime <= viewedTime)
                    };
                });
                setNotifications(updated);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const fetchStories = async () => {
        try {
            const response = await api.getFollowingStories();
            console.log('📖 Stories response:', response);
            if (response.success && (response as any).users_with_stories) {
                setStoriesData((response as any).users_with_stories);
            }
        } catch (error) {
            console.error('Error fetching stories:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            // In a real app, you'd call an API here
            // For now, update local state
            const updated = notifications.map(n => ({ ...n, is_read: true }));
            setNotifications(updated);
            // Optional: call api.markAllNotificationsRead() if it exists
        } catch (error) {
            console.error('Error marking all read:', error);
        }
    };

    const handleNotificationPress = (notification: Notification) => {
        // Mark as read
        const updated = notifications.map(n =>
            n.id === notification.id ? { ...n, is_read: true } : n
        );
        setNotifications(updated);
        api.markNotificationRead(notification.id);

        // Navigate or handle action based on type
        setShowNotifications(false);
    };

    const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;

    const handleRefresh = () => {
        setIsRefreshing(true);
        Promise.all([loadChats(), fetchStories()]).finally(() => setIsRefreshing(false));
    };

    const handleChatPress = (chat: Chat) => {
        navigation.navigate('Chat' as never, { chatId: chat.id } as never);
    };

    const formatTimestamp = (timestamp: string) => {
        // Defensive: check for valid timestamp
        if (!timestamp || isNaN(Date.parse(timestamp))) {
            return 'now';
        }
        const distance = formatDistanceToNow(new Date(timestamp), { addSuffix: false });
        // Convert to short form: "2 minutes" -> "2m"
        return distance
            .replace(' minutes', 'm')
            .replace(' minute', 'm')
            .replace(' hours', 'h')
            .replace(' hour', 'h')
            .replace(' days', 'd')
            .replace(' day', 'd')
            .replace('about ', '')
            .replace('less than a minute', '1m');
    };

    const filteredChats = chats.filter(chat => {
        if (activeTab === 'private') return chat.chat_type === 'private';
        if (activeTab === 'groups') return chat.chat_type === 'group';
        return true; // public shows all
    });

    console.log(`💬 Total chats: ${chats.length}, Filtered (${activeTab}): ${filteredChats.length}`);

    const handleStoryPress = (userStories: UserWithStories) => {
        if (userStories.is_own && userStories.stories.length === 0) {
            // Navigate to create story
            navigation.navigate('CreateStory' as any);
        } else {
            // Navigate to story viewer
            navigation.navigate('StoryView' as any, { userId: userStories.user.id });
        }
    };

    const renderStoryItem = (item: UserWithStories, index: number) => {
        const avatarUrl = item.user.profile_picture_url || item.user.profile_picture || '';
        const hasValidAvatar = avatarUrl && avatarUrl.trim() !== '' && avatarUrl.startsWith('http');
        const displayName = item.is_own ? 'Your story' : (item.user.full_name || item.user.username);
        const hasUnviewed = item.has_unviewed && !item.is_own;

        return (
            <TouchableOpacity
                style={styles.storyItem}
                key={`story-${item.user.id}-${index}`}
                onPress={() => handleStoryPress(item)}
            >
                <View style={[
                    styles.storyRing,
                    hasUnviewed && { borderColor: colors.primary, borderWidth: 3 },
                    !hasUnviewed && { borderColor: colors.border },
                    item.is_own && item.stories.length === 0 && { borderColor: colors.primary, borderWidth: 2 }
                ]}>
                    {hasValidAvatar ? (
                        <Image
                            source={{ uri: avatarUrl }}
                            style={styles.storyAvatar}
                        />
                    ) : (
                        <View style={[styles.storyAvatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>
                                {item.user.username?.[0]?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                    {item.is_own && item.stories.length === 0 && (
                        <View style={[styles.addStory, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                            <Icon name="add" size={14} color="#FFFFFF" />
                        </View>
                    )}
                </View>
                <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
                    {displayName}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderChatItem = ({ item }: { item: Chat }) => {
        const otherUser = item.chat_type === 'private'
            ? item.participants.find(p => p.id !== user?.id)
            : null;

        const chatName = item.chat_type === 'group'
            ? item.name
            : otherUser?.full_name || 'Unknown';

        const avatarUrl = item.chat_type === 'group'
            ? item.group_avatar
            : otherUser?.profile_picture_url;

        const isOnline = otherUser?.is_online || false;

        // Defensive: ensure last_message.timestamp is valid
        let safeTimestamp = item.last_message?.timestamp;
        if (!safeTimestamp || isNaN(Date.parse(safeTimestamp))) {
            safeTimestamp = new Date().toISOString();
        }
        // Defensive: show last_message content if available, else fallback to sidebar event string
        let lastMessageContent = item.last_message?.content;
        if (!lastMessageContent && typeof item.last_message === 'string') {
            lastMessageContent = item.last_message;
        }
        return (
            <TouchableOpacity
                style={[styles.chatItem, { backgroundColor: colors.surface }]}
                onPress={() => handleChatPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    <Image
                        source={{ uri: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : 'https://via.placeholder.com/50' }}
                        style={styles.avatar}
                    />
                    {isOnline && <View style={[styles.onlineIndicator, { borderColor: colors.surface }]} />}
                </View>
                <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                        <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                            {chatName}
                        </Text>
                        {item.last_message && (
                            <Text style={[styles.timestamp, { color: item.unread_count > 0 ? colors.primary : colors.textSecondary }]}>
                                {formatTimestamp(safeTimestamp)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.chatFooter}>
                        <Text
                            style={[styles.lastMessage, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            {lastMessageContent || 'No messages yet'}
                        </Text>
                        {item.unread_count > 0 && (
                            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                                <Text style={styles.badgeText}>{item.unread_count}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const ListHeader = () => (
        <View style={{ backgroundColor: colors.surface }}>
            {/* Stories */}
            {storiesData.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={[styles.storiesContainer, { backgroundColor: colors.surface }]}
                    contentContainerStyle={styles.storiesContent}
                >
                    {storiesData.map((userStories, index) => renderStoryItem(userStories, index))}
                </ScrollView>
            )}

            {/* Search */}
            <View style={styles.searchContainer}>
                <View style={[styles.searchInputWrapper, { backgroundColor: colors.background }]}>
                    <Icon name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search chats..."
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabsContainer, { backgroundColor: colors.surface }]}>
                <View style={[styles.tabsInner, { borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'private' && { backgroundColor: colors.primary }]}
                        onPress={() => setActiveTab('private')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'private' ? '#FFFFFF' : colors.textSecondary }]}>
                            Private
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'public' && { backgroundColor: colors.primary }]}
                        onPress={() => setActiveTab('public')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'public' ? '#FFFFFF' : colors.textSecondary }]}>
                            Public
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'groups' && { backgroundColor: colors.primary }]}
                        onPress={() => setActiveTab('groups')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'groups' ? '#FFFFFF' : colors.textSecondary }]}>
                            Groups
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Odnix</Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity
                        style={styles.bellButton}
                        onPress={() => navigation.navigate('Notifications' as never)}
                    >
                        <Icon name="notifications" size={26} color={colors.textSecondary} />
                        {unreadNotificationsCount > 0 && (
                            <View style={[styles.notificationBadge, { backgroundColor: '#ef4444', borderColor: colors.surface }]}>
                                <Text style={styles.notificationBadgeText}>
                                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('MyProfile' as never)}>
                        <Image
                            source={{ uri: user?.profile_picture_url || 'https://via.placeholder.com/40' }}
                            style={styles.headerAvatar}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Notification Dropdown */}
            {showNotifications && (
                <NotificationDropdown
                    notifications={notifications}
                    onClose={() => setShowNotifications(false)}
                    onMarkAllRead={handleMarkAllRead}
                    onNotificationPress={handleNotificationPress}
                />
            )}

            {/* Chat List */}
            <FlatList
                data={filteredChats}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderChatItem}
                ListHeaderComponent={ListHeader}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => null}
            />

            <TouchableOpacity 
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => setCreateGroupVisible(true)}
            >
                <Icon name="chatbox-ellipses" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <CreateGroupModal
                visible={createGroupVisible}
                onClose={() => setCreateGroupVisible(false)}
                onGroupCreated={(chatId) => {
                    setCreateGroupVisible(false);
                    navigation.navigate('Chat' as never, { chatId } as never);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'ios' ? 48 : 20,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '900',
    },
    headerIcons: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center',
    },
    bellButton: {
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    notificationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
    },
    storiesContainer: {
        borderBottomWidth: 0,
        maxHeight: 120,
    },
    storiesContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 16,
    },
    storyItem: {
        alignItems: 'center',
        marginBottom: 0,
    },
    storyRing: {
        width: 68,
        height: 68,
        borderRadius: 18,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    storyAvatar: {
        width: 60,
        height: 60,
        borderRadius: 16,
    },
    addStory: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    storyName: {
        fontSize: 12,
        maxWidth: 70,
        textAlign: 'center',
        fontWeight: '500',
    },
    tabsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    tabsInner: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 24,
        padding: 4,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 20,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingVertical: 0,
        paddingBottom: 80,
    },
    chatItem: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 14,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 16,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#34C759',
        borderWidth: 2,
    },
    chatContent: {
        flex: 1,
        justifyContent: 'center',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    timestamp: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 8,
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        flex: 1,
    },
    badge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 8,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
});
