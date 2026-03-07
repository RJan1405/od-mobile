import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export default function CreateScribeScreen() {
    const { colors } = useThemeStore();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.text, { color: colors.text }]}>Create Scribe Screen</Text>
            <Text style={[styles.subtext, { color: colors.textSecondary }]}>
                Coming soon...
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtext: {
        fontSize: 16,
        marginTop: 8,
    },
});
