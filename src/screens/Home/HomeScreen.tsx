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
    Alert,
} from 'react-native';
import FastImage from 'react-native-fast-image';
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

type TabType = 'private' | 'public';

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
    const [searchQuery, setSearchQuery] = useState('');

    // Refresh data when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            console.log('🏠 HomeScreen focused, refreshing data...');
            loadChats();
            fetchStories();
            fetchNotifications();
            // Preferences now loaded from backend with chats
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
                let viewedTime = await AsyncStorage.getItem('@notifications_last_viewed_server');
                let numericViewedTime = viewedTime ? Number(viewedTime) : 0;

                // If this is the first time fetching notifications (viewedTime not set),
                // mark all existing notifications as "read" for badge purposes
                // Only NEW notifications arriving after this point will show in badge
                if (!viewedTime) {
                    const now = Date.now();
                    await AsyncStorage.setItem('@notifications_last_viewed_server', String(now));
                    numericViewedTime = now;
                    console.log('🔔 First notification fetch - all existing marked as read for badge');
                }

                // Show notifications from the last 30 days
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

                const updated = response.data
                    // Keep notifications from last 30 days
                    .filter((n: Notification) => {
                        const notifyTime = new Date(n.created_at).getTime();
                        return notifyTime > thirtyDaysAgo;
                    })
                    .map((n: Notification) => {
                        const notifyTime = new Date(n.created_at).getTime();
                        return {
                            ...n,
                            is_read: n.is_read || (!isNaN(notifyTime) && notifyTime <= numericViewedTime)
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
            // Save the current timestamp for reference
            const currentTime = Date.now();
            await AsyncStorage.setItem('@mark_all_notifications_read_time', String(currentTime));

            // Mark all notifications as read (keep them in the list for record)
            const updated = notifications.map(n => ({ ...n, is_read: true }));
            setNotifications(updated);
            setShowNotifications(false);

            console.log('✅ All notifications marked as read. Badge count: 0');
        } catch (error) {
            console.error('Error marking all read:', error);
        }
    };

    const handleToggleNotifications = async () => {
        const newState = !showNotifications;

        // When opening the notification dropdown, update the "last viewed" time
        // so these notifications don't count as "new" on next app refresh
        if (newState) {
            const now = Date.now();
            await AsyncStorage.setItem('@notifications_last_viewed_server', String(now));
            console.log('🔔 Notification dropdown opened - viewed time updated');
        }

        setShowNotifications(newState);
    };

    const handleManageRequest = async (username: string, action: 'accept' | 'decline', notificationId: number) => {
        try {
            const response = await api.manageFollowRequest(username, action);
            if (response.success) {
                // Remove or update the notification locally
                setNotifications(prev => prev.filter(n => n.id !== notificationId));
            }
        } catch (error) {
            console.error(`Error ${action}ing follow request:`, error);
        }
    };

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read
        const updated = notifications.map(n =>
            n.id === notification.id ? { ...n, is_read: true } : n
        );
        setNotifications(updated);
        api.markNotificationRead(notification.id);

        // Close dropdown
        setShowNotifications(false);

        // Navigate or handle action based on type
        console.log('📢 Notification pressed:', notification.notification_type, notification);

        if (notification.notification_type === 'comment' || notification.notification_type === 'reply') {
            // Navigate to Profile of the scribe author with comment params
            console.log('💬 Navigating to Profile for scribe comment');
            const scribeId = (notification as any).data?.scribe_id || (notification as any).scribe_id;
            try {
                console.log('⬇️ Fetching scribe with ID:', scribeId);
                const response = await api.getScribeDetail(scribeId);
                console.log('📦 Scribe API response:', JSON.stringify(response, null, 2));
                if (response.success && response.data) {
                    console.log('✅ Fetched scribe, navigating to author profile');
                    (navigation as any).navigate('Profile', {
                        username: response.data.user?.username,
                        scribeId: scribeId,
                        openComments: true,
                    });
                } else {
                    console.warn('⚠️ Failed to fetch scribe - response:', response);
                }
            } catch (error) {
                console.error('❌ Error fetching scribe:', error instanceof Error ? error.message : error);
            }
        } else if (notification.notification_type === 'omzo_comment') {
            // Navigate to OmzoViewer with comment params
            console.log('🎥 Navigating to OmzoViewer for video comment');
            try {
                const omzoId = (notification as any).data?.omzo_id || (notification as any).omzo_id;
                console.log('⬇️ Fetching omzo with ID:', omzoId);
                const response = await api.getOmzoDetail(omzoId);
                console.log('📦 Omzo API response:', JSON.stringify(response, null, 2));
                if (response.success && response.data) {
                    console.log('✅ Fetched omzo, navigating to viewer');
                    (navigation as any).navigate('OmzoViewer', {
                        omzo: response.data,
                        openComments: true,
                        commentId: (notification as any).data?.comment_id || (notification as any).comment_id,
                    });
                } else {
                    console.warn('⚠️ Failed to fetch omzo - response:', response);
                }
            } catch (error) {
                console.error('❌ Error fetching omzo:', error instanceof Error ? error.message : error);
            }
        } else if (notification.notification_type === 'like') {
            // Navigate to Profile of the scribe author for like
            console.log('❤️ Navigating to Profile for like');
            const scribeId = (notification as any).data?.scribe_id || (notification as any).scribe_id;
            try {
                console.log('⬇️ Fetching scribe with ID:', scribeId);
                const response = await api.getScribeDetail(scribeId);
                if (response.success && response.data) {
                    console.log('✅ Fetched scribe, navigating to author profile');
                    (navigation as any).navigate('Profile', {
                        username: response.data.user?.username,
                        scribeId: scribeId,
                        openComments: false,
                    });
                }
            } catch (error) {
                console.error('❌ Error fetching scribe:', error instanceof Error ? error.message : error);
            }
        } else if (notification.notification_type === 'omzo_like') {
            // Navigate to OmzoViewer to show the liked video
            console.log('❤️ Navigating to OmzoViewer for video like');
            try {
                const omzoId = (notification as any).data?.omzo_id || (notification as any).omzo_id;
                console.log('⬇️ Fetching omzo with ID:', omzoId);
                const response = await api.getOmzoDetail(omzoId);
                console.log('📦 Omzo API response:', JSON.stringify(response, null, 2));
                if (response.success && response.data) {
                    console.log('✅ Fetched omzo, navigating to viewer');
                    (navigation as any).navigate('OmzoViewer', {
                        omzo: response.data,
                    });
                } else {
                    console.warn('⚠️ Failed to fetch omzo - response:', response);
                }
            } catch (error) {
                console.error('❌ Error fetching omzo:', error instanceof Error ? error.message : error);
            }
        } else if (notification.notification_type === 'follow') {
            // Navigate to Profile
            console.log('👤 Navigating to Profile');
            (navigation as any).navigate('Profile', {
                userId: (notification as any).sender_id || (notification as any).sender?.id,
            });
        } else if (notification.notification_type === 'message') {
            // Navigate to Chat
            console.log('💌 Navigating to Chat');
            (navigation as any).navigate('Chat', {
                chatId: (notification as any).chat_id,
            });
        }
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
        let isTabMatch = false;
        // Use backend preference from user profile
        const isPrivateList = chat.user_marked_private ?? false;

        if (activeTab === 'private') {
            isTabMatch = isPrivateList;
        } else if (activeTab === 'public') {
            isTabMatch = !isPrivateList;
        }

        if (!isTabMatch) return false;

        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            const otherUser = chat.chat_type === 'private' ? chat.participants.find(p => p.id !== user?.id) : null;
            const chatName = chat.chat_type === 'group' ? chat.name : (otherUser?.full_name || otherUser?.username || 'Unknown');
            if (!chatName?.toLowerCase().includes(q)) {
                return false;
            }
        }

        return true;
    });

    const handleLongPressChat = (chat: Chat) => {
        const isCurrentlyPrivate = chat.user_marked_private ?? false;
        const title = isCurrentlyPrivate ? "Move to Public" : "Move to Private";
        const message = isCurrentlyPrivate
            ? "Do you want to move this chat to the Public tab?"
            : "Do you want to move this chat to your Private tab?";

        Alert.alert(title, message, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Move",
                onPress: async () => {
                    try {
                        // Call backend API to update preference
                        const response = await api.updateChatPreference(
                            chat.id,
                            !isCurrentlyPrivate // Toggle the value
                        );

                        if (response.success) {
                            // Update local chat object with new preference
                            const updatedChats = chats.map(c =>
                                c.id === chat.id
                                    ? { ...c, user_marked_private: !isCurrentlyPrivate }
                                    : c
                            );
                            useChatStore.setState({ chats: updatedChats });

                            // Show success message
                            Alert.alert("Success", response.message || "Chat preference updated");
                        } else {
                            Alert.alert("Error", response.error || "Failed to update chat preference");
                        }
                    } catch (error) {
                        console.error('Error toggling chat preference:', error);
                        Alert.alert("Error", "Failed to update chat preference. Please try again.");
                    }
                }
            }
        ]);
    };

    console.log(`💬 Total chats: ${chats.length}, Filtered (${activeTab}): ${filteredChats.length}`);

    const handleStoryPress = (userStories: UserWithStories) => {
        if (userStories.is_own && userStories.stories.length === 0) {
            // Navigate to create story
            navigation.navigate('CreateStory' as never);
        } else {
            // Navigate to story viewer
            navigation.navigate('StoryView' as never, { userId: userStories.user.id } as never);
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
                    item.is_own && { borderColor: colors.primary, borderWidth: 2 }
                ]}>
                    {hasValidAvatar ? (
                        <FastImage
                            source={{
                                uri: avatarUrl,
                                priority: FastImage.priority.normal,
                                cache: FastImage.cacheControl.immutable
                            }}
                            style={styles.storyAvatar}
                        />
                    ) : (
                        <View style={[styles.storyAvatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>
                                {item.user.username?.[0]?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                    {item.is_own && (
                        <TouchableOpacity
                            style={[styles.addStory, { backgroundColor: colors.primary, borderColor: colors.surface }]}
                            onPress={(e) => {
                                e.stopPropagation();
                                navigation.navigate('CreateStory' as never);
                            }}
                            activeOpacity={0.8}
                        >
                            <Icon name="add" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
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
                onLongPress={() => handleLongPressChat(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    <FastImage
                        source={{
                            uri: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : 'https://via.placeholder.com/50',
                            priority: FastImage.priority.normal,
                            cache: FastImage.cacheControl.immutable
                        }}
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

    const listHeaderContent = (
        <View style={{ backgroundColor: colors.surface }}>
            {/* Stories */}
            {storiesData.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={[styles.storiesContainer, { backgroundColor: colors.surface }]}
                    contentContainerStyle={styles.storiesContent}
                >
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        {storiesData.map((userStories, index) => renderStoryItem(userStories, index))}
                    </View>
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
                        value={searchQuery}
                        onChangeText={setSearchQuery}
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
                        onPress={handleToggleNotifications}
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
                        <FastImage
                            source={{
                                uri: user?.profile_picture_url || 'https://via.placeholder.com/40',
                                priority: FastImage.priority.high,
                                cache: FastImage.cacheControl.immutable,
                            }}
                            style={styles.headerAvatar}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Notification Dropdown */}
            {showNotifications && (
                <NotificationDropdown
                    notifications={notifications}
                    onClose={async () => {
                        // Update viewed time when closing dropdown
                        const now = Date.now();
                        await AsyncStorage.setItem('@notifications_last_viewed_server', String(now));
                        setShowNotifications(false);
                    }}
                    onMarkAllRead={handleMarkAllRead}
                    onNotificationPress={handleNotificationPress}
                    onManageRequest={handleManageRequest}
                />
            )}

            {/* Chat List */}
            <FlatList
                data={filteredChats}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderChatItem}
                ListHeaderComponent={listHeaderContent}
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
        borderRadius: 8,
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
