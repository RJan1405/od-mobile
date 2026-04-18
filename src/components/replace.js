const fs = require('fs');

const text = fs.readFileSync('ScribeCommentsSheet.tsx', 'utf-8');

const newStr = `    const handleAddComment = () => {
        if (!commentText.trim() || isSubmitting) return;

        const text = commentText.trim();
        const replyTarget = replyingTo;

        setCommentText('');
        setReplyingTo(null);

        const tempId = \`temp_\${Date.now()}\`;
        const tempComment = {
            id: tempId,
            content: text,
            created_at: new Date().toISOString(),
            user: user,
            replies: [],
            reply_count: 0
        };

        if (replyTarget) {
            setComments(prev => prev.map((c) => {
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
        ).then((response) => {
            setIsSubmitting(false);
            if (response.success && response.comment) {
                const newComment = response.comment;
                if (replyTarget) {
                    setComments(prev => prev.map((c) => {
                        if (c.id === replyTarget.id) {
                            return {
                                ...c,
                                replies: c.replies?.map((r) => r.id === tempId ? newComment : r) || []
                            };
                        }
                        return c;
                    }));
                } else {
                    setComments(prev => prev.map((c) => c.id === tempId ? newComment : c));
                }
            }
        }).catch(error => {
            setIsSubmitting(false);
            console.error('Error adding comment:', error);
            if (replyTarget) {
                setComments(prev => prev.map((c) => {
                    if (c.id === replyTarget.id) {
                        return {
                            ...c,
                            replies: c.replies?.filter((r) => r.id !== tempId) || [],
                            reply_count: Math.max(0, (c.reply_count || 1) - 1)
                        };
                    }
                    return c;
                }));
            } else {
                setComments(prev => prev.filter((c) => c.id !== tempId));
            }
        });
    };`;

let updatedStr = text.replace(/    const handleAddComment \= async \(\) => \{[\s\S]*?catch \(error\) \{[\s\S]*?finally \{[\s\S]*?\}\n    \};/m, newStr);

if (updatedStr !== text) {
    fs.writeFileSync('ScribeCommentsSheet.tsx', updatedStr, 'utf-8');
    console.log('Success!');
} else {
    console.log('Regex did not match.');
}
