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
    Dimensions,
    TouchableWithoutFeedback,
    Clipboard,
} from 'react-native';
import Video from 'react-native-video';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import DocumentPicker from 'react-native-document-picker';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import { API_CONFIG } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import websocketService from '@/services/websocket';
import api from '@/services/api';
import { P2PFileTransferService, type P2PStatus } from '@/services/p2pFileTransfer';
import type { Message } from '@/types';
import ChatSharedCard from '@/components/ChatSharedCard';
import MessageActionsSheet from '@/components/MessageActionsSheet';

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
                width: 240,
                height: undefined,
                aspectRatio: Math.max(0.4, Math.min(aspectRatio, 2.5)),
                resizeMode: 'cover', // Parent handles overflow and borderRadius
            }}
        />
    );
};

const MessageVideo = ({ uri, onLongPress }: { uri: string; onLongPress?: (e: any) => void }) => {
    const [aspectRatio, setAspectRatio] = useState<number>(1.5);
    const [paused, setPaused] = useState(true);

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setPaused(!paused)}
            onLongPress={onLongPress}
            style={{
                width: 240,
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
    const { messages, loadMessages, addMessage, removeMessage, sendMessage, chats, updateMessage, markChatAsRead, consumeMessage, manageChatAcceptance, loadChats } = useChatStore();
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
    const [selectedMessageAction, setSelectedMessageAction] = useState<Message | null>(null);
    const [isMessageActionsVisible, setIsMessageActionsVisible] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, isOwn: false });
    const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
    const [isForwardModalVisible, setIsForwardModalVisible] = useState(false);
    const [messageToForward, setMessageToForward] = useState<Message | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    const currentChat = chats.find(c => c.id === chatId);

    // ── P2P Transfer state ───────────────────────────────────────────────
    const [p2pStatus, setP2pStatus] = useState<P2PStatus>('idle');
    const [p2pProgress, setP2pProgress] = useState(0);
    const [p2pFileName, setP2pFileName] = useState('');
    const [incomingOffer, setIncomingOffer] = useState<{ signal: any; fileName: string; fileSize: number } | null>(null);
    const p2pRef = useRef<P2PFileTransferService | null>(null);

    useEffect(() => {
        if (isForwardModalVisible) {
            loadChats();
        }
    }, [isForwardModalVisible]);

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
                            style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }}
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
        const unsubscribe = websocketService.connectToChat(chatId, (data: any) => {
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
            } else if (data && data.type === 'message.delete') {
                console.log('🗑️ Message deleted update:', data);
                removeMessage(chatId, data.message_id);
            } else if (data && data.id) {
                // Fallback for old message format
                addMessage(chatId, data);
                if (data.sender?.id !== user?.id) {
                    setTimeout(() => markChatAsRead(chatId), 1000);
                }
            }
        });

        // Connect to read receipt updates
        const unsubscribeReadReceipt = websocketService.onReadReceipt(chatId, (data) => {
            console.log('📬 Read receipt received:', data);
            // Update message read status in the UI
            updateMessage(chatId, data.message_id, { is_read: true });
        });

        // Connect to OTV consumption updates
        const unsubscribeConsumed = websocketService.onMessageConsumed(chatId, (data) => {
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
            websocketService.sendP2PSignal(chatId, signal, targetUser.id);
        } else {
            console.warn('⚠️ [P2P] Cannot send signal: No target user found');
        }
    }, [chatId, currentChat, user]);

    // Listen for incoming P2P signals via WebSocket
    useEffect(() => {
        const unsubscribeP2P = websocketService.onP2PSignal(chatId, (data) => {
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
        const currentReplyId = replyToMessage?.id;

        setInputText('');
        setReplyToMessage(null);
        setIsTyping(false);
        websocketService.sendTypingStatus(chatId, false);

        try {
            await sendMessage(chatId, messageText, undefined, undefined, isOneTimeMode, currentReplyId);
            setIsOneTimeMode(false); // Reset OTV mode after sending
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error: any) {
            console.error('Error sending message:', error);
            setInputText(messageText); // Restore text so user doesn't lose it
            if (currentReplyId) {
                const chatMessages = messages.get(chatId) || [];
                const originalMsg = chatMessages.find(m => m.id === currentReplyId);
                if (originalMsg) setReplyToMessage(originalMsg);
            }
            Alert.alert('Message Failed', error.message || 'Failed to send message');
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
                websocketService.sendTypingStatus(chatId, false);

                await sendMessage(chatId, content, pickedFile.uri, {
                    name: pickedFile.name || 'document',
                    type: pickedFile.type || 'application/octet-stream'
                }, isOneTimeMode, replyToMessage?.id);
                setReplyToMessage(null);
                setIsOneTimeMode(false); // Reset OTV mode
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }
        } catch (err: any) {
            if (DocumentPicker.isCancel(err)) {
                // User cancelled the picker
            } else {
                console.error('Error sending file:', err);
                setInputText(inputText.trim()); // Restore text
                Alert.alert('Upload Failed', err.message || 'Failed to send file');
            }
        }
    };

    const handleTyping = (text: string) => {
        setInputText(text);
        if (isAttachMenuVisible) setIsAttachMenuVisible(false);

        if (text.length > 0 && !isTyping) {
            setIsTyping(true);
            websocketService.sendTypingStatus(chatId, true);
        } else if (text.length === 0 && isTyping) {
            setIsTyping(false);
            websocketService.sendTypingStatus(chatId, false);
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

    const handleMessageLongPress = (message: Message, event: any) => {
        const { pageX, pageY } = event.nativeEvent;
        const screenWidth = Dimensions.get('window').width;
        const screenHeight = Dimensions.get('window').height;
        const isOwn = message.sender?.id === user?.id;

        // Simple heuristic for menu placement
        let x = isOwn ? screenWidth - 220 : 40;
        let y = pageY > screenHeight - 300 ? pageY - 250 : pageY + 10;

        setMenuPosition({ x, y, isOwn });
        setSelectedMessageAction(message);
        setIsMessageActionsVisible(true);
    };

    const handleReply = (message: Message) => {
        setReplyToMessage(message);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    };

    const handleForward = (message: Message) => {
        setMessageToForward(message);
        setIsForwardModalVisible(true);
    };

    const handleForwardToChat = async (targetChatId: number) => {
        if (!messageToForward) return;

        try {
            const { sendMessage } = useChatStore.getState();
            await sendMessage(targetChatId, `[Forwarded]: ${messageToForward.content}`);
            setIsForwardModalVisible(false);
            Alert.alert('Success', 'Message forwarded successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to forward message');
        }
    };

    const handleStar = async (message: Message, emoji?: string) => {
        try {
            const res = await api.performMessageAction(message.id, emoji ? 'reaction' : 'star', emoji ? { emoji } : {});
            if (!res.success) {
                console.error('Action failed:', res.error);
            }
        } catch (error) {
            console.error('Error performing action:', error);
        }
    };

    const handleDeleteForMe = async (message: Message) => {
        // 1. Instantly remove from local UI for maximum responsiveness
        const { removeMessage } = useChatStore.getState();
        removeMessage(chatId, message.id);

        // 2. Send via WebSocket to bypass CSRF and notify others immediately
        websocketService.deleteMessage(chatId, message.id, 'me');

        // 3. Fallback to HTTP for persistent DB record (try-catch to ignore 403 if WS worked)
        try {
            await api.deleteMessageForMe(chatId, message.id);
        } catch (e) {
            console.log('HTTP delete fallback failed, relying on WebSocket:', e);
        }
    };

    const handleDeleteForEveryone = async (message: Message) => {
        // 1. Instantly remove from local UI
        const { removeMessage } = useChatStore.getState();
        removeMessage(chatId, message.id);

        // 2. Send via WebSocket (Bypasses CSRF and is real-time)
        websocketService.deleteMessage(chatId, message.id, 'everyone');

        // 3. Fallback to HTTP for server-side authority
        try {
            const res = await api.deleteMessageForEveryone(chatId, message.id);
            if (!res.success && (res as any).status !== 'ok') {
                // If both fail, we might need to re-add it, but usually WS is enough
                console.log('HTTP delete for everyone failed');
            } else {
                loadMessages(chatId);
            }
        } catch (e) {
            console.log('HTTP delete for everyone error:', e);
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

        const parseShareLink = (text: string) => {
            if (!text) return null;

            // Handle Omzo links: https://odnix.com/omzo/ID/
            const omzoMatch = text.match(/odnix\.com\/omzo\/([^\/\s]+)/) || text.match(/\/omzo\/([^\/\s]+)/);
            if (omzoMatch) {
                const id = omzoMatch[1].replace(/\//g, '');
                if (!isNaN(parseInt(id))) return { type: 'omzo' as const, id: parseInt(id) };
            }

            // Handle Legacy Omzo file paths: /media/omzos/Video-ID...
            const legacyOmzoMatch = text.match(/\/media\/omzos\/Video-(\d+)/) || text.match(/Video-(\d+)/);
            if (legacyOmzoMatch) return { type: 'omzo' as const, id: parseInt(legacyOmzoMatch[1]) };

            // Handle Scribe links: https://odnix.com/scribe/ID/
            const scribeMatch = text.match(/odnix\.com\/scribe\/([^\/\s]+)/) || text.match(/\/scribe\/([^\/\s]+)/);
            if (scribeMatch) {
                const id = scribeMatch[1].replace(/\//g, '');
                if (!isNaN(parseInt(id))) return { type: 'scribe' as const, id: parseInt(id) };
            }

            return null;
        };

        const sharedLinkData = parseShareLink(item.content);
        const storyReplyData = item.story_reply;

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
                        onLongPress={(e) => handleMessageLongPress(item, e)}
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
                <View style={{ flexDirection: isOwnMessage ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onLongPress={(e) => handleMessageLongPress(item, e)}
                        style={{ maxWidth: '85%' }}
                    >
                        <View
                            style={[
                                styles.messageBubble,
                                isOwnMessage ? styles.ownBubble : styles.otherBubble,
                                {
                                    backgroundColor: isOwnMessage ? colors.primary : '#FFFFFF',
                                    borderColor: isOwnMessage ? colors.primary : colors.border,
                                    borderWidth: isOwnMessage ? 0 : 1,
                                    paddingVertical: (item.shared_scribe || item.shared_omzo || sharedLinkData) ? 0 : (isImage || isVideo) ? 0 : 12,
                                    paddingHorizontal: (item.shared_scribe || item.shared_omzo || sharedLinkData || isImage || isVideo) ? 0 : 16,
                                    overflow: 'hidden',
                                },
                            ]}
                        >
                            {storyReplyData && (
                                <View style={[styles.bubbleReplyContainer, { borderLeftColor: isOwnMessage ? '#FFFFFF' : colors.primary, backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', flexDirection: 'row', alignItems: 'center' }]}>
                                    {storyReplyData.story_media_url ? (
                                        <Image source={{ uri: storyReplyData.story_media_url.startsWith('http') ? storyReplyData.story_media_url : `${API_CONFIG.BASE_URL}${storyReplyData.story_media_url}` }} style={{ width: 40, height: 60, borderRadius: 4, marginRight: 8 }} />
                                    ) : (
                                        <View style={{ width: 40, height: 60, backgroundColor: '#333', borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center' }}>
                                            {storyReplyData.story_type === 'text' ? (
                                                <Text style={{ color: '#FFF', fontSize: 10, textAlign: 'center', padding: 2 }} numberOfLines={3}>{storyReplyData.story_content}</Text>
                                            ) : (
                                                <Icon name="bookmark-outline" size={20} color="#CCC" />
                                            )}
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.bubbleReplySender, { color: isOwnMessage ? '#FFFFFF' : colors.primary }]} numberOfLines={1}>
                                            {item.content === '❤️' ? 'Liked ' : 'Replied to '}{storyReplyData.story_owner || 'story'}
                                        </Text>
                                        <Text style={[styles.bubbleReplyText, { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]} numberOfLines={1}>
                                            {storyReplyData.story_content || 'View Story'}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            {item.reply_to && (
                                <View style={[styles.bubbleReplyContainer, { borderLeftColor: isOwnMessage ? '#FFFFFF' : colors.primary, backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                    <Text style={[styles.bubbleReplySender, { color: isOwnMessage ? '#FFFFFF' : colors.primary }]} numberOfLines={1}>
                                        {item.reply_to.sender?.full_name || item.reply_to.sender?.username || 'Unknown'}
                                    </Text>
                                    <Text style={[styles.bubbleReplyText, { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]} numberOfLines={1}>
                                        {item.reply_to.content}
                                    </Text>
                                </View>
                            )}
                            {item.media_url && (
                                isVideo ? (
                                    <MessageVideo uri={item.media_url} onLongPress={(e) => handleMessageLongPress(item, e)} />
                                ) : !isImage ? (
                                    <TouchableOpacity activeOpacity={0.8} onLongPress={(e) => handleMessageLongPress(item, e)}>
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
                            {(item.shared_scribe || item.shared_omzo || sharedLinkData) && (
                                <ChatSharedCard
                                    scribe={item.shared_scribe}
                                    omzo={item.shared_omzo}
                                    shareId={sharedLinkData?.id}
                                    shareType={sharedLinkData?.type}
                                    isOwnMessage={isOwnMessage}
                                    onLongPress={(e) => handleMessageLongPress(item, e)}
                                />
                            )}
                            {showText && !sharedLinkData && (
                                <View style={(isImage || isVideo || item.shared_scribe || item.shared_omzo || sharedLinkData) ? { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 } : null}>
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
                    </TouchableOpacity>
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

            <Modal
                visible={isMessageActionsVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsMessageActionsVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setIsMessageActionsVisible(false)}>
                    <View style={styles.menuOverlay}>
                        <View
                            style={[
                                styles.whatsappMenu,
                                {
                                    top: menuPosition.y,
                                    left: menuPosition.x,
                                    backgroundColor: colors.surface,
                                }
                            ]}
                        >
                            <View style={styles.reactionRow}>
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                                    <TouchableOpacity
                                        key={emoji}
                                        onPress={() => {
                                            if (selectedMessageAction) handleStar(selectedMessageAction, emoji);
                                            setIsMessageActionsVisible(false);
                                        }}
                                        style={styles.reactionButton}
                                    >
                                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    if (selectedMessageAction) handleReply(selectedMessageAction);
                                    setIsMessageActionsVisible(false);
                                }}
                            >
                                <Text style={[styles.menuItemText, { color: colors.text }]}>Reply</Text>
                                <Icon name="arrow-undo-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    if (selectedMessageAction) {
                                        const text = selectedMessageAction.content || '';
                                        if (text) {
                                            Clipboard.setString(text);
                                        }
                                    }
                                    setIsMessageActionsVisible(false);
                                }}
                            >
                                <Text style={[styles.menuItemText, { color: colors.text }]}>Copy</Text>
                                <Icon name="copy-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    if (selectedMessageAction) handleForward(selectedMessageAction);
                                    setIsMessageActionsVisible(false);
                                }}
                            >
                                <Text style={[styles.menuItemText, { color: colors.text }]}>Forward</Text>
                                <Icon name="arrow-redo-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    if (selectedMessageAction) handleStar(selectedMessageAction);
                                    setIsMessageActionsVisible(false);
                                }}
                            >
                                <Text style={[styles.menuItemText, { color: colors.text }]}>Star</Text>
                                <Icon name="star-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    if (selectedMessageAction) handleDeleteForMe(selectedMessageAction);
                                    setIsMessageActionsVisible(false);
                                }}
                            >
                                <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete for me</Text>
                                <Icon name="trash-outline" size={20} color="#FF3B30" />
                            </TouchableOpacity>

                            {selectedMessageAction && user?.id && selectedMessageAction.sender?.id === user.id && (
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        handleDeleteForEveryone(selectedMessageAction);
                                        setIsMessageActionsVisible(false);
                                    }}
                                >
                                    <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete for everyone</Text>
                                    <Icon name="trash-bin-outline" size={20} color="#FF3B30" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Simple Forward Modal */}
            <Modal
                visible={isForwardModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsForwardModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setIsForwardModalVisible(false)}>
                    <View style={styles.forwardOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.forwardSheet, { backgroundColor: colors.surface }]}>
                                <Text style={[styles.forwardTitle, { color: colors.text }]}>Forward to...</Text>
                                <FlatList
                                    data={chats}
                                    keyExtractor={(item) => item.id.toString()}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.forwardItem}
                                            onPress={() => handleForwardToChat(item.id)}
                                        >
                                            <Image
                                                source={{ uri: item.participants?.[0]?.profile_picture_url || 'https://via.placeholder.com/40' }}
                                                style={styles.forwardAvatar}
                                            />
                                            <Text style={[styles.forwardName, { color: colors.text }]}>
                                                {item.name || item.participants?.[0]?.full_name || 'Group Chat'}
                                            </Text>
                                            <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                    style={{ maxHeight: 400 }}
                                />
                                <TouchableOpacity
                                    style={[styles.forwardCancel, { borderTopColor: colors.border }]}
                                    onPress={() => setIsForwardModalVisible(false)}
                                >
                                    <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

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

                {currentChat?.is_message_request && (
                    <View style={[styles.acceptanceContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                        <Text style={[styles.acceptanceTitle, { color: colors.text }]}>Message Request</Text>
                        <Text style={[styles.acceptanceSubtitle, { color: colors.textSecondary }]}>
                            Do you want to let {currentChat?.name || 'this user'} message you? They won't know you've seen their message until you accept.
                        </Text>
                        <View style={styles.acceptanceButtons}>
                            <TouchableOpacity
                                style={[styles.acceptanceButton, { backgroundColor: colors.border }]}
                                onPress={() => manageChatAcceptance(chatId, 'block')}
                            >
                                <Text style={[styles.acceptanceButtonText, { color: '#EF4444' }]}>Block</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.acceptanceButton, { backgroundColor: colors.primary }]}
                                onPress={() => manageChatAcceptance(chatId, 'accept')}
                            >
                                <Text style={[styles.acceptanceButtonText, { color: '#FFFFFF' }]}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!currentChat?.is_message_request && (currentChat?.is_other_blocked || currentChat?.am_i_blocked) && (
                    <View style={[styles.blockedContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                        <Text style={[styles.blockedText, { color: colors.textSecondary }]}>
                            {currentChat?.is_other_blocked ? "You have blocked this user" : "You cannot message this user"}
                        </Text>
                        {currentChat?.is_other_blocked && (
                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        const otherUser = currentChat.participants.find(p => p.id !== user?.id);
                                        if (otherUser) {
                                            await api.toggleBlock(otherUser.id);
                                            await loadMessages(chatId); // Refresh flags
                                        }
                                    } catch (error) {
                                        console.error('Error unblocking:', error);
                                    }
                                }}
                            >
                                <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 12 }}>Unblock</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {!currentChat?.is_message_request && !currentChat?.is_other_blocked && !currentChat?.am_i_blocked && (
                    <>
                        {isOneTimeMode && (
                            <View style={[styles.oneTimeBanner, { backgroundColor: colors.primary + '10', borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                                <View style={styles.oneTimeBannerLeft}>
                                    <Icon name="eye-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                                    <View>
                                        <Text style={[styles.oneTimeBannerText, { color: colors.primary }]}>One-time view mode</Text>
                                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>Disappears after it's opened once</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setIsOneTimeMode(false)}
                                    style={styles.oneTimeCancelBtn}
                                >
                                    <Text style={[styles.oneTimeCancelText, { color: colors.primary }]}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={[styles.inputContainerWrapper, { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: isOneTimeMode ? 0 : 1 }]}>
                            {replyToMessage && (
                                <View style={[styles.replyContainer, { backgroundColor: colors.background, borderLeftColor: colors.primary }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.replySenderName, { color: colors.primary }]}>
                                            {replyToMessage.sender?.full_name || replyToMessage.sender?.username || 'Unknown'}
                                        </Text>
                                        <Text style={[styles.replyMessageText, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {replyToMessage.content || (replyToMessage.media_url ? 'Attachment' : '')}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setReplyToMessage(null)}
                                        style={{ padding: 4 }}
                                    >
                                        <Icon name="close-circle" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View style={styles.inputContainer}>
                                <TouchableOpacity
                                    style={[styles.attachButton, isAttachMenuVisible && { backgroundColor: colors.background }]}
                                    onPress={() => setIsAttachMenuVisible(!isAttachMenuVisible)}
                                >
                                    <Icon name="attach-outline" size={26} color={colors.textSecondary} />
                                </TouchableOpacity>

                                <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <TextInput
                                        ref={inputRef}
                                        style={[
                                            styles.input,
                                            { color: colors.text },
                                        ]}
                                        placeholder={isOneTimeMode ? "One-time message..." : "Type a message..."}
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
                    </>
                )}
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
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    acceptanceContainer: {
        padding: 24,
        alignItems: 'center',
        borderTopWidth: 1,
    },
    acceptanceTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    acceptanceSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    acceptanceButtons: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    acceptanceButton: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    acceptanceButtonText: {
        fontSize: 16,
        fontWeight: '600',
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
    blockedContainer: {
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: 1,
        flexDirection: 'row',
    },
    blockedText: {
        fontSize: 14,
        textAlign: 'center',
    },
    oneTimeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    oneTimeBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    oneTimeBannerText: {
        fontSize: 14,
        fontWeight: '700',
    },
    oneTimeCancelBtn: {
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    oneTimeCancelText: {
        fontSize: 14,
        fontWeight: '600',
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    whatsappMenu: {
        position: 'absolute',
        width: 200,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
        paddingVertical: 4,
    },
    reactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    reactionButton: {
        padding: 4,
    },
    menuDivider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    menuItemText: {
        fontSize: 16,
    },
    // Reply styles
    replyContainer: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginHorizontal: 12,
        marginTop: 10,
        borderRadius: 12,
        borderLeftWidth: 4,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    replySenderName: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    replyMessageText: {
        fontSize: 13,
    },
    bubbleReplyContainer: {
        padding: 8,
        margin: 4,
        borderRadius: 4,
        borderLeftWidth: 3,
        maxWidth: '100%',
    },
    bubbleReplySender: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 2,
    },
    bubbleReplyText: {
        fontSize: 12,
    },
    // Forward styles
    forwardOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    forwardSheet: {
        width: '85%',
        borderRadius: 20,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    forwardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    forwardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    forwardAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    forwardName: {
        flex: 1,
        fontSize: 16,
    },
    forwardCancel: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        alignItems: 'center',
    },
});
