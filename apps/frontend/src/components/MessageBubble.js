import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const quickReactions = ["👍", "❤️", "😂", "😮", "😢"];
export function MessageBubble({ message, userId, senderName, isEditing, editValue, onEditValueChange, onStartEdit, onConfirmEdit, onCancelEdit, onDelete, onReact, onUnreact }) {
    const isMine = message.senderId === userId;
    const isDeleted = message.deleted;
    if (isDeleted) {
        return (_jsx("div", { className: "message-bubble deleted", children: _jsx("span", { className: "message-bubble__deleted-text", children: "This message has been deleted" }) }));
    }
    return (_jsxs("div", { className: `message-bubble ${isMine ? "mine" : ""}`, children: [!isMine && (_jsx("div", { className: "message-bubble__avatar", children: _jsx("span", { children: senderName.charAt(0).toUpperCase() }) })), _jsxs("div", { className: "message-bubble__body", children: [!isMine && _jsx("div", { className: "message-bubble__sender", children: senderName }), isEditing ? (_jsxs("div", { className: "message-bubble__edit", children: [_jsx("textarea", { className: "message-bubble__edit-input", value: editValue, onChange: (e) => onEditValueChange(e.target.value), onKeyDown: (e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        onConfirmEdit();
                                    }
                                    if (e.key === "Escape")
                                        onCancelEdit();
                                } }), _jsxs("div", { className: "message-bubble__edit-actions", children: [_jsx("button", { className: "btn-sm btn-primary", onClick: onConfirmEdit, children: "Save" }), _jsx("button", { className: "btn-sm", onClick: onCancelEdit, children: "Cancel" })] })] })) : (_jsxs("div", { className: "message-bubble__content", children: [_jsx("p", { children: message.content }), message.editedUtc && _jsx("span", { className: "message-bubble__edited", children: "(edited)" })] })), Object.keys(message.reactionSummary ?? {}).length > 0 && (_jsx("div", { className: "message-bubble__reactions", children: Object.entries(message.reactionSummary).map(([emoji, userIds]) => (_jsxs("button", { className: `reaction-chip ${userIds.includes(userId) ? "active" : ""}`, onClick: () => userIds.includes(userId) ? onUnreact(emoji) : onReact(emoji), children: [emoji, " ", userIds.length] }, emoji))) })), _jsx("div", { className: "message-bubble__time", children: new Date(message.createdUtc).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit"
                        }) })] }), _jsxs("div", { className: "message-bubble__actions", children: [quickReactions.map((emoji) => (_jsx("button", { className: "action-btn", onClick: () => onReact(emoji), title: `React ${emoji}`, children: emoji }, emoji))), isMine && (_jsxs(_Fragment, { children: [_jsx("button", { className: "action-btn", onClick: onStartEdit, title: "Edit", children: "\u270F\uFE0F" }), _jsx("button", { className: "action-btn", onClick: onDelete, title: "Delete", children: "\uD83D\uDDD1\uFE0F" })] }))] })] }));
}
