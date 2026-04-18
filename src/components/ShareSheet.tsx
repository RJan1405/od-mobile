import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    TextInput,
    Modal,
    Pressable,
    Clipboard,
    ToastAndroid,
    Platform,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { User, Chat } from '@/types';

interface ShareSheetProps {
    isVisible: boolean;
    onClose: () => void;
    contentId: number;
    contentType: 'omzo' | 'scribe';
    contentUrl?: string;
    onShareSuccess?: () => void;
}

export const ShareSheet: React.FC<ShareSheetProps> = ({
    isVisible,
    onClose,
    contentId,
    contentType,
    contentUrl,
    onShareSuccess,
}) => {
    const { colors } = useThemeStore();
    // Use cached auth user — avoids a redundant /api/profile/ call that races
    // with ProfileScreen's own API calls and silently fails inside catch
    const { user: cachedUser } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [recentUsers, setRecentUsers] = useState<User[]>([]);
    const [followingUsers, setFollowingUsers] = useState<User[]>([]);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [sendingStates, setSendingStates] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (isVisible) {
            // Reset stale state from previous open
            setRecentUsers([]);
            setFollowingUsers([]);
            setSearchQuery('');
            setSearchResults([]);
            setSendingStates({});
            fetchInitialData();
        }
    }, [isVisible]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            // Fetch chats and following in parallel — each independently so one
            // failure doesn't block the other (was the bug: getProfile() failing
            // inside ProfileScreen's context caused getChats() to never run)
            const [chatsRes, followingRes] = await Promise.allSettled([
                api.getChats(),
                cachedUser?.username ? api.getFollowing(cachedUser.username) : Promise.resolve([]),
            ]);

            // Process chats
            if (chatsRes.status === 'fulfilled' && chatsRes.value) {
                const rawChats = chatsRes.value;
                let chatsData: Chat[] = [];
                if (Array.isArray(rawChats)) {
                    chatsData = rawChats;
                } else {
                    const r = rawChats as any;
                    chatsData = r.chats || r.conversations || r.data || r.results || [];
                }

                if (chatsData.length > 0 && cachedUser) {
                    const chatUsers: User[] = [];
                    chatsData.forEach((chat: Chat) => {
                        if (chat.participants && chat.participants.length > 0) {
                            const other = chat.participants.find(p => p.id !== cachedUser.id);
                            if (other && !chatUsers.find(u => u.id === other.id)) {
                                chatUsers.push(other);
                            }
                        }
                    });
                    setRecentUsers(chatUsers);
                }
            } else if (chatsRes.status === 'rejected') {
                console.error('ShareSheet: getChats failed:', chatsRes.reason);
            }

            // Process following
            if (followingRes.status === 'fulfilled' && followingRes.value) {
                const rawFollowing = followingRes.value;
                let followingData: User[] = [];
                if (Array.isArray(rawFollowing)) {
                    followingData = rawFollowing;
                } else if (rawFollowing) {
                    const r = rawFollowing as any;
                    followingData = r.users || r.following || r.data || r.results || [];
                }
                setFollowingUsers(followingData);
            }
        } catch (error) {
            console.error('ShareSheet: fetchInitialData error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 1) {
            setSearchResults([]);
            return;
        }

        try {
            const res = await api.globalSearch(query);
            const r = res as any;
            const users: User[] = r?.users || r?.data?.users || r?.results?.users || r?.data?.results || r?.results || [];

            // Local fallback: also filter existing lists for better UX
            const lowerQuery = query.toLowerCase();
            const localMatches = [...recentUsers, ...followingUsers].filter(u =>
                u.username.toLowerCase().includes(lowerQuery) ||
                (u.full_name && u.full_name.toLowerCase().includes(lowerQuery))
            );

            // Combine and de-duplicate
            const combined = [...users];
            localMatches.forEach(lm => {
                if (!combined.find(u => u.id === lm.id)) {
                    combined.push(lm);
                }
            });

            setSearchResults(combined);
        } catch (error) {
            console.error('Search error:', error);
        }
    };

    const handleSendToUser = async (user: User) => {
        // Show loading state immediately
        setSendingStates(prev => ({ ...prev, [user.id]: true }));

        // Send in background - don't block UI
        api.createChat(user.username).then(chatRes => {
            if (chatRes.success && chatRes.data) {
                const chatId = chatRes.data.chatId;
                const shareMessage = contentType === 'omzo'
                    ? `Check out this video: ${contentUrl || `https://odnix.com/omzo/${contentId}/`}`
                    : `Check out this post: ${contentUrl || `https://odnix.com/scribe/${contentId}/`}`;

                const formData = new FormData();
                formData.append('chat_id', chatId.toString());
                formData.append('content', shareMessage);
                formData.append('share_type', contentType);
                formData.append('share_id', contentId.toString());

                return api.sendMessage(formData);
            } else {
                throw new Error('Failed to create chat');
            }
        }).then(() => {
            setSendingStates(prev => ({ ...prev, [user.id]: false }));
            onShareSuccess?.();
        }).catch(error => {
            console.error('Send error:', error);
            setSendingStates(prev => ({ ...prev, [user.id]: false }));
        });
    };

    const handleCopyLink = () => {
        const url = contentUrl || `https://odnix.com/${contentType}/${contentId}/`;
        Clipboard.setString(url);
        if (Platform.OS === 'android') {
            ToastAndroid.show('Link copied to clipboard', ToastAndroid.SHORT);
        } else {
            Alert.alert('', 'Link copied to clipboard');
        }
    };

    const renderUser = (item: User) => {
        const isSending = sendingStates[item.id] || false;
        const avatarUri = api.buildFullUrl(item.profile_picture_url || item.avatar);

        return (
            <View style={styles.userItem} key={item.id}>
                <View style={styles.userInfo}>
                    <View style={styles.avatarContainer}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                <Text style={[styles.avatarInitial, { color: '#FFFFFF' }]}>
                                    {item.username[0].toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={[styles.fullName, { color: '#FFFFFF' }]} numberOfLines={1}>
                            {item.full_name || item.username}
                        </Text>
                        <Text style={[styles.username, { color: '#94A3B8' }]} numberOfLines={1}>
                            @{item.username}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={[
                        styles.individualSendBtn,
                        { backgroundColor: colors.accent || '#3B82F6' },
                        isSending && { opacity: 0.7 }
                    ]}
                    onPress={() => handleSendToUser(item)}
                    disabled={isSending}
                >
                    {isSending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.sendBtnText}>Send</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const getListData = () => {
        if (searchQuery.length > 0) return searchResults;

        const integrated: any[] = [];
        if (recentUsers.length > 0) {
            integrated.push({ type: 'header', title: 'Recent' });
            integrated.push(...recentUsers);
        }
        if (followingUsers.length > 0) {
            integrated.push({ type: 'header', title: 'All Friends' });
            integrated.push(...followingUsers);
        }
        return integrated;
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: '#0F172A' }]}>
                    <View style={styles.indicatorContainer}>
                        <View style={styles.indicator} />
                    </View>

                    <View style={styles.header}>
                        <Text style={[styles.title, { color: '#FFFFFF' }]}>Share to</Text>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Icon name="close" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.searchContainer, { backgroundColor: '#1E293B' }]}>
                        <Icon name="search" size={20} color="#94A3B8" />
                        <TextInput
                            style={[styles.searchInput, { color: '#FFFFFF' }]}
                            placeholder="Search people..."
                            placeholderTextColor="#64748B"
                            value={searchQuery}
                            onChangeText={handleSearch}
                        />
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
                    ) : (
                        <FlatList
                            data={getListData()}
                            renderItem={({ item }) => {
                                if (item.type === 'header') {
                                    return (
                                        <Text style={[styles.sectionTitle, { color: '#64748B' }]}>
                                            {item.title}
                                        </Text>
                                    );
                                }
                                return renderUser(item);
                            }}
                            keyExtractor={(item, index) => item.id?.toString() || `idx-${index}`}
                            style={styles.list}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={[styles.emptyText, { color: '#64748B' }]}>
                                        {searchQuery ? 'No users found' : 'No users to show'}
                                    </Text>
                                </View>
                            }
                        />
                    )}

                    <View style={[styles.footer, { borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                        <TouchableOpacity
                            style={[styles.copyLinkButton, { backgroundColor: '#1E293B' }]}
                            onPress={handleCopyLink}
                            activeOpacity={0.8}
                        >
                            <Icon name="link-outline" size={20} color="#94A3B8" />
                            <Text style={[styles.copyLinkText, { color: '#FFFFFF' }]}>Copy Link</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    sheet: {
        height: '75%',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    indicatorContainer: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    indicator: {
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 24,
        paddingHorizontal: 16,
        borderRadius: 14,
        height: 48,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
    },
    loader: {
        flex: 1,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginTop: 20,
        marginBottom: 14,
    },
    userItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarInitial: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    textContainer: {
        marginLeft: 14,
        flex: 1,
    },
    fullName: {
        fontSize: 16,
        fontWeight: '600',
    },
    username: {
        fontSize: 14,
        marginTop: 2,
    },
    individualSendBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 70,
        alignItems: 'center',
    },
    sendBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '500',
    },
    footer: {
        paddingTop: 16,
        paddingHorizontal: 24,
        paddingBottom: 8,
    },
    copyLinkButton: {
        flexDirection: 'row',
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    copyLinkText: {
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ShareSheet;
