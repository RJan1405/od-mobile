import React, { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image,
    Keyboard,
    Alert,
    Modal,
} from 'react-native';
import Video from 'react-native-video';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import DocumentPicker from 'react-native-document-picker';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import websocket from '@/services/websocket';
import api from '@/services/api';
import { P2PFileTransferService, type P2PStatus } from '@/services/p2pFileTransfer';
import type { Message } from '@/types';

const MessageImage = ({ uri, showText, isImage }: { uri: string; showText: boolean; isImage: boolean }) => {
    const [aspectRatio, setAspectRatio] = useState<number>(1.5); // Default to a reasonable landscape ratio

    useEffect(() => {
        if (!uri) return;
        Image.getSize(
            uri,
            (width, height) => {
                if (width && height && height > 0) {
                    setAspectRatio(width / height);
                }
            },
            () => {
                // Ignore error, use default
            }
        );
    }, [uri]);

    return (
        <Image
            source={{ uri }}
            style={{
                width: 260,
                height: undefined,
                aspectRatio: Math.max(0.4, Math.min(aspectRatio, 2.5)),
                resizeMode: 'cover', // Parent handles overflow and borderRadius
            }}
        />
    );
};

const MessageVideo = ({ uri }: { uri: string }) => {
    const [aspectRatio, setAspectRatio] = useState<number>(1.5);
    const [paused, setPaused] = useState(true);

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setPaused(!paused)}
            style={{
                width: 260,
                aspectRatio: Math.max(0.5, Math.min(aspectRatio, 2.0)),
                backgroundColor: '#000',
                justifyContent: 'center',
                alignItems: 'center'
            }}
        >
            <Video
                source={{ uri }}
                style={{ width: '100%', height: '100%', position: 'absolute' }}
                resizeMode="cover"
                controls={!paused}
                paused={paused}
                onLoad={(e) => {
                    if (e.naturalSize && e.naturalSize.width && e.naturalSize.height) {
                        setAspectRatio(e.naturalSize.width / e.naturalSize.height);
                    }
                }}
                onEnd={() => setPaused(true)}
            />
            {paused && (
                <View style={{
                    width: 54, height: 54,
                    borderRadius: 27,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'absolute'
                }}>
                    <Icon name="play" size={28} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </View>
            )}
        </TouchableOpacity>
    );
};

