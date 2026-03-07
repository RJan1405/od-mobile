import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
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
        try {
            const response = await api.getOmzoBatch(cursor || undefined);
            // Backend returns omzos directly (not nested in data)
            if (response.success && (response as any).omzos) {
                const omzosData = (response as any).omzos.map(transformOmzoData);
                setOmzos(prev => [...prev, ...omzosData]);

                const nextCursor = (response as any).next_cursor;
                setCursor(nextCursor || null);
                setHasMore((response as any).has_more === true);

                console.log('✅ Loaded', omzosData.length, 'omzos, cursor:', nextCursor, 'has more:', (response as any).has_more);
            }
        } catch (error) {
            console.error('Error loading omzos:', error);
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

    const renderItem = ({ item, index }: { item: OmzoType; index: number }) => (
        <OmzoCard
            omzo={item}
            isActive={index === currentIndex && isFocused}
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
});
