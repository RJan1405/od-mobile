import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export default function CreateStoryScreen() {
    const { colors } = useThemeStore();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.text, { color: colors.text }]}>Create Story Screen</Text>
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
});
