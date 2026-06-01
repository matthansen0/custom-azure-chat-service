import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ActivityView({ rooms, userId, onSelectRoom, mentions, onClearMentions }) {
    const roomsWithUnread = rooms
        .filter((r) => (r.summary?.unreadCountByUser?.[userId] ?? 0) > 0)
        .sort((a, b) => {
        const aTime = a.summary?.lastActivityUtc ?? a.createdUtc;
        const bTime = b.summary?.lastActivityUtc ?? b.createdUtc;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    const recentRooms = rooms
        .filter((r) => r.summary?.lastActivityUtc)
        .sort((a, b) => {
        const aTime = a.summary?.lastActivityUtc ?? "";
        const bTime = b.summary?.lastActivityUtc ?? "";
        return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
        .slice(0, 10);
    return (_jsxs("div", { className: "activity-view", children: [_jsxs("div", { className: "activity-view__header", children: [_jsx("h2", { className: "activity-view__title", children: "Activity" }), mentions.length > 0 && (_jsx("button", { className: "activity-view__clear", onClick: onClearMentions, title: "Clear mentions", children: "Clear" }))] }), _jsxs("div", { className: "activity-view__content", children: [mentions.length > 0 && (_jsxs("div", { className: "activity-view__section", children: [_jsx("div", { className: "activity-view__section-label", children: "Mentions & Replies" }), mentions.map((entry) => {
                                const isReply = entry.kind === "reply";
                                return (_jsxs("button", { className: `activity-view__item activity-view__item--mention ${entry.priority === "urgent" ? "activity-view__item--urgent" : ""}`, onClick: () => onSelectRoom(entry.roomId), children: [_jsx("div", { className: "activity-view__item-avatar activity-view__item-avatar--mention", children: isReply ? "↩" : "@" }), _jsxs("div", { className: "activity-view__item-content", children: [_jsxs("div", { className: "activity-view__item-name", children: [entry.roomName, _jsxs("span", { className: "activity-view__mention-tag", children: [" ", isReply ? "replied to you" : entry.everyone ? "@everyone" : "mentioned you"] }), entry.priority === "urgent" && _jsx("span", { className: "activity-view__mention-tag activity-view__mention-tag--urgent", children: " \uD83D\uDEA8 Emergency" })] }), isReply && entry.replyToContent && (_jsxs("div", { className: "activity-view__item-reply-quote", children: ["\u201C", entry.replyToContent.length > 60 ? `${entry.replyToContent.slice(0, 60)}…` : entry.replyToContent, "\u201D"] })), _jsx("div", { className: "activity-view__item-preview", children: entry.content.length > 80 ? `${entry.content.slice(0, 80)}…` : entry.content })] }), _jsx("div", { className: "activity-view__item-time", children: formatRelativeTime(entry.occurredUtc) })] }, entry.id));
                            })] })), roomsWithUnread.length > 0 && (_jsxs("div", { className: "activity-view__section", children: [_jsx("div", { className: "activity-view__section-label", children: "Unread" }), roomsWithUnread.map((room) => {
                                const unread = room.summary?.unreadCountByUser?.[userId] ?? 0;
                                return (_jsxs("button", { className: "activity-view__item", onClick: () => onSelectRoom(room.id), children: [_jsx("div", { className: "activity-view__item-avatar", children: room.name.charAt(0).toUpperCase() }), _jsxs("div", { className: "activity-view__item-content", children: [_jsx("div", { className: "activity-view__item-name", children: room.name }), _jsx("div", { className: "activity-view__item-preview", children: room.summary?.lastMessagePreview ?? "New activity" })] }), _jsx("div", { className: "activity-view__item-badge", children: unread })] }, room.id));
                            })] })), _jsxs("div", { className: "activity-view__section", children: [_jsx("div", { className: "activity-view__section-label", children: "Recent" }), recentRooms.length > 0 ? (recentRooms.map((room) => (_jsxs("button", { className: "activity-view__item", onClick: () => onSelectRoom(room.id), children: [_jsx("div", { className: "activity-view__item-avatar", children: room.name.charAt(0).toUpperCase() }), _jsxs("div", { className: "activity-view__item-content", children: [_jsx("div", { className: "activity-view__item-name", children: room.name }), _jsx("div", { className: "activity-view__item-preview", children: room.summary?.lastMessagePreview ?? "No messages" })] }), room.summary?.lastActivityUtc && (_jsx("div", { className: "activity-view__item-time", children: formatRelativeTime(room.summary.lastActivityUtc) }))] }, room.id)))) : (_jsx("div", { className: "activity-view__empty", children: "No recent activity" }))] })] })] }));
}
function formatRelativeTime(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1)
        return "Just now";
    if (minutes < 60)
        return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}
