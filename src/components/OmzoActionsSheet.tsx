import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Share,
} from 'react-native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import api from '@/services/api';
import type { Omzo } from '@/types';

interface OmzoActionsSheetProps {
    isVisible: boolean;
    onClose: () => void;
    omzo: Omzo;
    isSaved: boolean;
    onToggleSave: () => void;
    isReposted?: boolean;
    onToggleRepost?: () => void;
}

export default function OmzoActionsSheet({
    isVisible,
    onClose,
    omzo,
    isSaved,
    onToggleSave,
    isReposted = false,
    onToggleRepost,
}: OmzoActionsSheetProps) {
    const { colors } = useThemeStore();
    const [showReportOptions, setShowReportOptions] = useState(false);

    const handleShare = async () => {
        try {
            const shareUrl = `https://odnix.com/omzo/${omzo.id}/`;
            await Share.share({
                message: `Check out this video by ${omzo.user?.username ?? omzo.username ?? 'someone'}${omzo.caption ? `: ${omzo.caption}` : ''}\n\n${shareUrl}`,
                url: shareUrl,
            });
            onClose();
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleSave = () => {
        onToggleSave();
        onClose();
    };

    const handleRepost = () => {
        onToggleRepost?.();
        onClose();
    };

    const handleReport = () => {
        setShowReportOptions(true);
    };

    const submitReport = async (reason: string) => {
        try {
            const response = await api.reportOmzo(omzo.id, reason);
            if (response.success) {
                Alert.alert(
                    'Report Submitted',
                    'Thank you for your report. We will review this content.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to submit report. Please try again.');
        }
        setShowReportOptions(false);
        onClose();
    };

    const reportReasons = [
        { id: 'spam', label: "It's spam", icon: 'megaphone' },
        { id: 'inappropriate', label: 'Inappropriate content', icon: 'warning' },
        { id: 'harassment', label: 'Harassment or bullying', icon: 'sad' },
        { id: 'violence', label: 'Violence or dangerous', icon: 'skull' },
        { id: 'hate_speech', label: 'Hate speech', icon: 'chatbubbles' },
        { id: 'misinformation', label: 'False information', icon: 'information-circle' },
        { id: 'copyright', label: 'Copyright violation', icon: 'document-text' },
        { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
    ];

    if (showReportOptions) {
        return (
            <Modal
                isVisible={isVisible}
                onBackdropPress={() => {
                    setShowReportOptions(false);
                    onClose();
                }}
                onSwipeComplete={() => {
                    setShowReportOptions(false);
                    onClose();
                }}
                swipeDirection="down"
                style={styles.modal}
            >
                <View style={[styles.container, { backgroundColor: colors.surface }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <View style={styles.swipeIndicator} />
                        <TouchableOpacity
                            onPress={() => setShowReportOptions(false)}
                            style={styles.backButton}
                        >
                            <Icon name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Report</Text>
                    </View>

                    <View style={styles.optionsList}>
                        <Text style={[styles.reportSubtitle, { color: colors.textSecondary }]}>
                            Why are you reporting this video?
                        </Text>
                        {reportReasons.map((reason) => (
                            <TouchableOpacity
                                key={reason.id}
                                style={[styles.optionItem, { borderBottomColor: colors.border }]}
                                onPress={() => submitReport(reason.id)}
                            >
                                <Icon name={reason.icon as any} size={24} color={colors.text} />
                                <Text style={[styles.optionText, { color: colors.text }]}>
                                    {reason.label}
                                </Text>
                                <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            style={styles.modal}
        >
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.swipeIndicator} />
                </View>

                <View style={styles.optionsList}>
                    <TouchableOpacity
                        style={[styles.optionItem, { borderBottomColor: colors.border }]}
                        onPress={handleSave}
                    >
                        <Icon
                            name={isSaved ? 'bookmark' : 'bookmark-outline'}
                            size={24}
                            color={colors.text}
                        />
                        <Text style={[styles.optionText, { color: colors.text }]}>
                            {isSaved ? 'Remove from saved' : 'Save video'}
                        </Text>
                    </TouchableOpacity>

                    {onToggleRepost && (
                        <TouchableOpacity
                            style={[styles.optionItem, { borderBottomColor: colors.border }]}
                            onPress={handleRepost}
                        >
                            <Icon
                                name={isReposted ? 'repeat' : 'repeat-outline'}
                                size={24}
                                color={isReposted ? '#10B981' : colors.text}
                            />
                            <Text style={[styles.optionText, { color: isReposted ? '#10B981' : colors.text }]}>
                                {isReposted ? 'Undo Repost' : 'Repost to profile'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.optionItem, { borderBottomColor: colors.border }]}
                        onPress={handleShare}
                    >
                        <Icon name="share-outline" size={24} color={colors.text} />
                        <Text style={[styles.optionText, { color: colors.text }]}>
                            Share video
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.optionItem, { borderBottomColor: colors.border }]}
                        onPress={handleReport}
                    >
                        <Icon name="flag-outline" size={24} color="#FF3B30" />
                        <Text style={[styles.optionText, { color: '#FF3B30' }]}>
                            Report
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onClose}
                    >
                        <Text style={[styles.cancelText, { color: colors.text }]}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
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
    },
    header: {
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        position: 'relative',
    },
    swipeIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#CCCCCC',
        borderRadius: 2,
    },
    backButton: {
        position: 'absolute',
        left: 16,
        top: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 8,
    },
    optionsList: {
        paddingBottom: 20,
    },
    reportSubtitle: {
        fontSize: 14,
        padding: 16,
        paddingBottom: 8,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        gap: 16,
    },
    optionText: {
        flex: 1,
        fontSize: 16,
    },
    cancelButton: {
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
