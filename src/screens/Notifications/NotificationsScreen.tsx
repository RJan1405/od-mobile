import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import websocketService from '@/services/websocket';
import type { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastViewedTime, setLastViewedTime] = useState<number>(0);

    useEffect(() => {
        // We use the new server-based time key for tracking
        AsyncStorage.getItem('@notifications_last_viewed_server').then(val => {
            const previousTime = val ? Number(val) : 0;
            setLastViewedTime(previousTime);
            fetchNotifications(previousTime, true);
        });

        // Connect to WebSocket for real-time notifications
        if (user) {
            const cleanup = websocketService.connectToNotifications((event) => {
                console.log('🔔 Real-time notification received:', event);

                // Refresh notifications on any general notification event
                const ignoredTypes = ['incoming.call', 'new.message', 'missed.call'];
                if (event.type && !ignoredTypes.includes(event.type)) {
                    fetchNotifications();
                }
            });

            return () => {
                cleanup();
            };
        }
    }, [user]);

    const fetchNotifications = async (providedTime?: number, isInitialLoad = false) => {
        try {
            const timeToUse = providedTime !== undefined ? providedTime : lastViewedTime;
            const response = await api.getNotifications();
            if (response.success && response.data) {
                const updated = response.data.map((n: Notification) => {
                    const notifyTime = new Date(n.created_at).getTime();
                    return {
                        ...n,
                        is_read: n.is_read || (!isNaN(notifyTime) && notifyTime <= timeToUse)
                    };
                });
                setNotifications(updated);
                
                // On initial load or manual refresh, update the high water mark
                if (isInitialLoad || providedTime !== undefined) {
                    const timestamps = response.data.map((n: Notification) => new Date(n.created_at).getTime()).filter((t: number) => !isNaN(t));
                    const newMaxTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
                    AsyncStorage.setItem('@notifications_last_viewed_server', newMaxTime.toString()).catch(e => console.error(e));
                }
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        // During manual refresh, update the time to current and pass true to save the new high watermark
        const now = Date.now();
        setLastViewedTime(now);
        fetchNotifications(now, true);
    };

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            await api.markNotificationRead(notification.id);
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
            );
        }

        // Navigate based on notification type
        if (notification.notification_type === 'follow' && notification.sender) {
            navigation.navigate('Profile' as never, { username: notification.sender.username } as never);
        } else if (notification.data?.scribe_id) {
            navigation.navigate('PostDetail' as never, { scribeId: notification.data.scribe_id } as never);
        } else if (notification.data?.story_id) {
            navigation.navigate('StoryView' as never, { userId: notification.sender?.id } as never);
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'like':
                return { name: 'heart', color: '#EF4444' };
            case 'follow':
                return { name: 'person-add', color: '#3B82F6' };
            case 'comment':
                return { name: 'chatbox-ellipses', color: '#8B5CF6' };
            case 'story_reply':
                return { name: 'chatbubble', color: '#10B981' };
            case 'mention':
                return { name: 'at', color: '#F59E0B' };
            default:
                return { name: 'notifications', color: colors.primary };
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        const icon = getIconForType(item.notification_type);
        const sender = item.sender;

        return (
            <TouchableOpacity
                style={[
                    styles.notificationItem,
                    { backgroundColor: item.is_read ? colors.background : colors.surface },
                ]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    {sender?.profile_picture_url ? (
                        <Image
                            source={{ uri: sender.profile_picture_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View
                            style={[
                                styles.avatar,
                                { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
                            ]}
                        >
                            <Text style={{ color: colors.textSecondary, fontWeight: 'bold', fontSize: 18 }}>
                                {sender?.username?.[0]?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                    <View
                        style={[
                            styles.typeIconContainer,
                            { backgroundColor: colors.background, borderColor: colors.background },
                        ]}
                    >
                        <View
                            style={[
                                styles.iconInner,
                                { backgroundColor: '#F8F9FA' },
                            ]}
                        >
                            <Icon name={icon.name} size={12} color={icon.color} />
                        </View>
                    </View>
                </View>
                <View style={styles.contentContainer}>
                    <Text style={[styles.messageText, { color: colors.textSecondary }]} numberOfLines={2}>
                        <Text style={[styles.username, { color: colors.text }]}>
                            @{sender?.username || 'user'}
                        </Text>{' '}
                        {item.message}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </Text>
                </View>
                {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: '#3B82F6' }]} />}
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon
                            name="notifications-off-outline"
                            size={60}
                            color={colors.textSecondary}
                            style={{ opacity: 0.5, marginBottom: 16 }}
                        />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No notifications yet
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                            When people interact with your posts, you'll see it here
                        </Text>
                    </View>
                }
            />
        </View>
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
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
    },
    typeIconContainer: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    iconInner: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    username: {
        fontWeight: '700',
        fontSize: 15,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 4,
    },
    timeText: {
        fontSize: 12,
        opacity: 0.7,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginLeft: 8,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        opacity: 0.7,
        textAlign: 'center',
    },
});
