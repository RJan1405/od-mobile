import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Image,
    ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';
import type { User, Scribe, Omzo } from '@/types';

export default function ExploreScreen() {
    const { colors } = useThemeStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);

        if (!query.trim()) {
            setResults(null);
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.globalSearch(query);
            if (response.success && response.data) {
                setResults(response.data);
            }
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderUserItem = ({ item }: { item: User }) => (
        <TouchableOpacity style={[styles.resultItem, { backgroundColor: colors.surface }]}>
            <Image
                source={{ uri: item.profile_picture_url }}
                style={styles.userAvatar}
            />
            <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: colors.text }]}>{item.full_name}</Text>
                    {item.is_verified && (
                        <Icon name="checkmark-circle" size={16} color={colors.primary} />
                    )}
                </View>
                <Text style={[styles.userUsername, { color: colors.textSecondary }]}>
                    @{item.username}
                </Text>
            </View>
            <TouchableOpacity style={[styles.followButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.followButtonText}>Follow</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
                    <Icon name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search users, posts, omzos..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Icon name="close-circle" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : results ? (
                <FlatList
                    data={results.users || []}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderUserItem}
                    contentContainerStyle={styles.results}
                    ListHeaderComponent={
                        results.users && results.users.length > 0 ? (
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Users</Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No results found
                            </Text>
                        </View>
                    }
                />
            ) : (
                <View style={styles.centered}>
                    <Icon name="search" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Search for users, posts, and omzos
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 16,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    results: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    resultItem: {
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
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
    },
});
