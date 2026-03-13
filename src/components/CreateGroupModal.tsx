import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    FlatList,
    Image,
    ActivityIndicator,
    Platform,
    SafeAreaView,
    ScrollView,
    KeyboardAvoidingView,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { User } from '@/types';

interface CreateGroupModalProps {
    visible: boolean;
    onClose: () => void;
    onGroupCreated?: (chatId: number) => void;
}

export default function CreateGroupModal({ visible, onClose, onGroupCreated }: CreateGroupModalProps) {
    const { colors } = useThemeStore();
    const { user } = useAuthStore();
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [avatar, setAvatar] = useState<any>(null);
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [membersList, setMembersList] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingMembers, setFetchingMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (visible && user) {
            fetchMembers();
        }
    }, [visible, user]);

    const fetchMembers = async () => {
        if (!user) return;
        setFetchingMembers(true);
        try {
            // Fetch both following and followers to give a complete list of potential group members
            const [followingRes, followersRes] = await Promise.all([
                api.getFollowing(user.username),
                api.getFollowers(user.username)
            ]);

            let allMembers: User[] = [];
            if (followingRes.success) {
                const following = followingRes.following || [];
                allMembers = [...following];
            }
            if (followersRes.success) {
                const followers = followersRes.followers || [];
                // Add followers that are not already in the list
                followers.forEach((follower: User) => {
                    if (!allMembers.find(m => m.id === follower.id)) {
                        allMembers.push(follower);
                    }
                });
            }
            
            setMembersList(allMembers);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setFetchingMembers(false);
        }
    };

    const handlePickAvatar = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
            setAvatar(result.assets[0]);
        }
    };

    const toggleMember = (memberId: number) => {
        if (selectedMembers.includes(memberId)) {
            setSelectedMembers(selectedMembers.filter(id => id !== memberId));
        } else {
            setSelectedMembers([...selectedMembers, memberId]);
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter a group name');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('description', description.trim());
            formData.append('is_public', 'false');
            formData.append('max_participants', '100');
            
            // Participants must be a JSON string for the backend as per chat/views/chat.py
            formData.append('participants', JSON.stringify(selectedMembers));

            if (avatar) {
                formData.append('avatar', {
                    uri: Platform.OS === 'ios' ? avatar.uri.replace('file://', '') : avatar.uri,
                    type: avatar.type,
                    name: avatar.fileName || 'group_avatar.jpg',
                } as any);
            }

            const response = await api.createGroup(formData);
            if (response.success && response.data?.group) {
                Alert.alert('Success', 'Group created successfully');
                if (onGroupCreated) {
                    onGroupCreated(response.data.group.id);
                }
                resetAndClose();
            } else {
                Alert.alert('Error', response.error || 'Failed to create group');
            }
        } catch (error) {
            console.error('Create group error:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const resetAndClose = () => {
        setName('');
        setDescription('');
        setAvatar(null);
        setSelectedMembers([]);
        setSearchQuery('');
        onClose();
    };

    const filteredMembers = membersList.filter(member => 
        (member.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.username || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderMemberItem = ({ item }: { item: User }) => {
        const isSelected = selectedMembers.includes(item.id);
        const avatarUrl = item.avatar || item.profile_picture_url || item.profile_picture || 'https://via.placeholder.com/40';

        return (
            <TouchableOpacity 
                style={[styles.memberItem, { borderBottomColor: colors.border }]}
                onPress={() => toggleMember(item.id)}
            >
                <Image source={{ uri: avatarUrl }} style={styles.memberAvatar} />
                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>{item.full_name || item.username}</Text>
                    <Text style={[styles.memberUsername, { color: colors.textSecondary }]}>@{item.username}</Text>
                </View>
                <View style={[
                    styles.checkbox, 
                    { borderColor: colors.primary },
                    isSelected && { backgroundColor: colors.primary }
                ]}>
                    {isSelected && <Icon name="checkmark" size={16} color="#FFF" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={resetAndClose}
        >
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={resetAndClose} style={styles.headerButton}>
                            <Text style={[styles.headerButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>New Group</Text>
                        <TouchableOpacity onPress={handleCreate} disabled={loading} style={styles.headerButton}>
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={[styles.headerButtonText, { color: colors.primary, fontWeight: '700' }]}>Create</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {fetchingMembers ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredMembers}
                            renderItem={renderMemberItem}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.listContent}
                            ListHeaderComponent={
                                <View>
                                    {/* Group Info Section */}
                                    <View style={styles.groupInfoContainer}>
                                        <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarContainer}>
                                            {avatar ? (
                                                <Image source={{ uri: avatar.uri }} style={styles.groupAvatar} />
                                            ) : (
                                                <View style={[styles.placeholderAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                                    <Icon name="camera" size={30} color={colors.textSecondary} />
                                                </View>
                                            )}
                                            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                                                <Icon name="pencil" size={12} color="#FFF" />
                                            </View>
                                        </TouchableOpacity>

                                        <View style={styles.inputContainer}>
                                            <TextInput
                                                style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                                placeholder="Group Name"
                                                placeholderTextColor={colors.textSecondary}
                                                value={name}
                                                onChangeText={setName}
                                            />
                                            <TextInput
                                                style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                                placeholder="Description (Optional)"
                                                placeholderTextColor={colors.textSecondary}
                                                value={description}
                                                onChangeText={setDescription}
                                                multiline
                                            />
                                        </View>
                                    </View>

                                    {/* Members Selection Section */}
                                    <View style={[styles.membersHeader, { backgroundColor: colors.surface }]}>
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Members</Text>
                                        <Text style={[styles.selectionCount, { color: colors.textSecondary }]}>
                                            {selectedMembers.length} selected
                                        </Text>
                                    </View>

                                    <View style={styles.searchContainer}>
                                        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
                                            <Icon name="search" size={18} color={colors.textSecondary} />
                                            <TextInput
                                                style={[styles.searchInput, { color: colors.text }]}
                                                placeholder="Search following/followers"
                                                placeholderTextColor={colors.textSecondary}
                                                value={searchQuery}
                                                onChangeText={setSearchQuery}
                                            />
                                            {searchQuery !== '' && (
                                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                                    <Icon name="close-circle" size={18} color={colors.textSecondary} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={{ color: colors.textSecondary }}>No connections found</Text>
                                </View>
                            }
                        />
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
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
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerButton: {
        minWidth: 60,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerButtonText: {
        fontSize: 16,
    },
    listContent: {
        paddingBottom: 40,
    },
    groupInfoContainer: {
        flexDirection: 'row',
        padding: 20,
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 20,
    },
    groupAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    placeholderAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    inputContainer: {
        flex: 1,
    },
    input: {
        fontSize: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        marginBottom: 10,
    },
    membersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    selectionCount: {
        fontSize: 14,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 40,
        borderRadius: 20,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    memberAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
    },
    memberUsername: {
        fontSize: 14,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
});
