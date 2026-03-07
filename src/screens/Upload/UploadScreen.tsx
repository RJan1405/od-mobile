import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';

export default function UploadScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const [visible, setVisible] = React.useState(true);

    const handleCreateScribe = () => {
        setVisible(false);
        navigation.navigate('CreateScribe' as never);
    };

    const handleCreateOmzo = () => {
        setVisible(false);
        // Navigate to create omzo screen (to be implemented)
        console.log('Create Omzo');
    };

    const handleClose = () => {
        setVisible(false);
        // Navigate back to Home
        navigation.navigate('Home' as never);
    };

    React.useEffect(() => {
        setVisible(true);
    }, []);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={handleClose}
            >
                <View style={styles.container}>
                    <View style={[styles.menu, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Create New</Text>

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={handleCreateScribe}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
                                <Icon name="newspaper-outline" size={28} color="#FFFFFF" />
                            </View>
                            <View style={styles.menuText}>
                                <Text style={[styles.menuTitle, { color: colors.text }]}>Scribe</Text>
                                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Share your thoughts</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={handleCreateOmzo}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                                <Icon name="videocam-outline" size={28} color="#FFFFFF" />
                            </View>
                            <View style={styles.menuText}>
                                <Text style={[styles.menuTitle, { color: colors.text }]}>Omzo</Text>
                                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Record a video</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleClose}
                        >
                            <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        padding: 16,
    },
    menu: {
        borderRadius: 16,
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        paddingVertical: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuText: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 2,
    },
    menuSubtitle: {
        fontSize: 14,
    },
    cancelButton: {
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    cancelText: {
        fontSize: 17,
        fontWeight: '600',
    },
});
