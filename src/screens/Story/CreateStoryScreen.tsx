import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    TextInput,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';

const BG_COLORS = [
    '#667eea', '#764ba2', '#ff9a9e', '#a18cd1', '#fbc2eb',
    '#84fab0', '#a1c4fd', '#ffecd2', '#243b55', '#000000'
];

export default function CreateStoryScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();

    const [content, setContent] = useState('');
    const [media, setMedia] = useState<any>(null);
    const [storyType, setStoryType] = useState<'text' | 'image' | 'video'>('text');
    const [bgColor, setBgColor] = useState(BG_COLORS[0]);
    const [isUploading, setIsUploading] = useState(false);

    const handlePickMedia = async () => {
        const result = await launchImageLibrary({
            mediaType: 'mixed',
            selectionLimit: 1,
            quality: 0.8,
        });

        if (result.assets && result.assets[0]) {
            const asset = result.assets[0];
            setMedia(asset);
            if (asset.type?.startsWith('video')) {
                setStoryType('video');
            } else {
                setStoryType('image');
            }
        }
    };

    const handleCreateStory = async () => {
        if (storyType === 'text' && !content.trim()) {
            Alert.alert('Error', 'Please enter some text for your story');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('story_type', storyType);
            formData.append('content', content);
            formData.append('background_color', bgColor);
            formData.append('text_color', '#ffffff');

            if (media) {
                formData.append('media', {
                    uri: Platform.OS === 'ios' ? media.uri.replace('file://', '') : media.uri,
                    type: media.type || 'image/jpeg',
                    name: media.fileName || 'story_media',
                } as any);
            }

            const response = await api.createStory(formData);
            if (response.success) {
                Alert.alert('Success', 'Story posted successfully!');
                navigation.goBack();
            } else {
                Alert.alert('Error', response.error || 'Failed to post story');
            }
        } catch (error) {
            console.error('Error creating story:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: storyType === 'text' ? bgColor : '#000' }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Icon name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleCreateStory}
                        disabled={isUploading}
                        style={[styles.postBtn, { backgroundColor: '#FFF' }]}
                    >
                        {isUploading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={[styles.postBtnText, { color: colors.primary }]}>Post</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Content Area */}
                <View style={styles.contentContainer}>
                    {storyType === 'text' ? (
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type a thought..."
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            multiline
                            value={content}
                            onChangeText={setContent}
                            autoFocus
                        />
                    ) : (
                        <View style={styles.mediaPreview}>
                            <Image source={{ uri: media?.uri }} style={styles.previewImage} />
                            <TouchableOpacity style={styles.removeMedia} onPress={() => { setMedia(null); setStoryType('text'); }}>
                                <Icon name="trash" size={20} color="#FFF" />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.captionInput}
                                placeholder="Add a caption..."
                                placeholderTextColor="rgba(255,255,255,0.8)"
                                value={content}
                                onChangeText={setContent}
                            />
                        </View>
                    )}
                </View>

                {/* Tools */}
                <View style={styles.tools}>
                    {storyType === 'text' && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
                            {BG_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[styles.colorOption, { backgroundColor: color, borderColor: bgColor === color ? '#FFF' : 'transparent' }]}
                                    onPress={() => setBgColor(color)}
                                />
                            ))}
                        </ScrollView>
                    )}

                    <View style={styles.bottomTools}>
                        <TouchableOpacity style={styles.toolBtn} onPress={handlePickMedia}>
                            <Icon name="images" size={24} color="#FFF" />
                            <Text style={styles.toolText}>Gallery</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    postBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 80,
    },
    postBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    textInput: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    mediaPreview: {
        flex: 1,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeMedia: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captionInput: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        color: '#FFF',
        fontSize: 16,
    },
    tools: {
        paddingBottom: 20,
    },
    colorScroll: {
        maxHeight: 60,
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 2,
    },
    bottomTools: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    toolBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
    },
    toolText: {
        color: '#FFF',
        fontWeight: '600',
    },
});
