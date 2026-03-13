import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    PermissionsAndroid,
    Alert,
} from 'react-native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types';

interface MessageActionsSheetProps {
    isVisible: boolean;
    onClose: () => void;
    message: Message | null;
    onReply: (message: Message) => void;
    onForward: (message: Message) => void;
    onStar: (message: Message) => void;
    onSelect: (message: Message) => void;
    onDeleteForMe: (message: Message) => void;
    onDeleteForEveryone: (message: Message) => void;
}

export default function MessageActionsSheet({
    isVisible,
    onClose,
    message,
    onReply,
    onForward,
    onStar,
    onSelect,
    onDeleteForMe,
    onDeleteForEveryone,
}: MessageActionsSheetProps) {
    const { colors } = useThemeStore();
    const { user } = useAuthStore();

    if (!message) return null;

    const isOwnMessage = message.sender?.id === user?.id;
    const hasMedia = !!message.media_url;

    const handleDownload = async () => {
        if (!message.media_url) return;
        Alert.alert('Download', 'Download feature is being integrated. You can view the media in the chat.');
    };

    const actions = [
        {
            id: 'reply',
            label: 'Reply',
            icon: 'arrow-undo-outline',
            onPress: () => {
                onReply(message);
                onClose();
            },
        },
        {
            id: 'forward',
            label: 'Forward',
            icon: 'arrow-redo-outline',
            onPress: () => {
                onForward(message);
                onClose();
            },
        },
        {
            id: 'star',
            label: 'Star',
            icon: 'star-outline', // Todo check if starred
            onPress: () => {
                onStar(message);
                onClose();
            },
        },
        ...(hasMedia ? [{
            id: 'download',
            label: 'Download',
            icon: 'download-outline',
            onPress: handleDownload,
        }] : []),
        {
            id: 'select',
            label: 'Select',
            icon: 'checkbox-outline',
            onPress: () => {
                onSelect(message);
                onClose();
            },
        },
        {
            id: 'delete_me',
            label: 'Delete for me',
            icon: 'trash-outline',
            onPress: () => {
                onDeleteForMe(message);
                onClose();
            },
            color: '#FF3B30',
        },
        ...(isOwnMessage ? [{
            id: 'delete_everyone',
            label: 'Delete for everyone',
            icon: 'trash-bin-outline',
            onPress: () => {
                onDeleteForEveryone(message);
                onClose();
            },
            color: '#FF3B30',
        }] : []),
    ];

    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            style={styles.modal}
            backdropOpacity={0.4}
        >
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.swipeIndicator} />
                </View>

                <View style={styles.optionsList}>
                    {actions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={[styles.optionItem, { borderBottomColor: colors.border }]}
                            onPress={action.onPress}
                        >
                            <Icon
                                name={action.icon as any}
                                size={22}
                                color={action.color || colors.text}
                            />
                            <Text style={[styles.optionText, { color: action.color || colors.text }]}>
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: {
        margin: 0,
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0,
    },
    swipeIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#CCCCCC',
        borderRadius: 2,
    },
    optionsList: {
        paddingHorizontal: 0,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 16,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
