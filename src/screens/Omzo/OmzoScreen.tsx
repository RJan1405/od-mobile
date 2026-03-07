import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';
import type { Omzo as OmzoType } from '@/types';
import OmzoCard from '@/components/OmzoCard';
import { transformOmzoData } from '@/utils/api-helpers';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OmzoScreen() {
    const { colors } = useThemeStore();
    const isFocused = useIsFocused();
    const [omzos, setOmzos] = useState<OmzoType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [cursor, setCursor] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const hasLoadedRef = useRef(false);

    useEffect(() => {
        if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            loadOmzos();
        }
    }, []);

    const loadOmzos = async () => {
        if (isLoading || !hasMore) return;

        setIsLoading(true);
        console.log('🔄 Loading omzos with cursor:', cursor);
        try {
            const response = await api.getOmzoBatch(cursor || undefined);
            console.log('📦 API Response:', JSON.stringify(response, null, 2));

            // Backend returns omzos directly (not nested in data)
            if (response.success && (response as any).omzos) {
                const omzosData = (response as any).omzos.map(transformOmzoData);
                setOmzos(prev => [...prev, ...omzosData]);

                const nextCursor = (response as any).next_cursor;
                setCursor(nextCursor || null);
                setHasMore((response as any).has_more === true);

                console.log('✅ Loaded', omzosData.length, 'omzos, total now:', omzos.length + omzosData.length);
            } else {
                console.error('❌ Invalid response:', response);
            }
        } catch (error) {
            console.error('❌ Error loading omzos:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const handleOmzoSaveToggle = (omzoId: number, isSaved: boolean) => {
        // Update the omzo in the list with new save state
        setOmzos(prev => prev.map(omzo =>
            omzo.id === omzoId ? { ...omzo, is_saved: isSaved } : omzo
        ));
    };

    const renderItem = ({ item, index }: { item: OmzoType; index: number }) => (
        <OmzoCard
            omzo={item}
            isActive={index === currentIndex && isFocused}
            onSaveToggle={handleOmzoSaveToggle}
        />
    );

    const renderFooter = () => {
        if (!isLoading || !hasMore) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) {
            return (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={[styles.emptyText, { color: colors.text }]}>Loading omzos...</Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyContainer}>
                <Icon name="film-outline" size={64} color="#666" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Omzos Yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Be the first to create one!
                </Text>
                <TouchableOpacity
                    style={[styles.refreshButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                        hasLoadedRef.current = false;
                        setOmzos([]);
                        setCursor(null);
                        setHasMore(true);
                        loadOmzos();
                    }}
                >
                    <Icon name="refresh" size={20} color="#FFF" />
                    <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                ref={flatListRef}
                data={omzos}
                keyExtractor={(item) => `omzo-${item.id}`}
                renderItem={renderItem}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={SCREEN_HEIGHT}
                snapToAlignment="start"
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onEndReached={loadOmzos}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmpty}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    footer: {
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 16,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    refreshText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
