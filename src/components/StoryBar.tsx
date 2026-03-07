import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { Story } from '@/types';

export default function StoryBar() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user } = useAuthStore();
    const [stories, setStories] = useState<Story[]>([]);

    useEffect(() => {
        loadStories();
    }, []);

    const loadStories = async () => {
        try {
            const response = await api.getFollowingStories();
            if (response.success && response.data) {
                setStories(response.data);
            }
        } catch (error) {
            console.error('Error loading stories:', error);
        }
    };

    const handleCreateStory = () => {
        navigation.navigate('CreateStory' as never);
    };

    const handleViewStory = (story: Story) => {
        navigation.navigate('StoryView' as never, { userId: story.user.id } as never);
    };

    // Check for valid avatar URL
    const userAvatarUri = user?.profile_picture_url || '';
    const hasValidUserAvatar = userAvatarUri && userAvatarUri !== 'null' && userAvatarUri.length > 0 && userAvatarUri.startsWith('http');

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
        >
            {/* Create Story */}
            <TouchableOpacity style={styles.storyItem} onPress={handleCreateStory}>
                <View
                    style={[styles.createStoryGradient, { backgroundColor: colors.primary }]}
                >
                    {hasValidUserAvatar ? (
                        <Image
                            source={{ uri: userAvatarUri }}
                            style={styles.createStoryImage}
                        />
                    ) : (
                        <View style={[styles.createStoryImage, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>
                                {user?.username?.[0]?.toUpperCase() || '+'}
                            </Text>
                        </View>
                    )}
                    <View style={styles.addIcon}>
                        <Icon name="add" size={16} color="#FFFFFF" />
                    </View>
                </View>
                <Text style={[styles.storyUsername, { color: colors.text }]}>
                    Your Story
                </Text>
            </TouchableOpacity>

            {/* Stories from following */}
            {stories.map((story) => {
                const storyAvatarUri = story.user.profile_picture_url || '';
                const hasValidStoryAvatar = storyAvatarUri && storyAvatarUri !== 'null' && storyAvatarUri.length > 0 && storyAvatarUri.startsWith('http');

                return (
                    <TouchableOpacity
                        key={story.id}
                        style={styles.storyItem}
                        onPress={() => handleViewStory(story)}
                    >
                        <View
                            style={[styles.storyGradient, { backgroundColor: colors.primary }]}
                        >
                            {hasValidStoryAvatar ? (
                                <Image
                                    source={{ uri: storyAvatarUri }}
                                    style={styles.storyImage}
                                />
                            ) : (
                                <View style={[styles.storyImage, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
                                        {story.user.username?.[0]?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text
                            style={[styles.storyUsername, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {story.user.username}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        maxHeight: 120,
    },
    content: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 12,
    },
    storyItem: {
        alignItems: 'center',
        width: 70,
    },
    createStoryGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    createStoryImage: {
        width: 58,
        height: 58,
        borderRadius: 29,
    },
    addIcon: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#667eea',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    storyGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        padding: 3,
    },
    storyImage: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    storyUsername: {
        fontSize: 12,
        textAlign: 'center',
    },
});
