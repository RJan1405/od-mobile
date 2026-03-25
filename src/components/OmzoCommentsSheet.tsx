import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
    ScrollView,
} from 'react-native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { OmzoComment } from '@/types';
import { useInteractionStore } from '@/stores/interactionStore';

interface OmzoCommentsSheetProps {
    isVisible: boolean;
    onClose: () => void;
    omzoId: number;
    initialCommentCount: number;
    onCommentAdded?: () => void;
}

export default function OmzoCommentsSheet({
    isVisible,
    onClose,
    omzoId,
    initialCommentCount,
    onCommentAdded,
}: OmzoCommentsSheetProps) {
    const { colors, theme } = useThemeStore();
    const { user } = useAuthStore();
    const incrementCommentCount = useInteractionStore(state => state.incrementCommentCount);
    const [comments, setComments] = useState<OmzoComment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());

    const [replyingTo, setReplyingTo] = useState<OmzoComment | null>(null);
    const inputRef = React.useRef<TextInput>(null);
    const scrollViewRef = React.useRef<ScrollView>(null);
    const [scrollOffset, setScrollOffset] = useState<number>(0);

    const handleScrollTo = (p: any) => {
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo(p);
        }
    };

    const toggleReplies = (commentId: number) => {
        setExpandedComments(prev => {
            const next = new Set(prev);
            if (next.has(commentId)) {
                next.delete(commentId);
            } else {
                next.add(commentId);
            }
            return next;
        });
    };

    useEffect(() => {
        if (isVisible) {
            loadComments();
        }
    }, [isVisible, omzoId]);

    const loadComments = async () => {
        setIsLoading(true);
        try {
            const response = await api.getOmzoComments(omzoId);
            console.log('📝 Omzo comments response:', response);
            if (response.success && (response as any).comments) {
                const fetchedComments = (response as any).comments;
                
                // Group comments if they are flat and have parent references
                const commentMap = new Map();
                const rootComments: any[] = [];

                fetchedComments.forEach((c: any) => {
                    commentMap.set(c.id, { ...c, replies: [] });
                });

                fetchedComments.forEach((c: any) => {
                    const current = commentMap.get(c.id);
                    if (c.parent && commentMap.has(c.parent)) {
                        const parent = commentMap.get(c.parent);
                        parent.replies.push(current);
                    } else if (!c.parent) {
                        rootComments.push(current);
                    }
                });

                setComments(rootComments.length > 0 ? rootComments : fetchedComments);
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const response = await api.addOmzoComment(omzoId, commentText.trim(), replyingTo?.id);
            console.log('📝 Add comment response:', response);
            if (response.success && (response as any).comment) {
                const newComment = { ...(response as any).comment, replies: [] };
                
                if (replyingTo) {
                    // Update state to nest the reply
                    setComments(prev => prev.map(c => {
                        if (c.id === replyingTo.id || (c as any).replies?.some((r: any) => r.id === replyingTo.id)) {
                             // If it's a direct reply or a reply to a reply
                             if (c.id === replyingTo.id) {
                                if (!expandedComments.has(c.id)) toggleReplies(c.id);
                                return { ...c, replies: [...(c as any).replies, newComment] };
                             } else {
                                // Nested search (though we only support 1 level usually)
                                return {
                                    ...c,
                                    replies: (c as any).replies.map((r: any) => 
                                        r.id === replyingTo.id ? { ...r, replies: [...(r.replies || []), newComment] } : r
                                    )
                                };
                             }
                        }
                        return c;
                    }));
                } else {
                    setComments(prev => [newComment, ...prev]);
                }

                setCommentText('');
                setReplyingTo(null);

                // Update global store
                incrementCommentCount('omzo', omzoId);

                // Notify parent component
                if (onCommentAdded) {
                    onCommentAdded();
                }
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReply = (comment: OmzoComment) => {
        setReplyingTo(comment);
        setCommentText(`@${comment.user?.username} `);
        inputRef.current?.focus();
    };

    const cancelReply = () => {
        setReplyingTo(null);
        setCommentText('');
    };

    const formatTime = (timestamp: string) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
        return `${Math.floor(diff / 604800)}w`;
    };

    const renderComment = (item: OmzoComment, isReply = false) => {
        const avatarUri = item.user?.profile_picture_url || (item.user as any)?.avatar || '';
        const hasValidAvatar = avatarUri && avatarUri.startsWith('http');
        const replies = (item as any).replies || [];

        return (
            <View key={`comment-${item.id}`} style={[styles.commentItem, isReply && styles.replyItem]}>
                {hasValidAvatar ? (
                    <Image source={{ uri: avatarUri }} style={isReply ? styles.replyAvatar : styles.commentAvatar} />
                ) : (
                    <View style={[isReply ? styles.replyAvatar : styles.commentAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={isReply ? styles.replyAvatarText : styles.avatarText}>
                            {item.user?.username?.[0]?.toUpperCase() || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <Text style={[styles.commentUsername, { color: colors.text }]}>
                            @{item.user.username}
                        </Text>
                        <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                            {formatTime(item.created_at || item.timestamp)}
                        </Text>
                    </View>
                    <Text style={[styles.commentText, { color: colors.text }]}>
                        {item.content}
                    </Text>
                    <View style={styles.commentActions}>
                        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                            <Icon name={item.is_liked ? "heart" : "heart-outline"} size={16} color={item.is_liked ? "#EF4444" : colors.textSecondary} />
                            <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                                {item.like_count || 0}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            activeOpacity={0.7}
                            onPress={() => handleReply(item)}
                        >
                            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Reply</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Render Replies Toggle */}
                    {!isReply && replies.length > 0 && (
                        <TouchableOpacity 
                            style={styles.viewRepliesButton} 
                            onPress={() => toggleReplies(item.id)}
                        >
                            <View style={[styles.repliesLine, { backgroundColor: colors.border }]} />
                            <Text style={[styles.viewRepliesText, { color: colors.textSecondary }]}>
                                {expandedComments.has(item.id) 
                                    ? 'Hide replies' 
                                    : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Render Replies */}
                    {!isReply && replies.length > 0 && expandedComments.has(item.id) && (
                        <View style={styles.repliesList}>
                            {replies.map((reply: OmzoComment) => renderComment(reply, true))}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            propagateSwipe={true}
            scrollTo={handleScrollTo}
            scrollOffset={scrollOffset}
            scrollOffsetMax={100}
            style={styles.modal}
        >
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.swipeIndicator} />
                    <View style={styles.headerTitleRow}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            {comments.length} comments
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={[styles.closeButton, { backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6' }]}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Icon name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Comments List */}
                <View style={styles.commentsContainer}>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : comments.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Icon name="chatbubble-outline" size={64} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No comments yet
                            </Text>
                            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                                Be the first to comment
                            </Text>
                        </View>
                    ) : (
                        <ScrollView
                            ref={scrollViewRef}
                            onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
                            scrollEventThrottle={16}
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled={true}
                            contentContainerStyle={styles.commentsList}
                        >
                            {comments.map((item) => renderComment(item))}
                        </ScrollView>
                    )}
                </View>

                {/* Input Section */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    {replyingTo && (
                        <View style={[styles.replyingIndicator, { backgroundColor: theme === 'dark' ? '#1F2937' : '#F3F4F6' }]}>
                            <Text style={[styles.replyingText, { color: colors.textSecondary }]}>
                                Replying to <Text style={{ fontWeight: '700', color: colors.primary }}>@{replyingTo.user?.username}</Text>
                            </Text>
                            <TouchableOpacity onPress={cancelReply}>
                                <Icon name="close-circle" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
                        {user?.profile_picture_url ? (
                            <Image
                                source={{ uri: user.profile_picture_url }}
                                style={styles.userAvatar}
                            />
                        ) : (
                            <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                                <Text style={styles.avatarText}>
                                    {user?.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <TextInput
                            ref={inputRef}
                            style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
                            placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
                            placeholderTextColor={colors.textSecondary}
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={handleAddComment}
                            disabled={!commentText.trim() || isSubmitting}
                            style={styles.sendButton}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Icon
                                    name="send"
                                    size={24}
                                    color={commentText.trim() ? colors.primary : colors.textSecondary}
                                />
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
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
        height: '75%', // Taller to look more like image
    },
    header: {
        paddingTop: 10,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    swipeIndicator: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginBottom: 16,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentsContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 8,
    },
    commentsList: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 20,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    commentAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    commentUsername: {
        fontSize: 15,
        fontWeight: '700',
        marginRight: 8,
    },
    commentTime: {
        fontSize: 13,
    },
    commentText: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 10,
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    actionText: {
        fontSize: 13,
        marginLeft: 4,
        fontWeight: '600',
    },
    replyingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    replyingText: {
        fontSize: 13,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
    },
    userAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        maxHeight: 100,
        fontSize: 14,
    },
    sendButton: {
        marginLeft: 8,
        padding: 8,
    },
    replyItem: {
        marginLeft: 40,
        marginTop: 10,
        marginBottom: 10,
    },
    replyAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    replyAvatarText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    viewRepliesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 4,
        marginTop: 8,
        paddingVertical: 4,
    },
    repliesLine: {
        width: 30,
        height: 1,
        marginRight: 10,
    },
    viewRepliesText: {
        fontSize: 13,
        fontWeight: '600',
    },
    repliesList: {
        marginTop: 10,
    },
});
