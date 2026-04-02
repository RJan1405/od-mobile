import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Scribe, Omzo } from '@/types';
import { useNavigation } from '@react-navigation/native';
import api from '@/services/api';
import { transformOmzoData, transformFeedItem, buildFullUrl } from '@/utils/api-helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 240;

// ── Module-level cache ────────────────────────────────────────────────────────
// Each scribe/omzo is fetched ONCE per app session. Subsequent renders are instant.
const scribeCache = new Map<number, Scribe>();
const omzoCache   = new Map<number, Omzo>();
// ─────────────────────────────────────────────────────────────────────────────

interface ChatSharedCardProps {
    scribe?: Scribe;
    omzo?: Omzo;
    shareId?: number;
    shareType?: 'scribe' | 'omzo';
    isOwnMessage: boolean;
    onLongPress?: (event: any) => void;
}

const ChatSharedCard: React.FC<ChatSharedCardProps> = ({
    scribe: initialScribe,
    omzo: initialOmzo,
    shareId,
    shareType,
    isOwnMessage,
    onLongPress,
}) => {
    const navigation = useNavigation<any>();
    const [scribe, setScribe]           = useState<Scribe | undefined>(initialScribe);
    const [omzo, setOmzo]               = useState<Omzo | undefined>(initialOmzo);
    const [loading, setLoading]         = useState(false);
    const [aspectRatio, setAspectRatio] = useState(1);

    // ── Fetch content (with cache) ────────────────────────────────────────────
    useEffect(() => {
        const fetchData = async () => {
            const targetId = shareId ? parseInt(String(shareId)) : null;
            if (!targetId || !shareType) return;
            if (scribe || omzo) return; // already populated

            // Cache hit → instant render, no network
            if (shareType === 'omzo' && omzoCache.has(targetId)) {
                setOmzo(omzoCache.get(targetId));
                return;
            }
            if (shareType === 'scribe' && scribeCache.has(targetId)) {
                setScribe(scribeCache.get(targetId));
                return;
            }

            setLoading(true);
            try {
                if (shareType === 'omzo') {
                    // Try direct detail first (may not exist on this backend)
                    let found: any = null;
                    const res: any = await api.getOmzoDetail(targetId);
                    if (res?.success) {
                        // Backend returns { success: true, omzo: {...} }
                        found = res.omzo || res.data || res.item || null;
                    } else if (res?.id) {
                        found = res;
                    }

                    // Reliable fallback: scan the batch (proven to work)
                    if (!found) {
                        const batchRes: any = await api.getOmzoBatch();
                        const items: any[] = batchRes?.data || batchRes?.results || (Array.isArray(batchRes) ? batchRes : []);
                        found = items.find((o: any) => parseInt(String(o.id)) === targetId) || null;
                    }

                    if (found?.id) {
                        const transformed = transformOmzoData(found);
                        omzoCache.set(targetId, transformed);
                        setOmzo(transformed);
                    } else {
                        console.error('[ChatSharedCard] Could not parse omzo from response. Keys:', Object.keys(res || {}));
                    }
                } else {
                    // Single direct call — no slow fallback chains
                    const res: any = await api.getScribeDetail(targetId);
                    const found = res.success
                        ? (res.data || res.scribe || res.post || res.item)
                        : (res.id ? res : null);
                    if (found?.id) {
                        const transformed = transformFeedItem(found);
                        scribeCache.set(targetId, transformed);
                        setScribe(transformed);
                    }
                }
            } catch (error) {
                console.error('[ChatSharedCard] fetch error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [shareId, shareType, initialScribe, initialOmzo]);

    // ── Compute aspect ratio from image/thumbnail ─────────────────────────────
    useEffect(() => {
        const targetImage = omzo
            ? (omzo.thumbnail_url || (omzo as any).thumbnail || omzo.video_file)
            : scribe?.image_url;
        if (targetImage) {
            const uri = buildFullUrl(targetImage);
            Image.getSize(uri, (w, h) => {
                if (w && h) setAspectRatio(Math.max(0.6, Math.min(w / h, 1.8)));
            }, () => {
                setAspectRatio(omzo ? 0.75 : 1.2);
            });
        }
    }, [omzo, scribe]);

    // ── Navigate on press ─────────────────────────────────────────────────────
    const handlePress = () => {
        const targetId = shareId ? parseInt(String(shareId)) : (omzo?.id || scribe?.id);
        if (!targetId) return;

        if (shareType === 'omzo' || omzo) {
            navigation.navigate('OmzoViewer', { omzo, omzoId: targetId, initialOmzoId: targetId });
        } else if (scribe) {
            // Try every known username field from the backend response
            const handle =
                scribe.user?.username ||
                (scribe.user as any)?.name ||
                (scribe.user as any)?.display_name ||
                (scribe.user as any)?.full_name ||
                (scribe as any).username ||
                null;
            if (handle) {
                navigation.navigate('Profile', { username: handle });
            }
            // No valid username → don't navigate (card is still informative)
        }
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[styles.omzoCard, { height: 100, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#3B82F6" />
            </View>
        );
    }

    // ── Fallback (fetch failed or ID not found) ───────────────────────────────
    if (!omzo && !scribe) {
        const isOmzoType = shareType === 'omzo';
        return (
            <TouchableOpacity
                style={[isOmzoType ? styles.omzoCard : styles.scribeCard, { backgroundColor: '#1E293B', height: 90, justifyContent: 'center' }]}
                onPress={handlePress}
                onLongPress={onLongPress}
            >
                <View style={{ alignItems: 'center', gap: 6 }}>
                    <Icon name={isOmzoType ? 'videocam' : 'document-text'} size={22} color="#FFFFFF" />
                    <Text style={[styles.handleWhite, { fontSize: 12 }]}>Shared {isOmzoType ? 'Video' : 'Post'}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Tap to view</Text>
                </View>
            </TouchableOpacity>
        );
    }

    // ── Omzo card ─────────────────────────────────────────────────────────────
    if (omzo) {
        const rawThumb  = (omzo as any).thumbnail_url || (omzo as any).thumbnail || (omzo as any).poster || (omzo as any).video_file;
        const thumbUri  = buildFullUrl(rawThumb);
        const userAvatar = omzo.user?.profile_picture_url || (omzo as any).user_avatar;
        const avatarUri = buildFullUrl(userAvatar);
        const handle    = omzo.user?.username || (omzo as any).username || '';

        return (
            <TouchableOpacity
                style={[styles.omzoCard, { aspectRatio: Math.max(0.7, Math.min(aspectRatio, 1.5)) }]}
                activeOpacity={0.9}
                onPress={handlePress}
                onLongPress={onLongPress}
            >
                {thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                    <View style={[styles.thumbnail, { backgroundColor: '#1E293B' }]} />
                )}

                <View style={[styles.overlay, { top: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                <View style={[styles.overlay, { bottom: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.4)' }]} />

                <View style={styles.omzoHeader}>
                    <View style={styles.floatingUser}>
                        <Image source={{ uri: avatarUri || 'https://via.placeholder.com/40' }} style={styles.avatarRounded} />
                        <Text style={styles.handleWhite}>@{handle || 'user'}</Text>
                    </View>
                </View>

                <View style={styles.middlePlay}>
                    <Icon name="play-circle" size={50} color="rgba(255,255,255,0.9)" />
                </View>

                <View style={styles.omzoFooter}>
                    <View style={styles.omzoTag}>
                        <Text style={styles.tagText}>Omzo</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    // ── Scribe card ───────────────────────────────────────────────────────────
    if (scribe) {
        const avatarUri     = buildFullUrl(scribe.user?.profile_picture_url);
        const handle        =
            scribe.user?.username ||
            (scribe.user as any)?.name ||
            (scribe.user as any)?.display_name ||
            (scribe.user as any)?.full_name ||
            (scribe as any).username ||
            null;
        const displayHandle = handle || 'user';
        const imageUri      = buildFullUrl(scribe.image_url);

        return (
            <TouchableOpacity
                style={[styles.scribeCard, { backgroundColor: '#3B82F6' }]}
                activeOpacity={0.9}
                onPress={handlePress}
                onLongPress={onLongPress}
            >
                <View style={styles.scribeHeader}>
                    <View style={styles.userInfoLeft}>
                        <Image source={{ uri: avatarUri || 'https://via.placeholder.com/40' }} style={styles.avatarCircle} />
                        <Text style={styles.handleScribe} numberOfLines={1}>@{displayHandle}</Text>
                    </View>
                    <View style={styles.scribeBadge}>
                        <Text style={styles.scribeBadgeText}>SCRIBE</Text>
                    </View>
                </View>

                {scribe.content ? (
                    <Text style={styles.scribeBody} numberOfLines={4}>{scribe.content}</Text>
                ) : null}

                {scribe.image_url && (
                    <Image
                        source={{ uri: imageUri }}
                        style={[styles.scribeImage, { aspectRatio: Math.max(0.6, Math.min(aspectRatio, 1.8)) }]}
                        resizeMode="cover"
                    />
                )}
            </TouchableOpacity>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    omzoCard: {
        width: CARD_WIDTH,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    scribeCard: {
        width: CARD_WIDTH,
        borderRadius: 20,
        padding: 16,
    },
    thumbnail: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        position: 'absolute',
        width: '100%',
    },
    omzoHeader: {
        padding: 10,
        position: 'absolute',
        top: 0,
        zIndex: 2,
    },
    floatingUser: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        paddingRight: 10,
        borderRadius: 20,
        gap: 6,
    },
    avatarRounded: {
        width: 22,
        height: 22,
        borderRadius: 11,
    },
    handleWhite: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    middlePlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    omzoFooter: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        zIndex: 2,
    },
    omzoTag: {
        backgroundColor: 'rgba(59, 130, 246, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    tagText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    scribeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    userInfoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        maxWidth: '65%',
    },
    avatarCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    handleScribe: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    scribeBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
    },
    scribeBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '900',
    },
    scribeBody: {
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500',
        marginBottom: 14,
    },
    scribeImage: {
        width: '100%',
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
});

export default ChatSharedCard;
