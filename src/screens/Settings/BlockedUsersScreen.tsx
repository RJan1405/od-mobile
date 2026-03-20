import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    Image,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import type { User } from '@/types';

export default function BlockedUsersScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchBlockedUsers();
    }, []);

    const fetchBlockedUsers = async () => {
        setIsLoading(true);
        try {
            const response = await api.getBlockedUsers();
            if (response.success && response.data) {
                setBlockedUsers(response.data);
            } else {
                console.error('Failed to fetch blocked users:', response.error);
            }
        } catch (error) {
            console.error('Error fetching blocked users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnblock = (user: User) => {
        Alert.alert(
            'Unblock User',
            `Are you sure you want to unblock ${user.full_name || user.username}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    style: 'default',
                    onPress: async () => {
                        try {
                            const response = await api.toggleBlock(user.id);
                            if (response.success) {
                                setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
                            } else {
                                Alert.alert('Error', response.error || 'Failed to unblock user');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'An unexpected error occurred');
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: User }) => (
        <View style={[styles.userItem, { borderBottomColor: colors.border }]}>
            <Image
                source={{ uri: item.profile_picture_url || 'https://via.placeholder.com/40' }}
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]}>
                    {item.full_name || item.username}
                </Text>
                <Text style={[styles.userHandle, { color: colors.textSecondary }]}>
                    @{item.username}
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.unblockButton, { borderColor: colors.primary }]}
                onPress={() => handleUnblock(item)}
            >
                <Text style={[styles.unblockButtonText, { color: colors.primary }]}>Unblock</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Users</Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : blockedUsers.length === 0 ? (
                <View style={styles.center}>
                    <Icon name="ban-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No blocked users yet
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={blockedUsers}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.list}
                />
            )}
        </SafeAreaView>
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
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    list: {
        paddingVertical: 8,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
    },
    userHandle: {
        fontSize: 14,
    },
    unblockButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    unblockButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
