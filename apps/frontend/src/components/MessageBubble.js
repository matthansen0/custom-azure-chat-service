import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
const quickReactions = ["👍", "❤️", "😂", "😮", "😢"];
export function MessageBubble({ message, userId, senderName, members, isEditing, editValue, onEditValueChange, onStartEdit, onConfirmEdit, onCancelEdit, onDelete, onReact, onUnreact, onReply, onVisible }) {
    const isMine = message.senderId === userId;
    const isDeleted = message.deleted;
    const bubbleRef = useRef(null);
    useEffect(() => {
        if (!onVisible || isMine || isDeleted)
            return;
        if (message.readByUserIds?.includes(userId))
            return;
        const node = bubbleRef.current;
        if (!node || typeof IntersectionObserver === "undefined") {
            // Fallback: optimistically mark on mount.
            onVisible(message.id);
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    onVisible(message.id);
                    observer.disconnect();
                    break;
                }
            }
        }, { threshold: 0.6 });
        observer.observe(node);
        return () => observer.disconnect();
    }, [message.id, message.readByUserIds, isMine, isDeleted, onVisible, userId]);
    if (isDeleted) {
        return (_jsx("div", { className: "message-bubble deleted", ref: bubbleRef, children: _jsx("span", { className: "message-bubble__deleted-text", children: "This message has been deleted" }) }));
    }
    // Read receipt — show on own messages only (Teams-style: who has seen this).
    const otherReaders = isMine
        ? (message.readByUserIds ?? []).filter((id) => id !== userId)
        : [];
    const metadata = (message.metadata ?? {});
    const mentionedUserIds = Array.isArray(metadata.mentions) ? metadata.mentions : [];
    const mentionEveryone = Boolean(metadata.mentionEveryone);
    const mentionsMe = mentionedUserIds.includes(userId) || mentionEveryone;
    const isUrgent = message.priority === "urgent";
    const replyTo = metadata.replyTo;
    const replyToSenderName = replyTo
        ? members.find((m) => m.id === replyTo.senderId)?.displayName ?? "someone"
        : null;
    return (_jsxs("div", { className: `message-bubble ${isMine ? "mine" : ""} ${mentionsMe && !isMine ? "mentioned" : ""} ${isUrgent ? "urgent" : ""}`, ref: bubbleRef, children: [!isMine && (_jsx("div", { className: "message-bubble__avatar", children: _jsx("span", { children: senderName.charAt(0).toUpperCase() }) })), _jsxs("div", { className: "message-bubble__body", children: [!isMine && _jsx("div", { className: "message-bubble__sender", children: senderName }), isUrgent && (_jsx("div", { className: "message-bubble__urgent-badge", title: "Emergency message", children: "\uD83D\uDEA8 Emergency" })), replyTo && (_jsxs("div", { className: "message-bubble__reply-quote", children: [_jsx("div", { className: "message-bubble__reply-bar" }), _jsxs("div", { className: "message-bubble__reply-body", children: [_jsx("div", { className: "message-bubble__reply-author", children: replyToSenderName }), _jsx("div", { className: "message-bubble__reply-preview", children: replyTo.content
                                            ? replyTo.content.length > 140
                                                ? `${replyTo.content.slice(0, 140)}…`
                                                : replyTo.content
                                            : "Original message unavailable" })] })] })), isEditing ? (_jsxs("div", { className: "message-bubble__edit", children: [_jsx("textarea", { className: "message-bubble__edit-input", value: editValue, onChange: (e) => onEditValueChange(e.target.value), onKeyDown: (e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        onConfirmEdit();
                                    }
                                    if (e.key === "Escape")
                                        onCancelEdit();
                                } }), _jsxs("div", { className: "message-bubble__edit-actions", children: [_jsx("button", { className: "btn-sm btn-primary", onClick: onConfirmEdit, children: "Save" }), _jsx("button", { className: "btn-sm", onClick: onCancelEdit, children: "Cancel" })] })] })) : (_jsxs("div", { className: "message-bubble__content", children: [_jsx("p", { children: renderContentWithMentions(message.content, members, userId) }), message.editedUtc && _jsx("span", { className: "message-bubble__edited", children: "(edited)" })] })), Object.keys(message.reactionSummary ?? {}).length > 0 && (_jsx("div", { className: "message-bubble__reactions", children: Object.entries(message.reactionSummary).map(([emoji, userIds]) => (_jsxs("button", { className: `reaction-chip ${userIds.includes(userId) ? "active" : ""}`, onClick: () => userIds.includes(userId) ? onUnreact(emoji) : onReact(emoji), children: [emoji, " ", userIds.length] }, emoji))) })), _jsxs("div", { className: "message-bubble__time", children: [new Date(message.createdUtc).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit"
                            }), isMine && (_jsx("span", { className: `message-bubble__receipt ${otherReaders.length > 0 ? "seen" : "sent"}`, title: otherReaders.length > 0
                                    ? `Seen by ${otherReaders
                                        .map((id) => members.find((m) => m.id === id)?.displayName ?? id)
                                        .join(", ")}`
                                    : "Sent", children: otherReaders.length > 0 ? `✓✓ Seen${otherReaders.length > 1 ? ` · ${otherReaders.length}` : ""}` : "✓ Sent" }))] })] }), _jsxs("div", { className: "message-bubble__actions", children: [quickReactions.map((emoji) => (_jsx("button", { className: "action-btn", onClick: () => onReact(emoji), title: `React ${emoji}`, children: emoji }, emoji))), _jsx("button", { className: "action-btn", onClick: onReply, title: "Reply", children: "\u21A9\uFE0F" }), isMine && (_jsxs(_Fragment, { children: [_jsx("button", { className: "action-btn", onClick: onStartEdit, title: "Edit", children: "\u270F\uFE0F" }), _jsx("button", { className: "action-btn", onClick: onDelete, title: "Delete", children: "\uD83D\uDDD1\uFE0F" })] }))] })] }));
}
function renderContentWithMentions(content, members, currentUserId) {
    const memberNames = members.map((m) => m.displayName);
    // Match @everyone or @<display name> (greedy up to two words to support spaces).
    const pattern = /@(everyone|[A-Za-z0-9_][A-Za-z0-9_ .-]{0,40}?)(?=$|[\s,.;:!?])/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = pattern.exec(content)) !== null) {
        const raw = match[1];
        // Try to greedily match the longest known display name starting at this position.
        let token = raw;
        let resolvedId = null;
        let isEveryone = false;
        if (raw.toLowerCase() === "everyone") {
            isEveryone = true;
        }
        else {
            // Search for the longest member name that the remaining string starts with.
            const after = content.slice(match.index + 1);
            let best = "";
            for (const name of memberNames) {
                if (after.startsWith(name) && name.length > best.length) {
                    best = name;
                }
            }
            if (best) {
                token = best;
                const found = members.find((m) => m.displayName === best);
                resolvedId = found?.id ?? null;
            }
        }
        const start = match.index;
        if (start > lastIndex) {
            parts.push(content.slice(lastIndex, start));
        }
        const mentionsMe = isEveryone || resolvedId === currentUserId;
        parts.push(_jsxs("span", { className: `mention-chip ${mentionsMe ? "mention-chip--me" : ""} ${isEveryone ? "mention-chip--everyone" : ""}`, children: ["@", token] }, `m-${key++}`));
        lastIndex = start + 1 + token.length;
        pattern.lastIndex = lastIndex;
    }
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }
    return parts.length > 0 ? parts : content;
}
