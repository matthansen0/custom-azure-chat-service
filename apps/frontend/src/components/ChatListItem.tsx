import type { Room } from "../types.js";

interface ChatListItemProps {
  room: Room;
  userId: string;
  isActive: boolean;
  onSelect: () => void;
}

export function ChatListItem({ room, userId, isActive, onSelect }: ChatListItemProps) {
  const unreadCount = room.summary?.unreadCountByUser?.[userId] ?? 0;
  const preview = room.summary?.lastMessagePreview ?? "";
  const isPinned = room.pinnedByUserIds?.includes(userId);
  const initial = room.name.charAt(0).toUpperCase();

  const typeIcon = room.type === "direct" ? null : room.type === "group" ? "👥" : "📢";

  return (
    <button className={`chat-item ${isActive ? "active" : ""}`} onClick={onSelect}>
      <div className="chat-item__avatar">
        <span className="chat-item__avatar-text">{initial}</span>
      </div>
      <div className="chat-item__content">
        <div className="chat-item__top-row">
          <span className="chat-item__name">
            {typeIcon && <span className="chat-item__type-icon">{typeIcon}</span>}
            {room.name}
            {isPinned && <span className="chat-item__pin">📌</span>}
          </span>
          {room.summary?.lastActivityUtc && (
            <span className="chat-item__time">
              {formatTime(room.summary.lastActivityUtc)}
            </span>
          )}
        </div>
        <div className="chat-item__bottom-row">
          <span className="chat-item__preview">{preview || "No messages yet"}</span>
          {unreadCount > 0 && <span className="chat-item__badge">{unreadCount}</span>}
        </div>
      </div>
    </button>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
