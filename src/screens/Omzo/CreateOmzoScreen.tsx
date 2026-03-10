import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    Image,
    ActivityIndicator,
    StyleSheet,
    Platform,
    DeviceEventEmitter,
    KeyboardAvoidingView,
    ScrollView,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Video from 'react-native-video';

export default function CreateOmzoScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user } = useAuthStore();

    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async () => {
        if (!selectedVideo) {
            Alert.alert('Error', 'Please select a video');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('video', {
                uri: selectedVideo,
                name: `video_${Date.now()}.mp4`,
                type: 'video/mp4',
            } as any);

            if (caption.trim()) {
                formData.append('caption', caption.trim());
            }

            const response = await api.uploadOmzo(formData);

            if (response.success) {
                DeviceEventEmitter.emit('SCRIBE_POSTED');
                Alert.alert('Success', 'Omzo uploaded successfully!');
                navigation.goBack();
            } else {
                Alert.alert('Error', response.error || 'Failed to upload omzo');
            }
        } catch (error) {
            console.error('Error uploading omzo:', error);
            Alert.alert('Error', 'Failed to upload omzo');
        } finally {
            setIsUploading(false);
        }
    };

    const pickVideo = async () => {
        if (Platform.OS === 'ios') {
            const permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
            const result = await request(permission);
            if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED) {
                Alert.alert('Permission needed', 'Please grant media library permissions in your device Settings.');
                return;
            }
        }

        launchImageLibrary(
            {
                mediaType: 'video',
                includeBase64: false,
                quality: 0.8,
            },
            (response) => {
                if (!response.didCancel && !response.errorMessage && response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        setSelectedVideo(asset.uri);
                        setThumbnail(asset.uri);
                    }
                }
            }
        );
    };

    const recordVideo = async () => {
        const permission = Platform.OS === 'ios'
            ? PERMISSIONS.IOS.CAMERA
            : PERMISSIONS.ANDROID.CAMERA;

        const result = await request(permission);
        if (result !== RESULTS.GRANTED) {
            Alert.alert('Permission needed', 'Please grant camera permissions to record videos in your device Settings.');
            return;
        }

        launchCamera(
            {
                mediaType: 'video',
                includeBase64: false,
                quality: 0.8,
            },
            (response) => {
                if (!response.didCancel && !response.errorMessage && response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        setSelectedVideo(asset.uri);
                        setThumbnail(asset.uri);
                    }
                }
            }
        );
    };

    const removeVideo = () => {
        setSelectedVideo(null);
        setThumbnail(null);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 16 }}>
                    <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Create Omzo</Text>
                <View style={{ paddingRight: 16 }}>
                    <TouchableOpacity
                        onPress={handleUpload}
                        disabled={!selectedVideo || isUploading}
                        style={[
                            styles.postButton,
                            { opacity: selectedVideo && !isUploading ? 1 : 0.5 }
                        ]}
                    >
                        {isUploading ? (
                            <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                            <Text style={[styles.postButtonText, { color: '#3B82F6' }]}>Post</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <ScrollView
                        style={styles.container}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.userInfo}>
                            {user?.profile_picture_url ? (
                                <Image source={{ uri: user.profile_picture_url }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                                        {user?.username?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.userDetails}>
                                <Text style={[styles.username, { color: colors.text }]}>
                                    {user?.full_name || user?.username}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.contentContainer}>
                            <TextInput
                                style={[styles.textInput, { color: colors.text }]}
                                placeholder="What's this Omzo about?"
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                value={caption}
                                onChangeText={setCaption}
                                maxLength={150}
                            />

                            {selectedVideo && (
                                <View style={styles.videoContainer}>
                                    <Video
                                        source={{ uri: selectedVideo }}
                                        style={styles.video}
                                        resizeMode="cover"
                                        repeat={true}
                                        paused={false}
                                        muted={false}
                                    />
                                    <TouchableOpacity
                                        style={styles.removeVideoButton}
                                        onPress={removeVideo}
                                    >
                                        <Icon name="close" size={20} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    {/* Action Bar pinned to keyboard */}
                    <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
                        <TouchableOpacity style={styles.actionButton} onPress={pickVideo}>
                            <Icon name="folder-open-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={recordVideo}>
                            <Icon name="videocam-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.characterCount}>
                            <Text style={[styles.characterCountText, { color: colors.textSecondary }]}>
                                {caption.length}/150
                            </Text>
                        </View>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    userDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    username: {
        fontSize: 16,
        fontWeight: '700',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
    },
    textInput: {
        fontSize: 16,
        lineHeight: 24,
        minHeight: 80,
        paddingTop: 12,
        backgroundColor: 'transparent',
        textAlignVertical: 'top',
    },
    videoContainer: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#000',
    },
    video: {
        width: '100%',
        height: 450,
        borderRadius: 12,
    },
    removeVideoButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    actionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        gap: 16,
        backgroundColor: '#FFFFFF',
    },
    actionButton: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
    },
    characterCount: {
        marginLeft: 'auto',
    },
    characterCountText: {
        fontSize: 13,
        fontWeight: '500',
    },
    postButton: {
        backgroundColor: '#EBF5FF',
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
    },
    postButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
