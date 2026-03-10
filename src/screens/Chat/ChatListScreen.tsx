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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import type { Chat } from '@/types';

type TabType = 'private' | 'public' | 'groups';

export default function ChatListScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user } = useAuthStore();
    const { chats, loadChats, isLoading, updateUnreadCounts } = useChatStore();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('private');

    useEffect(() => {
        loadChats();
        updateUnreadCounts(); // Load unread counts on mount
    }, []);

    // Refresh unread counts periodically
    useEffect(() => {
        const interval = setInterval(() => {
            updateUnreadCounts();
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        console.log('🔄 Force refreshing chats...');
        await loadChats();
        await updateUnreadCounts();
        setIsRefreshing(false);
    };

    const handleForceRefresh = async () => {
        console.log('🔄 Force debugging refresh...');
        // Clear any cached data and force reload
        await handleRefresh();
    };

    const handleChatPress = (chat: Chat) => {
        navigation.navigate('Chat' as never, { chatId: chat.id } as never);
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    };

    const filteredChats = chats.filter(chat => {
        if (activeTab === 'private') return chat.chat_type === 'private';
        if (activeTab === 'groups') return chat.chat_type === 'group';
        return true; // public shows all
    });

    const renderStoryItem = (item: { id: string; username: string; avatar: string; hasStory?: boolean; isYourStory?: boolean }) => (
        <TouchableOpacity style={styles.storyItem} key={item.id}>
            <View style={[styles.storyRing, !item.hasStory && { borderColor: '#E5E5EA' }]}>
                <Image
                    source={{ uri: item.avatar || 'https://via.placeholder.com/60' }}
                    style={styles.storyAvatar}
                />
                {item.isYourStory && (
                    <View style={styles.addStory}>
                        <Icon name="add" size={14} color="#FFFFFF" />
                    </View>
                )}
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
                {item.username}
            </Text>
        </TouchableOpacity>
    );

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

        // Debug logging at the top level
        console.log('🔍 Chat Item Debug:', {
            chatId: item.id,
            chatName: chatName,
            last_message: item.last_message,
            one_time: item.last_message?.one_time,
            consumed_at: item.last_message?.consumed_at,
            content: item.last_message?.content,
            unread_count: item.unread_count
        });

        return (
            <TouchableOpacity
                style={[styles.chatItem, { backgroundColor: '#FFFFFF' }]}
                onPress={() => handleChatPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    <Image
                        source={{ uri: avatarUrl || 'https://via.placeholder.com/50' }}
                        style={styles.avatar}
                    />
                    {isOnline && <View style={styles.onlineIndicator} />}
                </View>
                <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                        <Text style={[styles.chatName, { color: '#1C1C1E' }]} numberOfLines={1}>
                            {chatName}
                        </Text>
                        {item.last_message && (
                            <Text style={[styles.timestamp, { color: '#8E8E93' }]}>
                                {formatTimestamp(item.last_message.timestamp)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.chatFooter}>
                        <Text
                            style={[styles.lastMessage, { color: '#8E8E93' }]}
                            numberOfLines={1}
                        >
                            {item.last_message ? (
                                (() => {
                                    console.log('🔍 Message Content Analysis:', {
                                        chatId: item.id,
                                        content: item.last_message.content,
                                        contentLength: item.last_message.content?.length,
                                        one_time: item.last_message.one_time,
                                        consumed_at: item.last_message.consumed_at
                                    });

                                    // Check if this is a one-time message
                                    const isOneTime = item.last_message.one_time === true;

                                    // Defensive checks for short messages that might be one-time
                                    let isProbablyOneTime = isOneTime;
                                    const content = item.last_message.content;

                                    if (content && !isOneTime) {
                                        // Check for very short content (2-3 characters)
                                        if (content.length <= 3) {
                                            isProbablyOneTime = true;
                                            console.log('🔒 Short content detected:', content);
                                        }
                                        // Check for 2-3 letter patterns
                                        else if (content.match(/^[a-z]{2,3}$/i)) {
                                            isProbablyOneTime = true;
                                            console.log('🔒 Letter pattern detected:', content);
                                        }
                                        // Check for lock emoji
                                        else if (content.includes('🔒')) {
                                            isProbablyOneTime = true;
                                            console.log('🔒 Lock emoji detected:', content);
                                        }
                                    }

                                    if (isProbablyOneTime) {
                                        console.log('🔒 HIDING ONE-TIME MESSAGE:', {
                                            originalContent: content,
                                            consumed: !!item.last_message.consumed_at,
                                            displayText: item.last_message.consumed_at ? '🔒 Opened' : '🔒 One-time view'
                                        });

                                        return item.last_message.consumed_at ? '🔒 Opened' : '🔒 One-time view';
                                    }

                                    console.log('✅ Showing normal message:', content);
                                    return content || 'Media message';
                                })()
                            ) : 'No messages yet'}
                        </Text>
                        {item.unread_count > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{item.unread_count}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: '#F2F2F7' }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: '#FFFFFF' }]}>
                <Text style={[styles.headerTitle, { color: '#1C1C1E' }]}>Odnix</Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={styles.iconButton} onPress={handleForceRefresh}>
                        <Icon name="refresh-outline" size={24} color="#1C1C1E" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton}>
                        <Icon name="search-outline" size={24} color="#1C1C1E" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton}>
                        <Icon name="person-outline" size={24} color="#1C1C1E" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stories */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.storiesContainer}
                contentContainerStyle={styles.storiesContent}
            >
                {renderStoryItem({ id: 'your-story', username: 'Your story', avatar: user?.profile_picture_url || '', hasStory: false, isYourStory: true })}
                {renderStoryItem({ id: 'story-1', username: 'alex_dev', avatar: 'https://via.placeholder.com/60', hasStory: true })}
                {renderStoryItem({ id: 'story-2', username: 'sara.ui', avatar: 'https://via.placeholder.com/60', hasStory: true })}
                {renderStoryItem({ id: 'story-3', username: 'mike_tsx', avatar: 'https://via.placeholder.com/60', hasStory: true })}
                {renderStoryItem({ id: 'story-4', username: 'rina.art', avatar: 'https://via.placeholder.com/60', hasStory: true })}
            </ScrollView>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'private' && styles.activeTab]}
                    onPress={() => setActiveTab('private')}
                >
                    <Icon name="person-outline" size={20} color={activeTab === 'private' ? '#007AFF' : '#8E8E93'} />
                    <Text style={[styles.tabText, activeTab === 'private' && styles.activeTabText]}>
                        Private
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'public' && styles.activeTab]}
                    onPress={() => setActiveTab('public')}
                >
                    <Icon name="earth-outline" size={20} color={activeTab === 'public' ? '#007AFF' : '#8E8E93'} />
                    <Text style={[styles.tabText, activeTab === 'public' && styles.activeTabText]}>
                        Public
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
                    onPress={() => setActiveTab('groups')}
                >
                    <Icon name="people-outline" size={20} color={activeTab === 'groups' ? '#007AFF' : '#8E8E93'} />
                    <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
                        Groups
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Chat List */}
            <FlatList
                data={filteredChats}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderChatItem}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#007AFF"
                    />
                }
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => (
                    <View style={[styles.separator, { backgroundColor: '#E5E5EA' }]} />
                )}
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
        paddingVertical: 16,
        paddingTop: 48,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    headerIcons: {
        flexDirection: 'row',
        gap: 12,
    },
    iconButton: {
        padding: 4,
    },
    storiesContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    storiesContent: {
        paddingHorizontal: 12,
        paddingVertical: 16,
        gap: 12,
    },
    storyItem: {
        alignItems: 'center',
        marginRight: 8,
    },
    storyRing: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 2,
        borderColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    storyAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    addStory: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#007AFF',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    storyName: {
        fontSize: 12,
        color: '#1C1C1E',
        maxWidth: 70,
        textAlign: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 6,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#007AFF',
    },
    tabText: {
        fontSize: 15,
        color: '#8E8E93',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#007AFF',
        fontWeight: '600',
    },
    listContent: {
        paddingVertical: 8,
    },
    chatItem: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#34C759',
        borderWidth: 2,
        borderColor: '#FFFFFF',
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
        fontWeight: '600',
        flex: 1,
    },
    timestamp: {
        fontSize: 12,
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
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#007AFF',
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
    separator: {
        height: 1,
        marginLeft: 84,
    },
});
