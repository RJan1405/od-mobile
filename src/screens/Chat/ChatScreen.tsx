import React, { useEffect, useState, useRef } from 'react';
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
    const { messages, loadMessages, addMessage, sendMessage } = useChatStore();
    const { chatId } = route.params as { chatId: number };
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadMessages(chatId);

        // Connect to WebSocket
        const unsubscribe = websocket.connectToChat(chatId, (message: Message) => {
            addMessage(chatId, message);
        });

        return () => {
            unsubscribe();
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
        const avatarUrl = item.sender?.profile_picture_url;

        return (
            <View
                style={[
                    styles.messageContainer,
                    isOwnMessage ? styles.ownMessage : styles.otherMessage,
                ]}
            >
                {!isOwnMessage && (
                    <Image
                        source={{ uri: avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : 'https://via.placeholder.com/40' }}
                        style={styles.messageAvatar}
                    />
                )}
                <View
                    style={[
                        styles.messageBubble,
                        {
                            backgroundColor: isOwnMessage ? colors.primary : colors.surface,
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
                            { color: isOwnMessage ? '#FFFFFF' : colors.text },
                        ]}
                    >
                        {item.content || '(no content)'}
                    </Text>
                    <Text
                        style={[
                            styles.messageTime,
                            { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
                        ]}
                    >
                        {(() => {
                            try {
                                const date = new Date(item.timestamp);
                                if (isNaN(date.getTime())) {
                                    return item.timestamp?.toString().substring(0, 5) || '--:--';
                                }
                                return format(date, 'HH:mm');
                            } catch (e) {
                                return '--:--';
                            }
                        })()}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
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
            />

            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.inputButton}>
                    <Icon name="add-circle-outline" size={28} color={colors.primary} />
                </TouchableOpacity>

                <TextInput
                    style={[
                        styles.input,
                        { backgroundColor: colors.background, color: colors.text },
                    ]}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.textSecondary}
                    value={inputText}
                    onChangeText={handleTyping}
                    multiline
                    maxLength={1000}
                />

                <TouchableOpacity
                    style={styles.sendButton}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                >
                    <Icon
                        name="send"
                        size={24}
                        color={inputText.trim() ? colors.primary : colors.textSecondary}
                    />
                </TouchableOpacity>
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
        paddingVertical: 8,
    },
    messageContainer: {
        flexDirection: 'row',
        marginVertical: 4,
        maxWidth: '80%',
    },
    ownMessage: {
        alignSelf: 'flex-end',
    },
    otherMessage: {
        alignSelf: 'flex-start',
    },
    messageAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
    messageBubble: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        maxWidth: '100%',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginBottom: 8,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    messageTime: {
        fontSize: 11,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    inputButton: {
        padding: 8,
    },
    input: {
        flex: 1,
        maxHeight: 100,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 16,
        marginHorizontal: 8,
    },
    sendButton: {
        padding: 8,
    },
});
