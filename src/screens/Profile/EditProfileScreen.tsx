import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

export default function EditProfileScreen() {
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user, updateUser } = useAuthStore();

    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState(user?.full_name || '');
    const [username, setUsername] = useState(user?.username || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState<any>(null);
    const [coverImage, setCoverImage] = useState<any>(null);

    const handlePickAvatar = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
            setAvatar(result.assets[0]);
        }
    };

    const handlePickCover = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
            setCoverImage(result.assets[0]);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('displayName', displayName);
            formData.append('username', username);
            formData.append('bio', bio);

            if (avatar) {
                formData.append('avatar', {
                    uri: Platform.OS === 'ios' ? avatar.uri.replace('file://', '') : avatar.uri,
                    type: avatar.type,
                    name: avatar.fileName || 'avatar.jpg',
                } as any);
            }

            if (coverImage) {
                formData.append('cover_image', {
                    uri: Platform.OS === 'ios' ? coverImage.uri.replace('file://', '') : coverImage.uri,
                    type: coverImage.type,
                    name: coverImage.fileName || 'cover.jpg',
                } as any);
            }

            const response = await api.updateProfile(formData);
            if (response.success && response.data) {
                updateUser(response.data);
                Alert.alert('Success', 'Profile updated successfully');
                navigation.goBack();
            } else {
                Alert.alert('Error', response.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="close" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Text style={[styles.saveText, { color: colors.primary }]}>Done</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Cover Image */}
                <TouchableOpacity onPress={handlePickCover} style={styles.coverContainer}>
                    <Image
                        source={{ uri: coverImage?.uri || (user as any)?.cover_image_url || 'https://via.placeholder.com/800x400' }}
                        style={styles.coverImage}
                    />
                    <View style={styles.imageOverlay}>
                        <Icon name="camera" size={30} color="#FFF" />
                    </View>
                </TouchableOpacity>

                {/* Profile Picture */}
                <View style={styles.profileImageSection}>
                    <TouchableOpacity onPress={handlePickAvatar} style={styles.profileImageContainer}>
                        <Image
                            source={{ uri: avatar?.uri || user?.profile_picture_url }}
                            style={[styles.profileImage, { borderColor: colors.background }]}
                        />
                        <View style={styles.profileImageOverlay}>
                            <Icon name="camera" size={24} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Input Fields */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Enter your name"
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="username"
                            autoCapitalize="none"
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { color: colors.text, borderBottomColor: colors.border }]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Write something about yourself"
                            multiline
                            numberOfLines={3}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                </View>
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
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    saveText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    coverContainer: {
        height: 160,
        width: '100%',
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#E2E8F0',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileImageSection: {
        alignItems: 'center',
        marginTop: -50,
        marginBottom: 20,
    },
    profileImageContainer: {
        position: 'relative',
        borderRadius: 50,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
    },
    profileImageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    form: {
        paddingHorizontal: 20,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        fontSize: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
});
