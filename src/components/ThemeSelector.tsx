import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { THEME_COLORS, THEME_INFO } from '@/config';

interface ThemeSelectorProps {
    isVisible: boolean;
    onClose: () => void;
}

export default function ThemeSelector({ isVisible, onClose }: ThemeSelectorProps) {
    const { theme: currentTheme, colors, setTheme } = useThemeStore();

    const handleThemeSelect = async (themeName: keyof typeof THEME_COLORS) => {
        await setTheme(themeName);
        onClose();
    };

    const themes = Object.keys(THEME_COLORS) as Array<keyof typeof THEME_COLORS>;

    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            style={styles.modal}
            propagateSwipe
        >
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
                {/* Handle */}
                <View style={styles.handle} />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        Choose Theme
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Icon name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Theme Grid */}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.grid}>
                        {themes.map((themeName) => {
                            const themeInfo = THEME_INFO[themeName];
                            const isSelected = themeName === currentTheme;

                            return (
                                <TouchableOpacity
                                    key={themeName}
                                    style={[
                                        styles.themeButton,
                                        {
                                            backgroundColor: colors.background,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                        },
                                    ]}
                                    onPress={() => handleThemeSelect(themeName)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.themeIcon}>{themeInfo.icon}</Text>
                                    <Text style={[styles.themeName, { color: colors.text }]}>
                                        {themeInfo.name}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.checkmark}>
                                            <Icon name="checkmark" size={16} color={colors.primary} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Info */}
                    <View style={[styles.infoBox, { backgroundColor: colors.background }]}>
                        <Icon name="information-circle-outline" size={20} color={colors.textSecondary} />
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            Theme changes apply instantly across the app
                        </Text>
                    </View>
                </ScrollView>
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
        maxHeight: '90%',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        position: 'relative',
    },
    swipeIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#CCCCCC',
        borderRadius: 2,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 20,
    },
    scrollView: {
        flex: 1,
    },
    themeGrid: {
        padding: 16,
        gap: 16,
    },
    themeCard: {
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    previewContainer: {
        padding: 12,
    },
    preview: {
        height: 120,
        borderRadius: 12,
        overflow: 'hidden',
        padding: 12,
    },
    previewContent: {
        flex: 1,
        gap: 8,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        gap: 8,
    },
    previewDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    previewLine: {
        height: 8,
        borderRadius: 4,
        flex: 1,
        opacity: 0.7,
    },
    previewBody: {
        gap: 6,
        paddingHorizontal: 8,
    },
    previewButton: {
        height: 32,
        borderRadius: 16,
        marginTop: 'auto',
    },
    themeInfo: {
        padding: 16,
        paddingTop: 8,
    },
    themeNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    themeIcon: {
        fontSize: 20,
    },
    themeName: {
        fontSize: 18,
        fontWeight: '600',
    },
    themeDescription: {
        fontSize: 14,
    },
    selectedBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        borderTopWidth: 1,
    },
    footerText: {
        fontSize: 13,
        flex: 1,
    },
});
