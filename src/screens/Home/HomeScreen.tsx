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
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import type { Chat } from '@/types';
import { formatDistanceToNow } from 'date-fns';

type TabType = 'private' | 'public' | 'groups';

export default function HomeScreen() {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const { colors } = useThemeStore();
    const { chats, loadChats, isLoading } = useChatStore();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('private');

    useEffect(() => {
        console.log('🏠 HomeScreen mounted, loading chats...');
        loadChats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadChats().finally(() => setIsRefreshing(false));
    };

    const handleChatPress = (chat: Chat) => {
        navigation.navigate('Chat' as never, { chatId: chat.id } as never);
    };

    const formatTimestamp = (timestamp: string) => {
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

    const renderStoryItem = (item: { id: string; username: string; avatar: string; hasStory?: boolean; isYourStory?: boolean }) => (
        <TouchableOpacity style={styles.storyItem} key={item.id}>
            <View style={[styles.storyRing, !item.hasStory && { borderColor: colors.border }]}>
                <Image
                    source={{ uri: item.avatar && item.avatar.trim() !== '' ? item.avatar : 'https://via.placeholder.com/60' }}
                    style={styles.storyAvatar}
                />
                {item.isYourStory && (
                    <View style={[styles.addStory, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                        <Icon name="add" size={14} color="#FFFFFF" />
                    </View>
                )}
            </View>
            <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
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
                            <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                                {formatTimestamp(item.last_message.timestamp)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.chatFooter}>
                        <Text
                            style={[styles.lastMessage, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            {item.last_message?.content || 'No messages yet'}
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

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Odnix</Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={styles.iconButton}>
                        <Icon name="search-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton}>
                        <Icon name="person-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stories */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.storiesContainer, { backgroundColor: colors.surface }]}
                contentContainerStyle={styles.storiesContent}
            >
                {renderStoryItem({ id: 'your-story', username: 'Your story', avatar: user?.profile_picture_url || '', hasStory: false, isYourStory: true })}
            </ScrollView>

            {/* Tabs */}
            <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'private' && { borderBottomColor: colors.primary }]}
                    onPress={() => setActiveTab('private')}
                >
                    <Icon name="person-outline" size={20} color={activeTab === 'private' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'private' && { color: colors.primary }]}>
                        Private
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'public' && { borderBottomColor: colors.primary }]}
                    onPress={() => setActiveTab('public')}
                >
                    <Icon name="earth-outline" size={20} color={activeTab === 'public' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'public' && { color: colors.primary }]}>
                        Public
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'groups' && { borderBottomColor: colors.primary }]}
                    onPress={() => setActiveTab('groups')}
                >
                    <Icon name="people-outline" size={20} color={activeTab === 'groups' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'groups' && { color: colors.primary }]}>
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
                        tintColor={colors.primary}
                    />
                }
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
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
        borderBottomWidth: 0,
        maxHeight: 110,
    },
    storiesContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        paddingBottom: 8,
        gap: 12,
    },
    storyItem: {
        alignItems: 'center',
        marginRight: 8,
        marginBottom: 0,
    },
    storyRing: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 2,
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
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    storyName: {
        fontSize: 11,
        maxWidth: 70,
        textAlign: 'center',
        marginTop: 0,
        lineHeight: 14,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '500',
    },
    listContent: {
        paddingVertical: 0,
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
