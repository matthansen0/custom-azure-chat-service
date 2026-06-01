import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ChatListItem({ room, userId, isActive, onSelect }) {
    const unreadCount = room.summary?.unreadCountByUser?.[userId] ?? 0;
    const preview = room.summary?.lastMessagePreview ?? "";
    const isPinned = room.pinnedByUserIds?.includes(userId);
    const initial = room.name.charAt(0).toUpperCase();
    const typeIcon = room.type === "direct" ? null : room.type === "group" ? "👥" : "📢";
    return (_jsxs("button", { className: `chat-item ${isActive ? "active" : ""}`, onClick: onSelect, children: [_jsx("div", { className: "chat-item__avatar", children: _jsx("span", { className: "chat-item__avatar-text", children: initial }) }), _jsxs("div", { className: "chat-item__content", children: [_jsxs("div", { className: "chat-item__top-row", children: [_jsxs("span", { className: "chat-item__name", children: [typeIcon && _jsx("span", { className: "chat-item__type-icon", children: typeIcon }), room.name, isPinned && _jsx("span", { className: "chat-item__pin", children: "\uD83D\uDCCC" })] }), room.summary?.lastActivityUtc && (_jsx("span", { className: "chat-item__time", children: formatTime(room.summary.lastActivityUtc) }))] }), _jsxs("div", { className: "chat-item__bottom-row", children: [_jsx("span", { className: "chat-item__preview", children: preview || "No messages yet" }), unreadCount > 0 && _jsx("span", { className: "chat-item__badge", children: unreadCount })] })] })] }));
}
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (diffDays === 1)
        return "Yesterday";
    if (diffDays < 7)
        return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
