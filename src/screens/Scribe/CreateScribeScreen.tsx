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
    Animated,
    DeviceEventEmitter,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

interface RouteParams {
    initialText?: string;
    initialImage?: string;
}

export default function CreateScribeScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { colors } = useThemeStore();
    const { user } = useAuthStore();
    const { initialText, initialImage } = (route.params as RouteParams) || {};

    const [content, setContent] = useState(initialText || '');
    const [selectedImage, setSelectedImage] = useState<string | null>(initialImage || null);
    const [isPosting, setIsPosting] = useState(false);
    const [isCodeMode, setIsCodeMode] = useState(false);
    const [activeCodeTab, setActiveCodeTab] = useState<'html' | 'css' | 'js' | 'preview'>('html');
    const [codeContent, setCodeContent] = useState({
        html: '',
        css: '',
        js: ''
    });
    const textInputRef = useRef<TextInput>(null);

    const generateHtmlContent = () => {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <style>
                    body { margin: 0; padding: 0; }
                    ${codeContent.css || ''}
                </style>
            </head>
            <body>
                ${codeContent.html || ''}
                <script>
                    ${codeContent.js || ''}
                </script>
            </body>
            </html>
        `;
    };

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: 'Create Scribe',
            headerLeft: () => (
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                    <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            ),
            headerRight: () => (
                <TouchableOpacity
                    onPress={handlePost}
                    disabled={isCodeMode ? !codeContent.html.trim() && !codeContent.css.trim() && !codeContent.js.trim() && !selectedImage : !content.trim() && !selectedImage}
                    style={[styles.postButton, { opacity: (isCodeMode ? (codeContent.html.trim() || codeContent.css.trim() || codeContent.js.trim() || selectedImage) : (content.trim() || selectedImage)) ? 1 : 0.5 }]}
                >
                    {isPosting ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                        <Text style={[styles.postButtonText, { color: '#007AFF' }]}>Post</Text>
                    )}
                </TouchableOpacity>
            ),
        });
    }, [navigation, colors, content, selectedImage, isPosting, isCodeMode, codeContent]);

    const handlePost = async () => {
        if (isCodeMode) {
            if (!codeContent.html.trim() && !codeContent.css.trim() && !codeContent.js.trim()) {
                Alert.alert('Error', 'Please add some code');
                return;
            }
            performUpload();
        } else {
            const finalContent = content.trim();
            if (!finalContent && !selectedImage) {
                Alert.alert('Error', 'Please add some content or an image');
                return;
            }

            // Check content length and warn if very long
            if (finalContent.length > 50000) { // 50k characters warning
                Alert.alert(
                    'Long Content Detected',
                    `Your content is ${finalContent.length} characters long. This may take longer to upload. Continue?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Continue', onPress: () => performUpload(finalContent) }
                    ]
                );
                return;
            }
            performUpload(finalContent);
        }
    };

    const performUpload = async (finalContent?: string) => {
        setIsPosting(true);
        try {
            const formData = new FormData();

            if (isCodeMode) {
                formData.append('content_type', 'code_scribe');
                formData.append('code_html', codeContent.html);
                formData.append('code_css', codeContent.css);
                formData.append('code_js', codeContent.js);
                formData.append('content', content.trim());
            } else {
                formData.append('content_type', 'text');

                // Handle very long content by splitting if needed
                if (finalContent && finalContent.length > 100000) { // 100k characters - split into chunks
                    console.log('🔄 Splitting long content into chunks...');
                    const chunks = [];
                    for (let i = 0; i < finalContent.length; i += 50000) {
                        chunks.push(finalContent.slice(i, i + 50000));
                    }

                    // Post as chunks with metadata
                    formData.append('content', chunks[0]); // First chunk
                    formData.append('is_chunked', 'true');
                    formData.append('total_chunks', chunks.length.toString());
                    formData.append('chunk_index', '0');

                    // Add remaining chunks as separate fields
                    chunks.forEach((chunk, index) => {
                        if (index > 0) {
                            formData.append(`chunk_${index}`, chunk);
                        }
                    });
                } else if (finalContent) {
                    formData.append('content', finalContent);
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

            console.log('📤 Uploading scribe...', {
                hasImage: !!selectedImage,
                isCodeMode
            });

            const response = await api.postScribe(formData);

            if (response.success) {
                DeviceEventEmitter.emit('SCRIBE_POSTED');
                Alert.alert('Success', 'Scribe posted successfully!');
                navigation.goBack();
            } else {
                Alert.alert('Error', response.error || 'Failed to post scribe');
            }
        } catch (error) {
            console.error('Error posting scribe:', error);

            // Provide more specific error messages
            let errorMessage = 'Failed to post scribe';
            if (error instanceof Error) {
                if (error.message.includes('413')) {
                    errorMessage = 'Content too large. Try reducing the code length or removing images.';
                } else if (error.message.includes('timeout')) {
                    errorMessage = 'Upload timed out. Try again with a smaller file.';
                } else if (error.message.includes('network')) {
                    errorMessage = 'Network error. Check your connection and try again.';
                }
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setIsPosting(false);
        }
    };

    const pickImage = async () => {
        // Modern Android (API 33+) does not need/grant READ_EXTERNAL_STORAGE anymore.
        // The system photo picker resolves this automatically.
        if (Platform.OS === 'ios') {
            const permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
            const result = await request(permission);
            if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED) {
                Alert.alert('Permission needed', 'Please grant photo library permissions to upload images in your device Settings.');
                return;
            }
        }

        launchImageLibrary(
            {
                mediaType: 'photo',
                includeBase64: false,
                maxHeight: 800,
                maxWidth: 600,
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

    const takePhoto = async () => {
        const permission = Platform.OS === 'ios'
            ? PERMISSIONS.IOS.CAMERA
            : PERMISSIONS.ANDROID.CAMERA;

        const result = await request(permission);
        if (result !== RESULTS.GRANTED) {
            Alert.alert('Permission needed', 'Please grant camera permissions to take photos in your device Settings.');
            return;
        }

        launchCamera(
            {
                mediaType: 'photo',
                includeBase64: false,
                maxHeight: 800,
                maxWidth: 600,
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

    const removeImage = () => {
        setSelectedImage(null);
    };

    const insertCodeBlock = () => {
        const codeBlock = '\n```\nYour code here\n```\n';
        setContent(prev => prev + codeBlock);
        textInputRef.current?.focus();
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={styles.container}>
                {/* Advanced Mode Toggle Bar */}
                <View style={styles.modeToggleContainer}>
                    <View style={styles.modeToggleWrapper}>
                        <TouchableOpacity
                            style={[
                                styles.modeToggleButton,
                                !isCodeMode && styles.modeToggleButtonActive
                            ]}
                            onPress={() => setIsCodeMode(false)}
                            activeOpacity={0.8}
                        >
                            <Icon name="document-text" size={16} color={!isCodeMode ? '#3B82F6' : '#6B7280'} />
                            <Text style={[
                                styles.modeToggleText,
                                !isCodeMode && styles.modeToggleTextActive
                            ]}>Standard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.modeToggleButton,
                                isCodeMode && styles.modeToggleButtonActive
                            ]}
                            onPress={() => setIsCodeMode(true)}
                            activeOpacity={0.8}
                        >
                            <Icon name="code-slash" size={16} color={isCodeMode ? '#3B82F6' : '#6B7280'} />
                            <Text style={[
                                styles.modeToggleText,
                                isCodeMode && styles.modeToggleTextActive
                            ]}>Code Block</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* User Info (Only show in Standard mode to save space for Code) */}
                {!isCodeMode && (
                    <View style={styles.userInfo}>
                        <Image
                            source={{ uri: user?.profile_picture_url || 'https://via.placeholder.com/40' }}
                            style={styles.avatar}
                        />
                        <View style={styles.userDetails}>
                            <Text style={[styles.username, { color: colors.text }]}>
                                {user?.full_name || user?.username}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Content Input area */}
                <View style={[styles.contentContainer, isCodeMode && { paddingTop: 0 }]}>
                    {isCodeMode ? (
                        <View style={styles.codeEditorContainer}>
                            {/* Code Tabs */}
                            <View style={styles.codeTabsWrapper}>
                                <TouchableOpacity
                                    style={[styles.codeTab, activeCodeTab === 'html' && styles.codeTabActive]}
                                    onPress={() => setActiveCodeTab('html')}
                                >
                                    <Icon name="logo-html5" size={14} color={activeCodeTab === 'html' ? '#E34C26' : '#9CA3AF'} />
                                    <Text style={[styles.codeTabText, activeCodeTab === 'html' && { color: '#E34C26' }]}>HTML</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.codeTab, activeCodeTab === 'css' && styles.codeTabActive]}
                                    onPress={() => setActiveCodeTab('css')}
                                >
                                    <Icon name="color-palette" size={14} color={activeCodeTab === 'css' ? '#1572B6' : '#9CA3AF'} />
                                    <Text style={[styles.codeTabText, activeCodeTab === 'css' && { color: '#1572B6' }]}>CSS</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.codeTab, activeCodeTab === 'js' && styles.codeTabActive]}
                                    onPress={() => setActiveCodeTab('js')}
                                >
                                    <Icon name="logo-javascript" size={14} color={activeCodeTab === 'js' ? '#F7DF1E' : '#9CA3AF'} />
                                    <Text style={[styles.codeTabText, activeCodeTab === 'js' && { color: '#D4B812' }]}>JS</Text>
                                </TouchableOpacity>

                                <View style={styles.tabSpacer} />

                                <TouchableOpacity
                                    style={[styles.codeTab, activeCodeTab === 'preview' && styles.codeTabActivePreview]}
                                    onPress={() => setActiveCodeTab('preview')}
                                >
                                    <Icon name="play-circle" size={14} color={activeCodeTab === 'preview' ? '#FFFFFF' : '#3B82F6'} />
                                    <Text style={[styles.codeTabText, { color: activeCodeTab === 'preview' ? '#FFFFFF' : '#3B82F6' }]}>Preview</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Code Editor Body */}
                            <View style={styles.editorBody}>
                                {activeCodeTab === 'preview' ? (
                                    <View style={styles.previewContainer}>
                                        <WebView
                                            source={{ html: generateHtmlContent() }}
                                            style={styles.webview}
                                            scrollEnabled={true}
                                        />
                                    </View>
                                ) : (
                                    <TextInput
                                        style={[styles.codeInput, { color: colors.text, backgroundColor: '#F8FAFC' }]}
                                        placeholder={`Write your ${activeCodeTab.toUpperCase()} code here...`}
                                        placeholderTextColor={'#94A3B8'}
                                        multiline
                                        value={codeContent[activeCodeTab as 'html' | 'css' | 'js']}
                                        onChangeText={(text) => setCodeContent(prev => ({ ...prev, [activeCodeTab]: text }))}
                                        textAlignVertical="top"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                )}
                            </View>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <TextInput
                                ref={textInputRef}
                                style={[styles.textInput, { color: colors.text }]}
                                placeholder="What's on your mind? Create a standard post..."
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                value={content}
                                onChangeText={setContent}
                                textAlignVertical="top"
                            />

                            {/* Selected Image */}
                            {selectedImage && (
                                <View style={styles.imageContainer}>
                                    <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                                    <TouchableOpacity
                                        style={styles.removeImageButton}
                                        onPress={removeImage}
                                    >
                                        <Icon name="close" size={20} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>

                {/* Action Bar (Only relevant for Standard posts, hide for Code mode) */}
                {!isCodeMode && (
                    <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
                        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                            <Icon name="image-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
                            <Icon name="camera-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.characterCount}>
                            <Text style={[styles.characterCountText, { color: colors.textSecondary }]}>
                                {content.length}/280
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    modeToggleContainer: {
        paddingTop: 12,
        paddingBottom: 4,
        paddingHorizontal: 16,
    },
    modeToggleWrapper: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        padding: 4,
    },
    modeToggleButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 6,
        gap: 6,
    },
    modeToggleButtonActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    modeToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    modeToggleTextActive: {
        color: '#3B82F6',
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
    },
    textInput: {
        fontSize: 16,
        lineHeight: 24,
        minHeight: 150,
        paddingTop: 12,
        backgroundColor: 'transparent',
    },
    codeEditorContainer: {
        flex: 1,
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    codeTabsWrapper: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    codeTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    codeTabActive: {
        backgroundColor: '#FFFFFF',
        borderBottomColor: '#3B82F6',
    },
    codeTabActivePreview: {
        backgroundColor: '#3B82F6',
        borderBottomColor: '#2563EB',
    },
    codeTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    tabSpacer: {
        flex: 1,
    },
    editorBody: {
        flex: 1,
    },
    codeInput: {
        flex: 1,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'monospace',
        padding: 16,
        textAlignVertical: 'top',
    },
    previewContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    imageContainer: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    selectedImage: {
        width: '100%',
        height: 250,
        borderRadius: 12,
    },
    removeImageButton: {
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
