with open('ScribeCommentsSheet.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_str = """    const handleAddComment = async () => {
        if (!commentText.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const response = await api.addComment(
                scribeId,
                commentText.trim(),
                replyingTo?.id
            );
            console.log('ðŸ“ Add comment response:', response);
             if (response.success && (response as any).comment) {
                const newComment = (response as any).comment;

                if (replyingTo) {
                    // Update the local state to show the reply in the correct place  
                    setComments(prev => prev.map(c => {
                        if (c.id === replyingTo.id) {
                            return {
                                ...c,
                                replies: [...(c.replies || []), newComment],
                                reply_count: (c.reply_count || 0) + 1
                            };
                        }
                        return c;
                    }));
                } else {
                    setComments(prev => [newComment, ...prev]);
                }

                setCommentText('');
                setReplyingTo(null);

                // Update global store for real-time sync across screens
                incrementCommentCount('scribe', scribeId);

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
    };"""

new_str = '''    const handleAddComment = () => {
        if (!commentText.trim() || isSubmitting) return;

        const text = commentText.trim();
        const replyTarget = replyingTo;

        setCommentText('');
        setReplyingTo(null);

        const tempId = f"temp_{Date.now()}";
        const tempComment: Comment = {
            id: tempId as any,
            content: text,
            created_at: new Date().toISOString(),
            user: user as any,
            replies: [],
            reply_count: 0
        };

        if (replyTarget) {
            setComments(prev => prev.map(c => {
                if (c.id === replyTarget.id) {
                    return {
                        ...c,
                        replies: [...(c.replies || []), tempComment],
                        reply_count: (c.reply_count || 0) + 1
                    };
                }
                return c;
            }));
        } else {
            setComments(prev => [tempComment, ...prev]);
        }

        incrementCommentCount('scribe', scribeId);

        if (onCommentAdded) {
            onCommentAdded();
        }

        setIsSubmitting(true);
        api.addComment(
            scribeId,
            text,
            replyTarget?.id
        ).then((response: any) => {
            setIsSubmitting(false);
            if (response.success && response.comment) {
                const newComment = response.comment;
                if (replyTarget) {
                    setComments(prev => prev.map(c => {
                        if (c.id === replyTarget.id) {
                            return {
                                ...c,
                                replies: c.replies?.map(r => r.id === tempId ? newComment : r) || []
                            };
                        }
                        return c;
                    }));
                } else {
                    setComments(prev => prev.map(c => c.id === tempId ? newComment : c));
                }
            }
        }).catch(error => {
            setIsSubmitting(false);
            console.error('Error adding comment:', error);
            if (replyTarget) {
                setComments(prev => prev.map(c => {
                    if (c.id === replyTarget.id) {
                        return {
                            ...c,
                            replies: c.replies?.filter(r => r.id !== tempId) || [],
                            reply_count: Math.max(0, (c.reply_count || 1) - 1)
                        };
                    }
                    return c;
                }));
            } else {
                setComments(prev => prev.filter(c => c.id !== tempId));
            }
        });
    };'''

new_str = new_str.replace('f"temp_{Date.now()}"', '	emp_')

if old_str in text:
    text_new = text.replace(old_str, new_str)
    with open('ScribeCommentsSheet.tsx', 'w', encoding='utf-8') as f:
        f.write(text_new)
    print("Success!")
else:
    print("String not found. :(")
