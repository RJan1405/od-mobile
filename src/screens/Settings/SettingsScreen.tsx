import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { THEME_INFO, THEME_COLORS } from '@/config';
import Icon from 'react-native-vector-icons/Ionicons';

export default function SettingsScreen() {
    const navigation = useNavigation();
    const { colors, theme, setTheme } = useThemeStore();
    const { user, logout } = useAuthStore();

    const themeInfo = THEME_INFO[theme];
    const themes = Object.keys(THEME_COLORS) as Array<keyof typeof THEME_COLORS>;

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => logout(),
                },
            ]
        );
    };

    const handleThemeSelect = async (themeName: keyof typeof THEME_COLORS) => {
        await setTheme(themeName);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={themeInfo.isDark ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Icon name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Appearance Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        APPEARANCE
                    </Text>
                    <View style={styles.themeGrid}>
                        {themes.map((themeName) => {
                            const info = THEME_INFO[themeName];
                            const isSelected = themeName === theme;

                            return (
                                <TouchableOpacity
                                    key={themeName}
                                    style={[
                                        styles.themeButton,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                            borderWidth: isSelected ? 2 : 1,
                                        },
                                    ]}
                                    onPress={() => handleThemeSelect(themeName)}
                                >
                                    <Text style={styles.themeIcon}>{info.icon}</Text>
                                    <Text style={[styles.themeName, { color: colors.text }]}>
                                        {info.name}
                                    </Text>
                                    {isSelected && (
                                        <Icon name="checkmark" size={18} color={colors.primary} style={styles.checkmark} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        ACCOUNT
                    </Text>
                    <View style={[styles.menuList, { backgroundColor: colors.surface }]}>
                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomColor: colors.border }]}
                            onPress={() => navigation.navigate('EditProfile' as never)}
                        >
                            <Icon name="person-outline" size={22} color={colors.text} />
                            <Text style={[styles.menuLabel, { color: colors.text }]}>Edit Profile</Text>
                            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomColor: colors.border }]}
                            onPress={() => Alert.alert('Coming Soon', 'Privacy settings')}
                        >
                            <Icon name="shield-outline" size={22} color={colors.text} />
                            <Text style={[styles.menuLabel, { color: colors.text }]}>Privacy</Text>
                            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomColor: colors.border }]}
                            onPress={() => Alert.alert('Coming Soon', 'Notification settings')}
                        >
                            <Icon name="notifications-outline" size={22} color={colors.text} />
                            <Text style={[styles.menuLabel, { color: colors.text }]}>Notifications</Text>
                            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomColor: colors.border }]}
                            onPress={() => Alert.alert('Coming Soon', 'Blocked users list')}
                        >
                            <Icon name="ban-outline" size={22} color={colors.text} />
                            <Text style={[styles.menuLabel, { color: colors.text }]}>Blocked Users</Text>
                            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomWidth: 0 }]}
                            onPress={() => Alert.alert('Odnix', 'Version 1.0.0\n\nA modern social platform')}
                        >
                            <Icon name="information-circle-outline" size={22} color={colors.text} />
                            <Text style={[styles.menuLabel, { color: colors.text }]}>About Odnix</Text>
                            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={handleLogout}
                >
                    <Text style={[styles.logoutText, { color: colors.error }]}>
                        Log Out
                    </Text>
                </TouchableOpacity>

                <View style={styles.footer} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    headerRight: {
        width: 40,
    },
    section: {
        paddingTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    themeButton: {
        width: '47.5%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        gap: 10,
        position: 'relative',
    },
    themeIcon: {
        fontSize: 20,
    },
    themeName: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    checkmark: {
        marginLeft: 'auto',
    },
    menuList: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 14,
        borderBottomWidth: 1,
    },
    menuLabel: {
        fontSize: 16,
        fontWeight: '400',
        flex: 1,
    },
    logoutButton: {
        marginTop: 16,
        marginHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        height: 32,
    },
});
