import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import type { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface NotificationDropdownProps {
    notifications: Notification[];
    onClose: () => void;
    onMarkAllRead: () => void;
    onNotificationPress: (notification: Notification) => void;
}

export default function NotificationDropdown({ notifications, onClose, onMarkAllRead, onNotificationPress }: NotificationDropdownProps) {
    const { colors } = useThemeStore();
    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getIconForType = (type: string) => {
        switch (type) {
            case 'like': return { name: 'heart', color: '#EF4444' };
            case 'follow': return { name: 'person-add', color: '#3B82F6' };
            case 'comment': return { name: 'chatbox-ellipses', color: '#BE5FD9' };
            case 'repost': return { name: 'repeat', color: '#10B981' };
            case 'mention': return { name: 'at', color: '#26D9C6' };
            default: return { name: 'notifications', color: colors.primary };
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        const icon = getIconForType(item.notification_type);
        const sender = item.sender;

        return (
            <TouchableOpacity
                style={[styles.notificationItem]}
                onPress={() => onNotificationPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    {sender?.profile_picture_url ? (
                        <Image
                            source={{ uri: sender.profile_picture_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>
                                {sender?.username?.[0]?.toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.typeIconContainer, { backgroundColor: colors.surface, borderColor: colors.surface }]}>
                        <View style={[styles.iconInner, { backgroundColor: '#F8F9FA', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }]}>
                            <Icon name={icon.name} size={10} color={icon.color} />
                        </View>
                    </View>
                </View>
                <View style={styles.contentContainer}>
                    <Text style={[styles.messageText, { color: colors.textSecondary }]} numberOfLines={2}>
                        <Text style={[styles.username, { color: colors.text }]}>@{sender?.username || 'user'}</Text> {item.message}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: false }).replace('about ', '')} ago
                    </Text>
                </View>
                {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: '#3B82F6' }]} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: 'rgba(0,0,0,0.05)' }]}>
            <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={styles.headerTitleRow}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: '#E0F2FE' }]}>
                            <Text style={[styles.unreadBadgeText, { color: '#0369A1' }]}>{unreadCount}</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity onPress={onMarkAllRead}>
                    <Text style={[styles.markReadText, { color: '#3B82F6' }]}>Mark all read</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={item => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={<View style={{ height: 4 }} />}
                ListFooterComponent={<View style={{ height: 8 }} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="notifications-off-outline" size={40} color={colors.textSecondary} style={{ marginBottom: 12, opacity: 0.5 }} />
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No notifications yet</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 95 : 70,
        right: 16,
        width: 320,
        maxHeight: 450,
        borderRadius: 24,
        borderWidth: 1,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
        zIndex: 10000,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingVertical: 18,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    unreadBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    unreadBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    markReadText: {
        fontSize: 14,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 8,
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 14,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 16,
    },
    typeIconContainer: {
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
    iconInner: {
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    username: {
        fontWeight: '800',
        fontSize: 15,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '500',
    },
    timeText: {
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
        opacity: 0.7,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginLeft: 10,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
});


