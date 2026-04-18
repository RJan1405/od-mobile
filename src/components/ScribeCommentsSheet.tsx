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
    Keyboard,
} from 'react-native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/Ionicons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { Comment } from '@/types';
import { useInteractionStore } from '@/stores/interactionStore';

interface ScribeCommentsSheetProps {
    isVisible: boolean;
    onClose: () => void;
    scribeId: number;
    initialCommentCount: number;
    onCommentAdded?: () => void;
}

export default function ScribeCommentsSheet({
    isVisible,
    onClose,
    scribeId,
    initialCommentCount,
    onCommentAdded,
}: ScribeCommentsSheetProps) {
    const { colors, theme } = useThemeStore();
    const { user } = useAuthStore();
    const incrementCommentCount = useInteractionStore(state => state.incrementCommentCount);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
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
            (async () => {
                try {
                    const cached = await api.getCached(`/scribes/${scribeId}/comments/`);
                    if (cached && cached.success && (cached as any).comments) {
                        setComments((cached as any).comments);
                    }
                } catch (e) { }
                loadComments();
            })();
        }
    }, [isVisible, scribeId]);

    const loadComments = async () => {
        setIsLoading(true);
        try {
            const response = await api.getScribeComments(scribeId);
            console.log('📝 Scribe comments response:', response);
            if (response.success && (response as any).comments) {
                setComments((response as any).comments);
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddComment = async () => {
        const text = commentText.trim();
        if (!text || isSubmitting) return;

        const currentReplyingTo = replyingTo;
        
        setIsSubmitting(true);
        setCommentText('');
        setReplyingTo(null);
        Keyboard.dismiss();

        const optimisticId = Date.now() + Math.random();
        const optimisticComment = {
            id: optimisticId,
            content: text,
            user: user,
            created_at: new Date().toISOString(),
            parent: currentReplyingTo?.id || null,
            like_count: 0,
            is_liked: false,
            replies: [],
        };

        if (currentReplyingTo) {
            setComments(prev => prev.map(c => {
                if (c.id === currentReplyingTo.id) {
                    return {
                        ...c,
                        replies: [...(c.replies || []), optimisticComment as any],
                        reply_count: (c.reply_count || 0) + 1
                    };
                }
                return c;
            }));
        } else {
            setComments(prev => [optimisticComment as any, ...prev]);
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }, 100);
        }

        incrementCommentCount('scribe', scribeId);
        if (onCommentAdded) onCommentAdded();

        try {
            const response = await api.addComment(scribeId, text, currentReplyingTo?.id);
            if (response.success && (response as any).comment) {
                const newComment = (response as any).comment;   
                setComments(prev => prev.map(c => {
                    if (c.id === optimisticId) return newComment;
                    if ((c as any).replies?.length > 0) {
                        return {
                            ...c,
                            replies: c.replies.map((r: any) => r.id === optimisticId ? newComment : r)
                        };
                    }
                    return c;
                }));
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReply = (comment: Comment) => {
        setReplyingTo(comment);
        setCommentText(`@${comment.user?.username || (comment as any).user_username} `);
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

    const renderComment = (item: Comment, isReply = false) => {
        const username = item.user?.username || (item as any).user_username || 'unknown';
        const avatarUri = item.user?.profile_picture_url || (item.user as any)?.avatar || (item as any).user_profile_picture || '';
        const hasValidAvatar = avatarUri && avatarUri.startsWith('http');

        return (
            <View key={`comment-${item.id}`} style={[styles.commentItem, isReply && styles.replyItem]}>
                {hasValidAvatar ? (
                    <Image source={{ uri: avatarUri }} style={isReply ? styles.replyAvatar : styles.commentAvatar} />
                ) : (
                    <View style={[isReply ? styles.replyAvatar : styles.commentAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.avatarText}>
                            {username[0]?.toUpperCase() || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <Text style={[styles.commentUsername, { color: colors.text }]}>
                            @{username}
                        </Text>
                        <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                            {formatTime(item.timestamp || (item as any).created_at)}
                        </Text>
                    </View>
                    <Text style={[styles.commentText, { color: colors.text }]}>
                        {item.content}
                    </Text>
                    <View style={styles.commentActions}>
                        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                            <Icon name={(item as any).is_liked ? "heart" : "heart-outline"} size={16} color={(item as any).is_liked ? "#EF4444" : colors.textSecondary} />
                            <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                                {item.like_count || 0}
                            </Text>
                        </TouchableOpacity>
                        {!isReply && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                activeOpacity={0.7}
                                onPress={() => handleReply(item)}
                            >
                                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Reply</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Render Replies Toggle */}
                    {!isReply && (item as any).replies && (item as any).replies.length > 0 && (
                        <TouchableOpacity
                            style={styles.viewRepliesButton}
                            onPress={() => toggleReplies(item.id)}
                        >
                            <View style={[styles.repliesLine, { backgroundColor: colors.border }]} />
                            <Text style={[styles.viewRepliesText, { color: colors.textSecondary }]}>
                                {expandedComments.has(item.id)
                                    ? 'Hide replies'
                                    : `View ${(item as any).replies.length} ${(item as any).replies.length === 1 ? 'reply' : 'replies'}`}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Render Replies */}
                    {!isReply && (item as any).replies && (item as any).replies.length > 0 && expandedComments.has(item.id) && (
                        <View style={styles.repliesList}>
                            {(item as any).replies.map((reply: Comment) => renderComment(reply, true))}
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
                            style={[styles.closeButton, { backgroundColor: colors.background }]}
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
                        <ScrollView keyboardShouldPersistTaps="handled"
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
                        <View style={[styles.replyingIndicator, { backgroundColor: colors.background }]}>
                            <Text style={[styles.replyingText, { color: colors.textSecondary }]}>
                                Replying to <Text style={{ fontWeight: '700', color: colors.primary }}>@{replyingTo.user?.username || (replyingTo as any).user_username}</Text>
                            </Text>
                            <TouchableOpacity onPress={cancelReply}>
                                <Icon name="close-circle" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    <ScrollView
                        scrollEnabled={false}
                        keyboardShouldPersistTaps="always"
                        nestedScrollEnabled={false}
                    >
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
                    </ScrollView>
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
        backgroundColor: 'rgba(128, 128, 128, 0.3)',
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
        marginLeft: 44,
        marginTop: 8,
        marginBottom: 12,
    },
    replyAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    repliesList: {
        marginTop: 8,
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
});
