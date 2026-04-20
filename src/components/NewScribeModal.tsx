import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    DeviceEventEmitter,
    Modal,
    TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

interface NewScribeModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function NewScribeModal({ visible, onClose, onSuccess }: NewScribeModalProps) {
    const { colors } = useThemeStore();
    const { user } = useAuthStore();

    const [activeTab, setActiveTab] = useState<'text' | 'image' | 'code'>('text');
    const [content, setContent] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [codeContent, setCodeContent] = useState({
        html: '',
        css: '',
        js: ''
    });
    const textInputRef = useRef<TextInput>(null);

    const handlePost = async () => {
        const canPost = activeTab === 'code'
            ? (codeContent.html.trim() || codeContent.css.trim() || codeContent.js.trim())
            : activeTab === 'image'
                ? !!selectedImage
                : content.trim();

        if (!canPost) {
            Alert.alert('Error', 'Please add some content');
            return;
        }

        setIsPosting(true);
        try {
            const formData = new FormData();

            if (activeTab === 'code') {
                formData.append('content_type', 'code_scribe');
                formData.append('code_html', codeContent.html);
                formData.append('code_css', codeContent.css);
                formData.append('code_js', codeContent.js);
                formData.append('content', '');
            } else {
                formData.append('content_type', 'text');
                if (content.trim()) {
                    formData.append('content', content.trim());
                }

                if (selectedImage) {
                    const uri = selectedImage;
                    const filename = uri.split('/').pop() || 'image.jpg';
                    const match = /\.(\w+)$/.exec(filename);
                    const type = match ? `image/${match[1]}` : 'image/jpeg';

                    formData.append('image', {
                        uri,
                        name: filename,
                        type,
                    } as any);
                }
            }

            const response = await api.postScribe(formData);

            if (response.success) {
                DeviceEventEmitter.emit('SCRIBE_POSTED');
                Alert.alert('Success', 'Scribe posted successfully!');
                resetAndClose(true);
            } else {
                Alert.alert('Error', response.error || 'Failed to post scribe');
            }
        } catch (error) {
            console.error('Error posting scribe:', error);
            Alert.alert('Error', 'Failed to post scribe');
        } finally {
            setIsPosting(false);
        }
    };

    const resetAndClose = (success = false) => {
        setContent('');
        setSelectedImage(null);
        setCodeContent({ html: '', css: '', js: '' });
        setActiveTab('text');

        if (success && onSuccess) {
            onSuccess();
        } else {
            onClose();
        }
    };

    const pickImage = async () => {
        if (Platform.OS === 'ios') {
            const permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
            const result = await request(permission);
            if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED) {
                Alert.alert('Permission needed', 'Please grant photo library permissions first.');
                return;
            }
        }

