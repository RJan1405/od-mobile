import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useNavigation } from '@react-navigation/native';

interface CreateActionModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function CreateActionModal({ visible, onClose }: CreateActionModalProps) {
    const { colors } = useThemeStore();
    const navigation = useNavigation<any>();

    const handleCreateScribe = () => {
        onClose();
        navigation.navigate('CreateScribe');
    };

    const handleCreateOmzo = () => {
        onClose();
        navigation.navigate('CreateOmzo');
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
                            <View style={styles.header}>
                                <Text style={[styles.title, { color: colors.text }]}>Create</Text>
                                <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.background }]}>
                                    <Icon name="close" size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.optionsContainer}>
                                <TouchableOpacity
                                    style={[styles.optionItem, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                    onPress={handleCreateScribe}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
                                        <Icon name="document-text" size={24} color="#3B82F6" />
                                    </View>
                                    <View style={styles.optionTextContainer}>
                                        <Text style={[styles.optionTitle, { color: colors.text }]}>New Scribe</Text>
                                        <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                                            Text, image, or code snippet
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.optionItem}
                                    onPress={handleCreateOmzo}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: '#F3E8FF' }]}>
                                        <Icon name="videocam" size={24} color="#A855F7" />
                                    </View>
                                    <View style={styles.optionTextContainer}>
                                        <Text style={[styles.optionTitle, { color: colors.text }]}>New Omzo</Text>
                                        <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                                            Record or upload a short video
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 18,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionsContainer: {
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 13,
        fontWeight: '500',
    },
});
