import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import websocket from '@/services/websocket';
import type { Message } from '@/types';

export default function ChatScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user } = useAuthStore();
    const { messages, loadMessages, addMessage, sendMessage, chats, updateMessage, markChatAsRead } = useChatStore();
    const { chatId } = route.params as { chatId: number };
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const currentChat = chats.find(c => c.id === chatId);

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
            navigation.navigate('VoiceCall' as never, { user: targetUser } as never);
        }
    };

    const handleVideoCall = () => {
        const targetUser = currentChat?.chat_type === 'private'
            ? currentChat.participants.find(p => p.id !== user?.id)
            : currentChat?.participants[0];

        if (targetUser) {
            navigation.navigate('VideoCall' as never, { user: targetUser } as never);
        }
    };

    useLayoutEffect(() => {
        const title = currentChat?.name || (currentChat?.participants?.[0]?.full_name || currentChat?.participants?.[0]?.username) || 'Chat';
        const avatarUrl = currentChat?.chat_type === 'group'
            ? currentChat?.group_avatar
            : currentChat?.participants?.[0]?.profile_picture_url;

        navigation.setOptions({
            headerTitle: '',
            headerLeft: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
                        <Icon name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
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

        // Connect to WebSocket for new messages
        const unsubscribe = websocket.connectToChat(chatId, (message: Message) => {
            addMessage(chatId, message);
            // Auto-mark new messages as read if chat is open
            if (message.sender?.id !== user?.id) {
                setTimeout(() => markChatAsRead(chatId), 1000);
            }
        });

        // Connect to read receipt updates
        const unsubscribeReadReceipt = websocket.onReadReceipt(chatId, (data) => {
            console.log('📬 Read receipt received:', data);
            // Update message read status in the UI
            updateMessage(chatId, data.message_id, { is_read: true });
        });

        return () => {
            unsubscribe();
            unsubscribeReadReceipt();
            websocket.disconnectFromChat(chatId);
        };
    }, [chatId]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const messageText = inputText.trim();
        setInputText('');

        try {
            await sendMessage(chatId, messageText);
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
            console.error('Error sending message:', error);
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

    const chatMessages = messages.get(chatId) || [];

    const renderMessage = ({ item }: { item: Message }) => {
        const isOwnMessage = item.sender?.id === user?.id;
        const senderName = item.sender?.full_name || item.sender?.username || 'Unknown';

        return (
            <View
                style={[
                    styles.messageWrapper,
                    isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper,
                ]}
            >
                {!isOwnMessage && (
                    <Text style={[styles.senderName, { color: colors.primary }]}>{senderName}</Text>
                )}
                <View
                    style={[
                        styles.messageBubble,
                        isOwnMessage ? styles.ownBubble : styles.otherBubble,
                        {
                            backgroundColor: isOwnMessage ? colors.primary : '#FFFFFF',
                            borderColor: isOwnMessage ? colors.primary : colors.border,
                            borderWidth: isOwnMessage ? 0 : 1,
                        },
                    ]}
                >
                    {item.media_url && (
                        <Image
                            source={{ uri: item.media_url }}
                            style={styles.messageImage}
                            resizeMode="cover"
                        />
                    )}
                    <Text
                        style={[
                            styles.messageText,
                            { color: isOwnMessage ? '#FFFFFF' : '#000000' },
                        ]}
                    >
                        {item.content || '(no content)'}
                    </Text>
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
            <FlatList
                ref={flatListRef}
                data={[...chatMessages].reverse()}
                keyExtractor={(item, index) => `${item?.id || 'msg'}-${index}`}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={styles.messageList}
                onTouchStart={() => isAttachMenuVisible && setIsAttachMenuVisible(false)}
            />

            <View style={[styles.inputContainerWrapper, { backgroundColor: colors.surface }]}>
                {isAttachMenuVisible && (
                    <View style={[styles.attachMenuContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity style={styles.attachMenuItem}>
                            <View style={[styles.attachMenuItemIcon, { backgroundColor: colors.surface === '#FFFFFF' ? '#E8F0FE' : '#1e3a8a' }]}>
                                <Icon name="document-outline" size={24} color="#3B82F6" />
                            </View>
                            <View>
                                <Text style={[styles.attachMenuTitle, { color: colors.text }]}>Send File</Text>
                                <Text style={[styles.attachMenuSubtitle, { color: colors.textSecondary }]}>Normal upload</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.attachMenuDivider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity style={styles.attachMenuItem}>
                            <View style={[styles.attachMenuItemIcon, { backgroundColor: colors.surface === '#FFFFFF' ? '#F3E8FF' : '#4c1d95' }]}>
                                <Icon name="wifi-outline" size={24} color="#a855f7" />
                            </View>
                            <View>
                                <Text style={[styles.attachMenuTitle, { color: colors.text }]}>P2P Transfer</Text>
                                <Text style={[styles.attachMenuSubtitle, { color: colors.textSecondary }]}>No size limit</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.attachMenuDivider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity style={styles.attachMenuItem}>
                            <View style={[styles.attachMenuItemIcon, { backgroundColor: colors.surface === '#FFFFFF' ? '#F1F5F9' : '#334155' }]}>
                                <Icon name="eye-outline" size={24} color="#94a3b8" />
                            </View>
                            <View>
                                <Text style={[styles.attachMenuTitle, { color: colors.text }]}>One-time View</Text>
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
});