        launchImageLibrary(
            {
                mediaType: 'photo',
                includeBase64: false,
                maxHeight: 1200,
                maxWidth: 1200,
                quality: 0.8,
            },
            (response) => {
                if (!response.didCancel && !response.errorMessage && response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        setSelectedImage(asset.uri);
                    }
                }
            }
        );
    };

    const pickGif = async () => {
        if (Platform.OS === 'ios') {
            const permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
            const result = await request(permission);
            if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED) {
                Alert.alert('Permission needed', 'Please grant photo library permissions first.');
                return;
            }
        }

        // Don't constrain mediaType to allow true GIF selection
        // Use mixed type to allow all image formats including animated GIFs
        launchImageLibrary(
            {
                mediaType: 'mixed',  // Changed from 'photo' to allow all image types including GIFs
                includeBase64: false,
                maxHeight: 1200,
                maxWidth: 1200,
                quality: 1,  // Full quality to preserve GIF animation
            },
            (response) => {
                if (!response.didCancel && !response.errorMessage && response.assets && response.assets.length > 0) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        // Check if it's likely a GIF based on filename
                        const filename = asset.uri.split('/').pop() || '';
                        if (filename.toLowerCase().endsWith('.gif')) {
                            console.log('🎬 GIF selected:', filename);
                        }
                        setSelectedImage(asset.uri);
                    }
                }
            }
        );
    };

    const canPost = activeTab === 'code'
        ? (codeContent.html.trim() || codeContent.css.trim() || codeContent.js.trim())
        : activeTab === 'image'
            ? !!selectedImage
            : content.trim();

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={styles.modalContainer}
                        >
                            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                                {/* Header */}
                                <View style={styles.header}>
                                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                        <Icon name="close" size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.title, { color: colors.text }]}>New Scribe</Text>
                                    <TouchableOpacity
                                        onPress={handlePost}
                                        disabled={!canPost || isPosting}
                                        style={[
                                            styles.postButton,
                                            { backgroundColor: canPost ? colors.primary : '#A1C4FD' }
                                        ]}
                                    >
                                        {isPosting ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <Text style={[styles.postButtonText, { color: '#FFFFFF' }]}>Post</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Tabs */}
                                <View style={[styles.tabsWrapper, { borderBottomColor: colors.border }]}>
                                    <TouchableOpacity
                                        style={[styles.tabItem, activeTab === 'text' && styles.tabItemActive]}
                                        onPress={() => setActiveTab('text')}
                                    >
                                        <Text style={[styles.tabIconText, { color: activeTab === 'text' ? '#FFFFFF' : '#64748B' }]}>Aa</Text>
                                        <Text style={[styles.tabText, activeTab === 'text' && styles.tabTextActive]}>Text</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.tabItem, activeTab === 'image' && styles.tabItemActive]}
                                        onPress={() => setActiveTab('image')}
                                    >
                                        <Icon name="image-outline" size={16} color={activeTab === 'image' ? '#FFFFFF' : '#64748B'} />
                                        <Text style={[styles.tabText, activeTab === 'image' && styles.tabTextActive]}>Image</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.tabItem, activeTab === 'code' && styles.tabItemActive]}
                                        onPress={() => setActiveTab('code')}
                                    >
                                        <Icon name="code-slash" size={16} color={activeTab === 'code' ? '#FFFFFF' : '#64748B'} />
                                        <Text style={[styles.tabText, activeTab === 'code' && styles.tabTextActive]}>Code</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Content */}
                                <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
                                    <View style={styles.userInfo}>
                                        <Image
                                            source={{ uri: user?.profile_picture_url || 'https://via.placeholder.com/40' }}
                                            style={styles.avatar}
                                        />
                                        <View style={styles.inputHeader}>
                                            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>What's on your mind?</Text>
                                            <Text style={[styles.charCountText, { color: colors.textSecondary }]}>
                                                {activeTab === 'text' ? `${content.length}/500` : activeTab === 'image' ? (selectedImage ? '1/1' : '0/1') : `${codeContent.html.length + codeContent.css.length + codeContent.js.length}/2000`}
                                            </Text>
                                        </View>
                                    </View>

                                    {(activeTab === 'text' || activeTab === 'image') && (
                                        <TextInput
                                            ref={textInputRef}
                                            style={[styles.mainTextInput, { color: colors.text }]}
                                            placeholder="Type here..."
                                            placeholderTextColor={colors.textSecondary + '80'}
                                            multiline
                                            value={content}
                                            onChangeText={setContent}
                                            maxLength={500}
                                        />
                                    )}

                                    {activeTab === 'image' && (
                                        <View style={styles.imageTabContent}>
                                            {selectedImage ? (
                                                <View style={styles.selectedImageContainer}>
                                                    <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                                                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
                                                        <Icon name="close" size={20} color="#FFFFFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <View style={styles.imagePickerOptions}>
                                                    <TouchableOpacity style={[styles.imagePickerBox, { flex: 1, marginRight: 8 }]} onPress={pickImage}>
                                                        <View style={styles.uploadPlaceholder}>
                                                            <Icon name="image-outline" size={40} color={colors.textSecondary} />
                                                            <Text style={[styles.uploadText, { color: colors.textSecondary, marginTop: 8 }]}>Photo</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={[styles.imagePickerBox, { flex: 1, marginLeft: 8 }]} onPress={pickGif}>
                                                        <View style={styles.uploadPlaceholder}>
                                                            <Text style={[styles.uploadText, { color: colors.textSecondary, fontSize: 32 }]}>🎬</Text>
                                                            <Text style={[styles.uploadText, { color: colors.textSecondary, marginTop: 8 }]}>GIF</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {activeTab === 'code' && (
                                        <View style={styles.codeTabContent}>
                                            <View style={styles.codeSection}>
                                                <Text style={styles.codeLabel}>HTML</Text>
                                                <TextInput
                                                    style={[styles.codeInputField, { color: colors.text, backgroundColor: colors.background }]}
                                                    placeholder="<div>Hello World</div>"
                                                    placeholderTextColor={colors.textSecondary + '60'}
                                                    multiline
                                                    value={codeContent.html}
                                                    onChangeText={(text) => setCodeContent(prev => ({ ...prev, html: text }))}
                                                    autoCapitalize="none"
                                                />
                                            </View>

                                            <View style={styles.codeSection}>
                                                <Text style={styles.codeLabel}>CSS</Text>
                                                <TextInput
                                                    style={[styles.codeInputField, { color: colors.text, backgroundColor: colors.background }]}
                                                    placeholder="div { color: blue; }"
                                                    placeholderTextColor={colors.textSecondary + '60'}
                                                    multiline
                                                    value={codeContent.css}
                                                    onChangeText={(text) => setCodeContent(prev => ({ ...prev, css: text }))}
                                                    autoCapitalize="none"
                                                />
                                            </View>

                                            <View style={styles.codeSection}>
                                                <Text style={styles.codeLabel}>JAVASCRIPT</Text>
                                                <TextInput
                                                    style={[styles.codeInputField, { color: colors.text, backgroundColor: colors.background }]}
                                                    placeholder="console.log('Hello');"
                                                    placeholderTextColor={colors.textSecondary + '60'}
                                                    multiline
                                                    value={codeContent.js}
                                                    onChangeText={(text) => setCodeContent(prev => ({ ...prev, js: text }))}
                                                    autoCapitalize="none"
                                                />
                                            </View>
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    modalContainer: {
        width: '98%',
        maxWidth: 650,
        height: '85%',
    },
    modalContent: {
        borderRadius: 24,
        overflow: 'hidden',
        width: '100%',
        height: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    closeBtn: {
        padding: 4,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
    },
    postButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    postButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    tabsWrapper: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        borderBottomWidth: 1,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        gap: 6,
    },
    tabItemActive: {
        backgroundColor: '#3B82F6',
    },
    tabIconText: {
        fontSize: 14,
        fontWeight: '700',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    scroll: {
        flex: 1,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 10,
    },
    inputHeader: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 15,
        fontWeight: '500',
    },
    charCountText: {
        fontSize: 12,
        fontWeight: '500',
    },
    mainTextInput: {
        fontSize: 15,
        lineHeight: 22,
        minHeight: 100,
        paddingHorizontal: 16,
        paddingBottom: 20,
        textAlignVertical: 'top',
    },
    imageTabContent: {
        padding: 16,
    },
    imagePickerOptions: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
    },
    imagePickerBox: {
        width: '100%',
        aspectRatio: 1.8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    uploadPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    uploadText: {
        fontSize: 14,
        fontWeight: '600',
    },
    selectedImageContainer: {
        flex: 1,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    removeImageBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    codeTabContent: {
        padding: 16,
        gap: 16,
    },
    codeSection: {
        gap: 6,
    },
    codeLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    codeInputField: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 12,
        fontSize: 13,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        minHeight: 80,
        textAlignVertical: 'top',
    },
});
