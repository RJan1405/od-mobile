import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';
import type { User } from '@/types';

export default function SearchScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim()) {
                handleSearch();
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            const response = await api.globalSearch(searchQuery);
            if (response.success && response.data) {
                // Backend might return different structures for search results
                const users = response.data.users || response.data;
                if (Array.isArray(users)) {
                    setResults(users);
                } else {
                    setResults([]);
                }
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderUserItem = ({ item }: { item: User }) => {
        const profilePic = item.profile_picture_url || item.profile_picture || '';
        const hasValidPic = profilePic && profilePic.startsWith('http');

        return (
            <TouchableOpacity
                style={[styles.userItem, { borderBottomColor: colors.border }]}
                onPress={() => (navigation as any).navigate('Profile', { username: item.username })}
            >
                <View style={styles.avatarWrapper}>
                    {hasValidPic ? (
                        <Image source={{ uri: profilePic }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                            <Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.userInfo}>
                    <Text style={[styles.fullName, { color: colors.text }]}>
                        {item.full_name || item.username}
                    </Text>
                    <Text style={[styles.username, { color: colors.textSecondary }]}>
                        @{item.username}
                    </Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Icon name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder="Search for people..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="close-circle" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={results}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.username}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        searchQuery.length > 0 ? (
                            <View style={styles.centered}>
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    No users found matching "{searchQuery}"
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.centered}>
                                <Icon name="search-outline" size={64} color={colors.border} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    Type to search for users to call
                                </Text>
                            </View>
                        )
                    }
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
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
    },
    searchIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    },
    list: {
        paddingBottom: 20,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    avatarWrapper: {
        marginRight: 12,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    fullName: {
        fontSize: 16,
        fontWeight: '700',
    },
    username: {
        fontSize: 14,
        marginTop: 2,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        paddingHorizontal: 40,
    },
});