export default function ChatScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user } = useAuthStore();
    const { messages, loadMessages, addMessage, sendMessage, chats, updateMessage, markChatAsRead, consumeMessage } = useChatStore();
    const { chatId } = route.params as { chatId: number };
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [otherTyping, setOtherTyping] = useState(false);
    const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isOneTimeMode, setIsOneTimeMode] = useState(false);
    const [oneTimeModalVisible, setOneTimeModalVisible] = useState(false);
    const [revealedContent, setRevealedContent] = useState<{
        type: 'text' | 'image' | 'video' | 'document';
        content: string;
        mediaUrl?: string;
    } | null>(null);
    const [isConsuming, setIsConsuming] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const currentChat = chats.find(c => c.id === chatId);

    // ── P2P Transfer state ───────────────────────────────────────────────
    const [p2pStatus, setP2pStatus] = useState<P2PStatus>('idle');
    const [p2pProgress, setP2pProgress] = useState(0);
    const [p2pFileName, setP2pFileName] = useState('');
    const [incomingOffer, setIncomingOffer] = useState<{ signal: any; fileName: string; fileSize: number } | null>(null);
    const p2pRef = useRef<P2PFileTransferService | null>(null);

    useEffect(() => {
        if (Platform.OS === 'android') {
            const kbShow = Keyboard.addListener('keyboardDidShow', (e) => {
                setKeyboardHeight(e.endCoordinates.height);
            });
            const kbHide = Keyboard.addListener('keyboardDidHide', () => {
                setKeyboardHeight(0);
            });
            return () => {
                kbShow.remove();
                kbHide.remove();
            };
        }
    }, []);

    const handleVoiceCall = () => {
        const targetUser = currentChat?.chat_type === 'private'
            ? currentChat.participants.find(p => p.id !== user?.id)
            : currentChat?.participants[0];

        if (targetUser) {
            (navigation as any).navigate('VoiceCall', { user: targetUser, chatId });
        }
    };

    const handleVideoCall = () => {
        const targetUser = currentChat?.chat_type === 'private'
            ? currentChat.participants.find(p => p.id !== user?.id)
            : currentChat?.participants[0];

        if (targetUser) {
            (navigation as any).navigate('VideoCall', { user: targetUser, chatId });
        }
    };

    useLayoutEffect(() => {
        const title = currentChat?.name || (currentChat?.participants?.[0]?.full_name || currentChat?.participants?.[0]?.username) || 'Chat';
        const avatarUrl = currentChat?.chat_type === 'group'
            ? currentChat?.group_avatar
            : currentChat?.participants?.[0]?.profile_picture_url;
        const targetUser = currentChat?.participants?.[0];

        navigation.setOptions({
            headerTitle: '',
            headerLeft: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
                        <Icon name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            if (targetUser?.username) {
                                (navigation as any).navigate('Profile', { username: targetUser.username });
                            }
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Image
                            source={{ uri: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : 'https://via.placeholder.com/40' }}
                            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                        />
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 4 }} />
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Last seen recently</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            ),
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={handleVoiceCall}
                        style={{ padding: 8, marginLeft: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Icon name="call-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleVideoCall}
                        style={{ padding: 8, marginLeft: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Icon name="videocam-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, currentChat, colors]);

    useEffect(() => {
        loadMessages(chatId);

        // Mark chat as read when opening
        markChatAsRead(chatId);

        // Connect to WebSocket for new messages and typing indicator
        const unsubscribe = websocket.connectToChat(chatId, (data: any) => {
            // Handle message.new and typing.update
            if (data && data.type === 'typing.update') {
                // typing.update: { users: [id, ...] }
                // Show typing indicator if any other user is typing
                if (Array.isArray(data.users)) {
                    setOtherTyping(data.users.some((id: number) => id !== user?.id));
                } else {
                    setOtherTyping(false);
                }
            } else if (data && data.type === 'message.new') {
                addMessage(chatId, data.message);
                // Auto-mark new messages as read if chat is open
                if (data.message.sender?.id !== user?.id) {
                    setTimeout(() => markChatAsRead(chatId), 1000);
                }
            } else if (data && data.id) {
                // Fallback for old message format
                addMessage(chatId, data);
                if (data.sender?.id !== user?.id) {
                    setTimeout(() => markChatAsRead(chatId), 1000);
                }
            }
        });

        // Connect to read receipt updates
        const unsubscribeReadReceipt = websocket.onReadReceipt(chatId, (data) => {
            console.log('📬 Read receipt received:', data);
            // Update message read status in the UI
            updateMessage(chatId, data.message_id, { is_read: true });
        });

        // Connect to OTV consumption updates
        const unsubscribeConsumed = websocket.onMessageConsumed(chatId, (data) => {
            console.log('🔒 Message consumed update:', data);
            updateMessage(chatId, data.message_id, { consumed_at: data.consumed_at });
        });

        return () => {
            unsubscribe();
            unsubscribeReadReceipt();
            unsubscribeConsumed();
            // NOTE: Do NOT call disconnectFromChat here — it destroys ALL callbacks.
            // The socket stays alive until the component truly unmounts.
            setOtherTyping(false);

            // Cleanup P2P on unmount
            if (p2pRef.current) p2pRef.current.cleanup();
        };
    }, [chatId, updateMessage, loadMessages, markChatAsRead, user, addMessage]);

    const sendP2PSignal = useCallback((signal: any) => {
        const targetUser = currentChat?.participants?.find(p => p.id !== user?.id);
        if (targetUser) {
            console.log(`📤 [P2P Signal] Send: ${signal.type} to ${targetUser.id}`);
            websocket.sendP2PSignal(chatId, signal, targetUser.id);
        } else {
            console.warn('⚠️ [P2P] Cannot send signal: No target user found');
        }
    }, [chatId, currentChat, user]);

    // Listen for incoming P2P signals via WebSocket
    useEffect(() => {
        const unsubscribeP2P = websocket.onP2PSignal(chatId, (data) => {
            const sigType = data.signal?.type;
            console.log(`📶 [P2P Signal] Recv: ${sigType} from ${data.sender_id}`);

            // 1. Handle incoming offers when idle
            if (p2pStatus === 'idle' && (sigType === 'file.offer' || sigType === 'webrtc.offer')) {
                const sigData = data.signal;
                setIncomingOffer({
                    signal: sigData,
                    fileName: sigData.meta?.name || sigData.metadata?.name || 'Incoming File...',
                    fileSize: sigData.meta?.size || sigData.metadata?.size || 0,
                });

                // Pre-initialize service to buffer incoming candidates
                const targetId = data.sender_id || currentChat?.participants?.find(p => p.id !== user?.id)?.id;
                if (targetId && !p2pRef.current) {
                    p2pRef.current = new P2PFileTransferService(
                        chatId,
                        Number(targetId),
                        {
                            onStatusChange: (s) => setP2pStatus(s),
                            onProgress: (p) => setP2pProgress(p),
                            onMetadataReceived: (name) => setP2pFileName(name),
                            onReceived: (name, blob) => {
                                Alert.alert('✅ File Received', `"${name}" received successfully!`);
                            },
                            onError: (msg) => {
                                Alert.alert('P2P Error', msg);
                                setP2pStatus('idle');
                                p2pRef.current = null;
                            },
                        },
                        sendP2PSignal
                    );
                }
            }
            // 2. Pass other signals to active session (ICE, Answer, etc.)
            else if (p2pRef.current) {
                p2pRef.current.handleSignal(data.signal);
            }
        });

        return () => unsubscribeP2P();
    }, [chatId, p2pStatus, currentChat, user, sendP2PSignal]);

    const handleSend = async () => {
        if (!inputText.trim()) return;
        const messageText = inputText.trim();
        setInputText('');
        setIsTyping(false);
        websocket.sendTypingStatus(chatId, false);
        try {
            await sendMessage(chatId, messageText, undefined, undefined, isOneTimeMode);
            setIsOneTimeMode(false); // Reset OTV mode after sending
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleSendP2P = async () => {
        setIsAttachMenuVisible(false);
        const targetUser = currentChat?.participants?.find(p => p.id !== user?.id);
        if (!targetUser) {
            Alert.alert('P2P Transfer', 'No target user found in this chat.');
            return;
        }
        try {
            const res = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles] });
            const pickedFile = res[0];
            if (!pickedFile?.uri) return;

            const fileName = pickedFile.name || 'file';
            const fileSize = pickedFile.size || 0;
            const mimeType = pickedFile.type || 'application/octet-stream';

            setP2pFileName(fileName);
            setP2pProgress(0);
            setP2pStatus('connecting');

            const svc = new P2PFileTransferService(
                chatId,
                targetUser.id,
                {
                    onStatusChange: (s) => setP2pStatus(s),
                    onProgress: (p) => setP2pProgress(p),
                    onReceived: () => { },  // sender won't receive
                    onError: (msg) => {
                        Alert.alert('P2P Error', msg);
                        setP2pStatus('idle');
                    },
                },
                sendP2PSignal
            );
            p2pRef.current = svc;
            await svc.sendFile(pickedFile.uri, fileName, fileSize, mimeType);
        } catch (err) {
            if (!DocumentPicker.isCancel(err)) {
                console.error('P2P send error:', err);
            }
        }
    };

    const handleAcceptP2P = async () => {
        if (!incomingOffer || !p2pRef.current) return;

        const offer = incomingOffer;
        setIncomingOffer(null);
        setP2pFileName(offer.fileName);
        setP2pProgress(0);
        // acceptIncomingOffer will trigger onStatusChange('connecting')
        await p2pRef.current.acceptIncomingOffer(offer.signal);
    };

    const handleDeclineP2P = () => {
        setIncomingOffer(null);
        if (p2pRef.current) {
            p2pRef.current.cleanup();
            p2pRef.current = null;
        }
    };

    const handleSendFile = async () => {
        setIsAttachMenuVisible(false);
        try {
            const res = await DocumentPicker.pick({
                type: [DocumentPicker.types.allFiles],
            });
            const pickedFile = res[0];

            if (pickedFile && pickedFile.uri) {
                const content = inputText.trim();
                setInputText('');
                setIsTyping(false);
                websocket.sendTypingStatus(chatId, false);

                await sendMessage(chatId, content, pickedFile.uri, {
                    name: pickedFile.name || 'document',
                    type: pickedFile.type || 'application/octet-stream'
                }, isOneTimeMode);
                setIsOneTimeMode(false); // Reset OTV mode
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }
        } catch (err) {
            if (DocumentPicker.isCancel(err)) {
                // User cancelled the picker
            } else {
                console.error('Error picking document:', err);
            }
        }
    };

    const handleTyping = (text: string) => {
        setInputText(text);
        if (isAttachMenuVisible) setIsAttachMenuVisible(false);

        if (text.length > 0 && !isTyping) {
            setIsTyping(true);
            websocket.sendTypingStatus(chatId, true);
        } else if (text.length === 0 && isTyping) {
            setIsTyping(false);
            websocket.sendTypingStatus(chatId, false);
        }
    };

    const handleConsumeOneTime = async (message: Message) => {
        if (message.consumed_at) {
            Alert.alert('Message expired', 'This one-time view message has already been viewed.');
            return;
        }

        if (isOwnMessage(message)) {
            Alert.alert('View Restricted', 'You cannot view your own one-time message.');
            return;
        }

        setIsConsuming(true);
        try {
            const response = await consumeMessage(chatId, message.id);
            if (response.success) {
                // Determine content type
                let type: 'text' | 'image' | 'video' | 'document' = 'text';
                if (response.media_type?.startsWith('video')) type = 'video';
                else if (response.media_type?.startsWith('image')) type = 'image';
                else if (response.media_url) type = 'document';

                setRevealedContent({
                    type,
                    content: response.content || '',
                    mediaUrl: response.media_url ? api.buildFullUrl(response.media_url) : undefined
                });
                setOneTimeModalVisible(true);

                // Update local state immediately
                updateMessage(chatId, message.id, { consumed_at: new Date().toISOString() });
            } else {
                Alert.alert('Error', response.error || 'Failed to open message');
            }
        } catch (err) {
            console.error('OTV Error:', err);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsConsuming(false);
        }
    };

    const isOwnMessage = (msg: Message) => msg.sender?.id === user?.id;

    const chatMessages = messages.get(chatId) || [];

    const renderMessage = ({ item }: { item: Message }) => {
        const isOwnMessage = item.sender?.id === user?.id;
        const senderName = item.sender?.full_name || item.sender?.username || 'Unknown';

        const isVideo = item.media_url && (item.media_type?.startsWith('video/') || !!item.media_filename?.match(/\.(mp4|mov|avi|wmv)$/i) || !!item.media_url.match(/\.(mp4|mov|avi|wmv)$/i));
        const isImage = !isVideo && item.media_url && (!item.media_type || item.media_type.startsWith('image/') || !!item.media_filename?.match(/\.(jpeg|jpg|gif|png|webp)$/i) || !!item.media_url.match(/\.(jpeg|jpg|gif|png|webp)$/i));
        const hasTextContent = !!item.content && item.content.trim() !== '';
        // Legacy file detection via string, just in case
        const isLegacyFileText = item.content?.startsWith('Sent file:');
        const showText = hasTextContent && !isLegacyFileText;

        if (item.one_time) {
            const isConsumed = !!item.consumed_at;
            const canView = !isOwnMessage && !isConsumed;

            return (
                <View style={[styles.messageWrapper, isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper]}>
                    {!isOwnMessage && (
                        <TouchableOpacity
                            onPress={() => {
                                if (item.sender?.username) {
                                    (navigation as any).navigate('Profile', { username: item.sender.username });
                                }
                            }}
                        >
                            <Text style={[styles.senderName, { color: colors.primary }]}>{senderName}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        activeOpacity={canView ? 0.7 : 0.9}
                        onPress={() => canView && handleConsumeOneTime(item)}
                    >
                        <View
                            style={[
                                styles.messageBubble,
                                isOwnMessage ? styles.ownBubble : styles.otherBubble,
                                {
                                    backgroundColor: isOwnMessage ? colors.primary : '#FFFFFF',
                                    borderColor: isOwnMessage ? colors.primary : colors.border,
                                    borderWidth: isOwnMessage ? 0 : 1,
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    minWidth: 160,
                                },
                            ]}
                        >
                            <View style={[styles.otvIconContainer, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,122,255,0.1)' }]}>
                                <Icon
                                    name={isConsumed ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={isOwnMessage ? '#FFFFFF' : '#007AFF'}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.messageText,
                                        { color: isOwnMessage ? '#FFFFFF' : '#1C1C1E', fontWeight: '600' }
                                    ]}
                                >
                                    {isConsumed ? 'Opened' : 'One-time view'}
                                </Text>
                                <Text
                                    style={{
                                        color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#8E8E93',
                                        fontSize: 12,
                                        marginTop: 2
                                    }}
                                >
                                    {isConsumed ? 'Expired' : canView ? 'Tap to view' : 'Secure message'}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                    <View style={[styles.messageFooter, isOwnMessage ? styles.ownMessageFooter : styles.otherMessageFooter]}>
                        <Text style={[styles.messageTimeText, { color: colors.textSecondary }]}>
                            {format(new Date(item.timestamp), 'h:mm a')}
                        </Text>
                        {isOwnMessage && (
                            <Icon
                                name={item.is_read ? "checkmark-done" : "checkmark-done-outline"}
                                size={14}
                                color={item.is_read ? '#10B981' : colors.textSecondary}
                                style={styles.readReceipt}
                            />
                        )}
                    </View>
                </View>
            );
        }

        return (
            <View
                style={[
                    styles.messageWrapper,
                    isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper,
                ]}
            >
                {!isOwnMessage && (
                    <TouchableOpacity
                        onPress={() => {
                            if (item.sender?.username) {
                                (navigation as any).navigate('Profile', { username: item.sender.username });
                            }
                        }}
                    >
                        <Text style={[styles.senderName, { color: colors.primary }]}>{senderName}</Text>
                    </TouchableOpacity>
                )}
                <View
                    style={[
                        styles.messageBubble,
                        isOwnMessage ? styles.ownBubble : styles.otherBubble,
                        {
                            backgroundColor: isOwnMessage ? colors.primary : '#FFFFFF',
                            borderColor: isOwnMessage ? colors.primary : colors.border,
                            borderWidth: isOwnMessage ? 0 : 1,
                            paddingHorizontal: (isImage || isVideo) ? 0 : 16,
                            paddingVertical: (isImage || isVideo) ? 0 : 12,
                            overflow: 'hidden',
                        },
                    ]}
                >
                    {item.media_url && (
                        isVideo ? (
                            <MessageVideo uri={item.media_url} />
                        ) : !isImage ? (
                            <TouchableOpacity activeOpacity={0.8}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', padding: 12, borderRadius: 8, marginBottom: showText ? 8 : 0, maxWidth: 220 }}>
                                    <Icon name="document-text-outline" size={24} color={isOwnMessage ? '#FFFFFF' : colors.primary} style={{ marginRight: 8 }} />
                                    <Text style={{ color: isOwnMessage ? '#FFFFFF' : '#000000', fontSize: 13, flexShrink: 1 }} numberOfLines={2}>
                                        {item.media_filename || 'Attached File'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <MessageImage uri={item.media_url} showText={showText} isImage={isImage} />
                        )
                    )}
                    {showText && (
                        <View style={(isImage || isVideo) ? { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 } : null}>
                            <Text
                                style={[
                                    styles.messageText,
                                    { color: isOwnMessage ? '#FFFFFF' : '#000000' },
                                ]}
                            >
                                {item.content}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={[styles.messageFooter, isOwnMessage ? styles.ownMessageFooter : styles.otherMessageFooter]}>
                    <Text
                        style={[
                            styles.messageTimeText,
                            { color: colors.textSecondary },
                        ]}
                    >
                        {(() => {
                            try {
                                const date = new Date(item.timestamp);
                                if (isNaN(date.getTime())) {
                                    return item.timestamp?.toString().substring(0, 5) || '--:--';
                                }
                                return format(date, 'h:mm a');
                            } catch (e) {
                                return '--:--';
                            }
                        })()}
                    </Text>
                    {isOwnMessage && (
                        <Icon
                            name={item.is_read ? "checkmark-done" : "checkmark-done-outline"}
                            size={14}
                            color={item.is_read ? '#10B981' : colors.textSecondary}
                            style={styles.readReceipt}
                        />
                    )}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* ── Incoming P2P Transfer Banner ─────────────── */}
            {incomingOffer && (
                <View style={{
                    backgroundColor: '#1e3a5f', padding: 14, flexDirection: 'row',
                    alignItems: 'center', justifyContent: 'space-between',
                    borderBottomWidth: 1, borderBottomColor: '#3b82f6'
                }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>📥 Incoming file</Text>
                        <Text style={{ color: '#93c5fd', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            {incomingOffer.fileName} ({Math.round(incomingOffer.fileSize / 1024)} KB)
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleDeclineP2P}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 }}
                    >
                        <Text style={{ color: '#f87171', fontWeight: '600' }}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleAcceptP2P}
                        style={{ backgroundColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}
                    >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Accept</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Active P2P Transfer Progress Bar ─────────── */}
            {p2pStatus !== 'idle' && (
                <View style={{
                    backgroundColor: p2pStatus === 'completed' ? '#052e16' : '#0f172a',
                    padding: 12, borderBottomWidth: 1,
                    borderBottomColor: p2pStatus === 'completed' ? '#16a34a' : '#3b82f6',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Icon
                            name={p2pStatus === 'completed' ? 'checkmark-circle' : p2pStatus === 'failed' ? 'close-circle' : 'cloud-upload-outline'}
                            size={16}
                            color={p2pStatus === 'completed' ? '#4ade80' : p2pStatus === 'failed' ? '#f87171' : '#60a5fa'}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={{ color: '#e2e8f0', fontSize: 12, flex: 1 }} numberOfLines={1}>
                            {p2pStatus === 'completed' ? '✅ Transfer complete' :
                                p2pStatus === 'failed' ? '❌ Transfer failed' :
                                    p2pStatus === 'connecting' ? `Connecting… ${p2pFileName} ` :
                                        `${p2pFileName} — ${p2pProgress}% `}
                        </Text>
                        {(p2pStatus === 'completed' || p2pStatus === 'failed') && (
                            <TouchableOpacity onPress={() => setP2pStatus('idle')}>
                                <Icon name="close" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={{ height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{
                            height: '100%', borderRadius: 2,
                            width: `${p2pProgress}%`,
                            backgroundColor: p2pStatus === 'completed' ? '#4ade80' : '#3b82f6'
                        }} />
                    </View>
                </View>
            )}
            <FlatList
                ref={flatListRef}
                data={[...chatMessages].reverse()}
                keyExtractor={(item, index) => `${item?.id || 'msg'} -${index} `}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={styles.messageList}
                onTouchStart={() => isAttachMenuVisible && setIsAttachMenuVisible(false)}
            />

            {/* Typing indicator */}
            {otherTyping && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                    <Text style={{ color: colors.primary, fontSize: 14 }}>Typing...</Text>
                </View>
            )}

            <View style={[styles.inputContainerWrapper, { backgroundColor: colors.surface }]}>
                {isAttachMenuVisible && (
                    <View style={[styles.attachMenuContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity style={styles.attachMenuItem} onPress={handleSendFile}>
                            <View style={[styles.attachMenuItemIcon, { backgroundColor: colors.surface === '#FFFFFF' ? '#E8F0FE' : '#1e3a8a' }]}>
                                <Icon name="document-outline" size={24} color="#3B82F6" />
                            </View>
                            <View>
                                <Text style={[styles.attachMenuTitle, { color: colors.text }]}>Send File</Text>
                                <Text style={[styles.attachMenuSubtitle, { color: colors.textSecondary }]}>Normal upload</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.attachMenuDivider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity style={styles.attachMenuItem} onPress={handleSendP2P}>
                            <View style={[styles.attachMenuItemIcon, { backgroundColor: colors.surface === '#FFFFFF' ? '#F3E8FF' : '#4c1d95' }]}>
                                <Icon name="wifi-outline" size={24} color="#a855f7" />
                            </View>
                            <View>
                                <Text style={[styles.attachMenuTitle, { color: colors.text }]}>P2P Transfer</Text>
                                <Text style={[styles.attachMenuSubtitle, { color: colors.textSecondary }]}>No size limit · Direct</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.attachMenuDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity
                            style={[styles.attachMenuItem, isOneTimeMode && { backgroundColor: isOneTimeMode ? 'rgba(0,122,255,0.08)' : 'transparent' }]}
                            onPress={() => {
                                setIsOneTimeMode(!isOneTimeMode);
                                setIsAttachMenuVisible(false);
                            }}
                        >
                            <View style={[styles.attachMenuItemIcon, {
                                backgroundColor: isOneTimeMode ? '#007AFF' : (colors.surface === '#FFFFFF' ? '#F1F5F9' : '#334155')
                            }]}>
                                <Icon name="eye-outline" size={24} color={isOneTimeMode ? '#FFFFFF' : "#94a3b8"} />
                            </View>
                            <View>
                                <Text style={[styles.attachMenuTitle, { color: colors.text, fontWeight: isOneTimeMode ? '600' : '400' }]}>
                                    One-time View {isOneTimeMode ? '(ON)' : ''}
                                </Text>
                                <Text style={[styles.attachMenuSubtitle, { color: colors.textSecondary }]}>Disappears after viewed</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.attachButton, isAttachMenuVisible && { backgroundColor: colors.background }]}
                        onPress={() => setIsAttachMenuVisible(!isAttachMenuVisible)}
                    >
                        <Icon name="attach-outline" size={26} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <TextInput
                            style={[
                                styles.input,
                                { color: colors.text },
                            ]}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.textSecondary}
                            value={inputText}
                            onChangeText={handleTyping}
                            multiline
                            maxLength={1000}
                        />
                        <TouchableOpacity style={styles.smileyButton}>
                            <Icon name="happy-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            { backgroundColor: inputText.trim() ? colors.primary : '#A1C4FD' }
                        ]}
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Icon
                            name="paper-plane"
                            size={18}
                            color="#FFFFFF"
                            style={{ marginLeft: -2 }}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* One-time View Modal */}
            <Modal
                visible={oneTimeModalVisible}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setOneTimeModalVisible(false)}
            >
                <View style={styles.otvModalContainer}>
                    <TouchableOpacity
                        style={styles.otvCloseButton}
                        onPress={() => setOneTimeModalVisible(false)}
                    >
                        <Icon name="close" size={30} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.otvContentWrapper}>
                        {revealedContent?.type === 'text' && (
                            <View style={styles.otvTextContainer}>
                                <Text style={styles.otvRevealedText}>{revealedContent.content}</Text>
                            </View>
                        )}

                        {revealedContent?.type === 'image' && revealedContent.mediaUrl && (
                            <Image
                                source={{ uri: revealedContent.mediaUrl }}
                                style={styles.otvRevealedImage}
                                resizeMode="contain"
                            />
                        )}

                        {revealedContent?.type === 'video' && revealedContent.mediaUrl && (
                            <Video
                                source={{ uri: revealedContent.mediaUrl }}
                                style={styles.otvRevealedVideo}
                                resizeMode="contain"
                                controls
                            />
                        )}

                        {revealedContent?.type === 'document' && revealedContent.mediaUrl && (
                            <View style={styles.otvDocContainer}>
                                <Icon name="document-text" size={80} color="#FFFFFF" />
                                <Text style={styles.otvDocText}>{revealedContent.content || 'Document'}</Text>
                                <TouchableOpacity
                                    style={styles.otvDownloadButton}
                                    onPress={() => Alert.alert('Privacy Policy', 'One-time documents cannot be downloaded or saved.')}
                                >
                                    <Text style={styles.otvDownloadText}>Secure Preview Only</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={styles.otvWarningFooter}>
                        <Icon name="alert-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.otvWarningText}>
                            This message will self-destruct once you close this view.
                        </Text>
                    </View>
                </View>
            </Modal>

            {/* Loading Overlay for consumption */}
            {isConsuming && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingCard}>
                        <Icon name="lock-closed" size={30} color="#007AFF" />
                        <Text style={styles.loadingText}>Unlocking message...</Text>
                    </View>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    messageList: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    messageWrapper: {
        marginVertical: 6,
        maxWidth: '85%',
    },
    ownMessageWrapper: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    otherMessageWrapper: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    senderName: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        marginLeft: 4,
    },
    messageBubble: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    ownBubble: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 20,
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginBottom: 8,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ownMessageFooter: {
        justifyContent: 'flex-end',
        paddingRight: 4,
    },
    otherMessageFooter: {
        justifyContent: 'flex-start',
        paddingLeft: 4,
    },
    messageTimeText: {
        fontSize: 11,
    },
    readReceipt: {
        marginLeft: 4,
    },
    inputContainerWrapper: {
        position: 'relative',
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        borderTopWidth: 1,
    },
    attachMenuContainer: {
        position: 'absolute',
        bottom: '100%',
        left: 12,
        marginBottom: 8,
        borderRadius: 16,
        padding: 8,
        width: 280,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    attachMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    attachMenuItemIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    attachMenuTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    attachMenuSubtitle: {
        fontSize: 12,
    },
    attachMenuDivider: {
        height: 1,
        marginLeft: 68,
        marginRight: 8,
    },
    attachButton: {
        padding: 8,
        marginRight: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 4,
        width: 40,
        height: 40,
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 10,
        minHeight: 40,
    },
    input: {
        flex: 1,
        maxHeight: 120,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
    },
    smileyButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    otvIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    otvModalContainer: {
        flex: 1,
        backgroundColor: '#000000',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    otvCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    otvContentWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    otvTextContainer: {
        width: '100%',
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
    },
    otvRevealedText: {
        color: '#FFFFFF',
        fontSize: 18,
        lineHeight: 28,
        textAlign: 'center',
    },
    otvRevealedImage: {
        width: '100%',
        height: '80%',
    },
    otvRevealedVideo: {
        width: '100%',
        height: '80%',
    },
    otvDocContainer: {
        alignItems: 'center',
        padding: 40,
    },
    otvDocText: {
        color: '#FFFFFF',
        fontSize: 18,
        marginTop: 20,
        textAlign: 'center',
    },
    otvDownloadButton: {
        marginTop: 30,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    otvDownloadText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '600',
    },
    otvWarningFooter: {
        padding: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    otvWarningText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        marginLeft: 8,
        textAlign: 'center',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingCard: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        width: 200,
    },
    loadingText: {
        marginTop: 12,
        color: '#1C1C1E',
        fontSize: 15,
        fontWeight: '600',
    },
});
