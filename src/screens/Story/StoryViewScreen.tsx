import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Animated,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    SafeAreaView,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { API_CONFIG } from '@/config';
import type { Story, User } from '@/types';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

interface UserStoryGroup {
    user: User;
    stories: Story[];
}

export default function StoryViewScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user: currentUser } = useAuthStore();
    const { userId: initialUserId } = (route.params as { userId?: number }) || {};

    const [allStoryGroups, setAllStoryGroups] = useState<UserStoryGroup[]>([]);
    const [currentUserIndex, setCurrentUserIndex] = useState(0);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [reply, setReply] = useState('');
    const [isLiked, setIsLiked] = useState(false);

    const progress = useRef(new Animated.Value(0)).current;
    const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const storyIndexByUser = useRef<Record<number, number>>({});
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        loadAllStories();
        return () => {
            isMounted.current = false;
        };
    }, [initialUserId]);

    const loadAllStories = async () => {
        setIsLoading(true);
        try {
            const response = await api.getFollowingStories();
            if (response.success) {
                // Check for users_with_stories format (current API structure)
                const usersWithStories = (response as any).users_with_stories;

                if (Array.isArray(usersWithStories)) {
                    // Map the backend structure to our UserStoryGroup format
                    const groups: UserStoryGroup[] = usersWithStories
                        .filter((userStories: any) => userStories.stories && userStories.stories.length > 0)
                        .map((userStories: any) => ({
                            user: userStories.user,
                            stories: userStories.stories
                        }));

                    // Find index of the user we started with
                    const startUserIdx = groups.findIndex(g => g.user.id === initialUserId);
                    const finalStartIdx = startUserIdx !== -1 ? startUserIdx : 0;

                    setAllStoryGroups(groups);
                    setCurrentUserIndex(finalStartIdx);
                    setCurrentStoryIndex(0);

                    // Mark first story as viewed
                    if (groups[finalStartIdx]?.stories[0]) {
                        api.markStoryViewed(groups[finalStartIdx].stories[0].id);
                    }
                } else {
                    // Try old format as fallback
                    const storiesArray = (response as any).data ||
                        (response as any).stories ||
                        (response as any).following_stories ||
                        ((response as any).results && Array.isArray((response as any).results) ? (response as any).results : null);

                    if (Array.isArray(storiesArray)) {
                        // Group stories by user
                        const groupsMap: Record<number, UserStoryGroup> = {};
                        storiesArray.forEach((story: Story) => {
                            const userObj = story.user;
                            if (!userObj) return;

                            const uId = typeof userObj === 'object' ? userObj.id : userObj;
                            if (!groupsMap[uId as number]) {
                                groupsMap[uId as number] = {
                                    user: typeof userObj === 'object' ? userObj : { id: uId, username: 'Unknown' } as any,
                                    stories: []
                                };
                            }
                            groupsMap[uId as number].stories.push(story);
                        });

                        // Convert map to array
                        const groups = Object.values(groupsMap);

                        // Find index of the user we started with
                        const startUserIdx = groups.findIndex(g => g.user.id === initialUserId);
                        const finalStartIdx = startUserIdx !== -1 ? startUserIdx : 0;

                        setAllStoryGroups(groups);
                        setCurrentUserIndex(finalStartIdx);
                        setCurrentStoryIndex(0);

                        // Mark first story as viewed
                        if (groups[finalStartIdx]?.stories[0]) {
                            api.markStoryViewed(groups[finalStartIdx].stories[0].id);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading stories:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (allStoryGroups.length > 0 && !isLoading && flatListRef.current && isMounted.current) {
            // Defer scroll to avoid navigation conflicts
            const timeoutId = setTimeout(() => {
                if (flatListRef.current && isMounted.current) {
                    try {
                        flatListRef.current.scrollToIndex({ index: currentUserIndex, animated: false });
                    } catch (error) {
                        // Ignore scroll errors during navigation
                    }
                }
            }, 100);
            startProgress();
            return () => {
                clearTimeout(timeoutId);
                if (progressAnimation.current) {
                    progressAnimation.current.stop();
                }
            };
        }
        return () => {
            if (progressAnimation.current) {
                progressAnimation.current.stop();
            }
        };
    }, [allStoryGroups, isLoading]);

    useEffect(() => {
        if (allStoryGroups.length > 0 && !isLoading && isMounted.current) {
            startProgress();
        }
        return () => {
            if (progressAnimation.current) {
                progressAnimation.current.stop();
            }
        };
    }, [currentUserIndex, currentStoryIndex]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / width);

        if (newIndex !== currentUserIndex && newIndex >= 0 && newIndex < allStoryGroups.length) {
            setCurrentUserIndex(newIndex);
            // Get story index for this user or start at 0
            const storyIdx = storyIndexByUser.current[newIndex] || 0;
            setCurrentStoryIndex(storyIdx);
        }
    };

    const startProgress = () => {
        if (!isMounted.current) return;

        progress.setValue(0);
        progressAnimation.current = Animated.timing(progress, {
            toValue: 1,
            duration: STORY_DURATION,
            useNativeDriver: false,
        });

        progressAnimation.current.start(({ finished }) => {
            if (finished && isMounted.current) {
                nextStory();
            }
        });
    };

    const nextStory = () => {
        if (!isMounted.current) return;

        const currentGroup = allStoryGroups[currentUserIndex];
        if (!currentGroup) return;

        if (currentStoryIndex < currentGroup.stories.length - 1) {
            // Next story in same user's group
            const nextIdx = currentStoryIndex + 1;
            setCurrentStoryIndex(nextIdx);
            storyIndexByUser.current[currentUserIndex] = nextIdx;
            api.markStoryViewed(currentGroup.stories[nextIdx].id);
        } else if (currentUserIndex < allStoryGroups.length - 1) {
            // Move to next user's stories
            const nextUserIdx = currentUserIndex + 1;
            storyIndexByUser.current[currentUserIndex] = currentStoryIndex; // Save current position
            if (flatListRef.current && isMounted.current) {
                try {
                    flatListRef.current.scrollToIndex({ index: nextUserIdx, animated: true });
                } catch (e) {
                    // Ignore scroll errors
                }
            }
            setCurrentUserIndex(nextUserIdx);
            setCurrentStoryIndex(0);
            storyIndexByUser.current[nextUserIdx] = 0;
            api.markStoryViewed(allStoryGroups[nextUserIdx].stories[0].id);
        } else {
            // All stories finished
            if (isMounted.current) {
                navigation.goBack();
            }
        }
    };

    const previousStory = () => {
        if (!isMounted.current) return;

        if (currentStoryIndex > 0) {
            // Previous story in same group
            const prevIdx = currentStoryIndex - 1;
            setCurrentStoryIndex(prevIdx);
            storyIndexByUser.current[currentUserIndex] = prevIdx;
        } else if (currentUserIndex > 0) {
            // Previous user's stories (last one)
            const prevUserIdx = currentUserIndex - 1;
            const prevUserStories = allStoryGroups[prevUserIdx].stories;
            const lastStoryIdx = prevUserStories.length - 1;
            storyIndexByUser.current[currentUserIndex] = 0; // Save current position
            if (flatListRef.current && isMounted.current) {
                try {
                    flatListRef.current.scrollToIndex({ index: prevUserIdx, animated: true });
                } catch (e) {
                    // Ignore scroll errors
                }
            }
            setCurrentUserIndex(prevUserIdx);
            setCurrentStoryIndex(lastStoryIdx);
            storyIndexByUser.current[prevUserIdx] = lastStoryIdx;
        } else {
            // Restart first story
            startProgress();
        }
    };

    const handlePress = (evt: any) => {
        const x = evt.nativeEvent.locationX;
        if (x < width * 0.3) {
            previousStory();
        } else {
            nextStory();
        }
    };

    const handleLongPressStart = () => {
        setIsPaused(true);
        if (progressAnimation.current) {
            progressAnimation.current.stop();
        }
    };

    const handleLongPressEnd = () => {
        setIsPaused(false);
        // Resume progress
        const currentProgressValue = (progress as any)._value;
        const remainingDuration = (1 - currentProgressValue) * STORY_DURATION;
        progressAnimation.current = Animated.timing(progress, {
            toValue: 1,
            duration: remainingDuration,
            useNativeDriver: false,
        });
        progressAnimation.current.start(({ finished }) => {
            if (finished) {
                nextStory();
            }
        });
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: '#000' }]}>
                <ActivityIndicator size="large" color="#FFF" />
            </View>
        );
    }

    if (allStoryGroups.length === 0) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: '#000' }]}>
                <Text style={{ color: '#FFF' }}>No stories available</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderUserStories = ({ item: userGroup, index }: { item: any; index: number }) => {
        const isActive = index === currentUserIndex;
        // Optimization: only render content for active and adjacent stories
        const isNear = Math.abs(index - currentUserIndex) <= 1;

        if (!isNear) {
            return <View style={{ width, height, backgroundColor: '#000' }} />;
        }

        const currentStoryIdx = storyIndexByUser.current[index] || 0;
        const currentStory = userGroup.stories[currentStoryIdx];

        if (!currentStory) return <View style={{ width, height, backgroundColor: '#000' }} />;

        const storyUser = userGroup.user;
        let mediaUri = currentStory.media_url || currentStory.media_file || '';

        // Defensive: ensure URL is absolute
        if (mediaUri && !mediaUri.startsWith('http')) {
            const baseUrl = API_CONFIG.BASE_URL;
            mediaUri = `${baseUrl}${mediaUri.startsWith('/') ? '' : '/'}${mediaUri}`;
        }

        const hasValidMedia = mediaUri && mediaUri.trim() !== '' && mediaUri.startsWith('http');
        const avatarUrl = storyUser.profile_picture_url || storyUser.profile_picture || '';

        return (
            <View style={[styles.container, { width, height }]}>
                <StatusBar hidden />

                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.storyContent}
                    onPress={handlePress}
                    onLongPress={handleLongPressStart}
                    onPressOut={handleLongPressEnd}
                >
                    {/* Background */}
                    {currentStory.story_type === 'text' || !hasValidMedia ? (
                        <View style={[styles.media, { backgroundColor: currentStory.background_color || '#667eea', justifyContent: 'center', alignItems: 'center' }]}>
                            {currentStory.content && (
                                <Text
                                    style={[
                                        styles.textContent,
                                        {
                                            color: currentStory.text_color || '#FFFFFF',
                                            fontSize: currentStory.text_size || 24,
                                            textAlign: 'center',
                                        }
                                    ]}
                                >
                                    {currentStory.content}
                                </Text>
                            )}
                        </View>
                    ) : currentStory.story_type === 'video' ? (
                        <Video
                            source={{ uri: mediaUri }}
                            style={styles.media}
                            resizeMode="cover"
                            paused={!isActive || isPaused}
                            muted={isMuted}
                            repeat
                            onError={(e) => console.log('Story video error:', e)}
                        />
                    ) : (
                        <Image
                            source={{ uri: mediaUri }}
                            style={styles.media}
                            resizeMode="cover"
                        />
                    )}

                    <View style={styles.topOverlay} />
                    <View style={styles.bottomOverlay} />

                    <SafeAreaView style={styles.topContainer}>
                        <View style={styles.progressRow}>
                            {userGroup.stories.map((_: any, idx: number) => (
                                <View key={idx} style={styles.progressBg}>
                                    <Animated.View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: idx === currentStoryIdx && isActive
                                                    ? progress.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: ['0%', '100%'],
                                                    })
                                                    : idx < currentStoryIdx ? '100%' : '0%',
                                            },
                                        ]}
                                    />
                                </View>
                            ))}
                        </View>

                        <View style={styles.header}>
                            <View style={styles.userInfo}>
                                <Image
                                    source={{ uri: avatarUrl && avatarUrl.startsWith('http') ? avatarUrl : 'https://ui-avatars.com/api/?name=' + storyUser.username }}
                                    style={styles.avatar}
                                />
                                <View style={styles.userText}>
                                    <Text style={styles.username}>@{storyUser.username}</Text>
                                    <Text style={styles.metaText}>
                                        {currentStoryIdx + 1} of {userGroup.stories.length} · {currentStory.created_at ? new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                                <Icon name="close" size={28} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>

                    <View style={styles.interactionLayer}>
                        <View style={styles.viewCountContainer}>
                            <Icon name="eye-outline" size={16} color="#FFF" />
                            <Text style={styles.viewCountText}>{currentStory.view_count || 0} views</Text>
                        </View>

                        <View style={styles.footer}>
                            <View style={styles.inputWrap}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Reply to story..."
                                    placeholderTextColor="#CCC"
                                    value={reply}
                                    onChangeText={setReply}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.heartBtn}
                                onPress={() => setIsLiked(!isLiked)}
                            >
                                <Icon
                                    name={isLiked ? "heart" : "heart-outline"}
                                    size={28}
                                    color={isLiked ? "#EF4444" : "#FFF"}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <FlatList
            ref={flatListRef}
            data={allStoryGroups}
            renderItem={renderUserStories}
            keyExtractor={(item, index) => `user-${item.user.id}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            getItemLayout={(data, index) => ({
                length: width,
                offset: width * index,
                index,
            })}
            onScrollToIndexFailed={(info) => {
                // Handle scroll failures gracefully
                if (flatListRef.current && isMounted.current) {
                    setTimeout(() => {
                        if (flatListRef.current && isMounted.current) {
                            try {
                                flatListRef.current.scrollToIndex({ index: info.index, animated: false });
                            } catch (e) {
                                // Ignore
                            }
                        }
                    }, 100);
                }
            }}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyContent: {
        flex: 1,
    },
    media: {
        width: width,
        height: height,
        position: 'absolute',
    },
    textContent: {
        padding: 24,
        fontWeight: 'bold',
        maxWidth: '90%',
    },
    topOverlay: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: 150,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    bottomOverlay: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: 150,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    topContainer: {
        paddingHorizontal: 12,
        paddingTop: 10,
    },
    progressRow: {
        flexDirection: 'row',
        height: 3,
        marginBottom: 12,
        gap: 4,
    },
    progressBg: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    userText: {
        justifyContent: 'center',
    },
    username: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    metaText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    interactionLayer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
    },
    viewCountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
    },
    viewCountText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    inputWrap: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 20,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    input: {
        color: '#FFF',
        fontSize: 15,
    },
    heartBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
});
