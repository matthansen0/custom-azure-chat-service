import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Composer } from "./Composer.js";
import { MessageBubble } from "./MessageBubble.js";
export function ConversationView({ roomName, roomType, messages, members, userId, typingUsers, onSend, onEdit, onDelete, onReact, onUnreact, onMarkRead, onTyping, onToggleMembers, showMembers }) {
    const scrollRef = useRef(null);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);
    const getMemberName = (id) => members.find((m) => m.id === id)?.displayName ?? id;
    const startEdit = (msg) => {
        setEditingId(msg.id);
        setEditValue(msg.content);
    };
    const confirmEdit = async () => {
        if (editingId && editValue.trim()) {
            await onEdit(editingId, editValue);
        }
        setEditingId(null);
        setEditValue("");
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditValue("");
    };
    // Group messages by date
    const groupedMessages = groupByDate(messages);
    return (_jsxs("div", { className: "conversation", children: [_jsxs("div", { className: "conversation__header", children: [_jsxs("div", { className: "conversation__header-left", children: [_jsx("h2", { className: "conversation__title", children: roomName }), _jsxs("span", { className: "conversation__subtitle", children: [members.length, " member", members.length !== 1 ? "s" : ""] })] }), _jsx("div", { className: "conversation__header-actions", children: _jsx("button", { className: `header-btn ${showMembers ? "active" : ""}`, onClick: onToggleMembers, title: "Toggle members panel", children: "\uD83D\uDC65" }) })] }), _jsx("div", { className: "conversation__messages", ref: scrollRef, children: groupedMessages.map(({ date, msgs }) => (_jsxs("div", { className: "message-group", children: [_jsx("div", { className: "message-group__date", children: _jsx("span", { children: date }) }), msgs.map((msg) => (_jsx(MessageBubble, { message: msg, userId: userId, senderName: getMemberName(msg.senderId), members: members, isEditing: editingId === msg.id, editValue: editValue, onEditValueChange: setEditValue, onStartEdit: () => startEdit(msg), onConfirmEdit: confirmEdit, onCancelEdit: cancelEdit, onDelete: () => onDelete(msg.id), onReact: (reaction) => onReact(msg.id, reaction), onUnreact: (reaction) => onUnreact(msg.id, reaction), onReply: () => setReplyingTo({
                                messageId: msg.id,
                                senderName: getMemberName(msg.senderId),
                                content: msg.content
                            }), onVisible: (id) => void onMarkRead(id) }, msg.id)))] }, date))) }), typingUsers.length > 0 && (_jsxs("div", { className: "conversation__typing", children: [typingUsers.map((u) => getMemberName(u)).join(", "), " ", typingUsers.length === 1 ? "is" : "are", " typing..."] })), _jsx(Composer, { onSend: async (content, options) => {
                    await onSend(content, options);
                    setReplyingTo(null);
                }, onTyping: onTyping, members: members, currentUserId: userId, replyingTo: replyingTo, onCancelReply: () => setReplyingTo(null) })] }));
}
function groupByDate(messages) {
    const groups = [];
    let currentDate = "";
    for (const msg of messages) {
        const date = formatDate(msg.createdUtc);
        if (date !== currentDate) {
            currentDate = date;
            groups.push({ date, msgs: [msg] });
        }
        else {
            groups[groups.length - 1].msgs.push(msg);
        }
    }
    return groups;
}
function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0)
        return "Today";
    if (diffDays === 1)
        return "Yesterday";
    return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}
