import type { Room } from "../types.js";
import type { MentionFeedEntry } from "../hooks/useChat.js";

interface ActivityViewProps {
  rooms: Room[];
  userId: string;
  onSelectRoom: (roomId: string) => void;
  mentions: MentionFeedEntry[];
  onClearMentions: () => void;
}

export function ActivityView({ rooms, userId, onSelectRoom, mentions, onClearMentions }: ActivityViewProps) {
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

  return (
    <div className="activity-view">
      <div className="activity-view__header">
        <h2 className="activity-view__title">Activity</h2>
        {mentions.length > 0 && (
          <button className="activity-view__clear" onClick={onClearMentions} title="Clear mentions">
            Clear
          </button>
        )}
      </div>
      <div className="activity-view__content">
        {mentions.length > 0 && (
          <div className="activity-view__section">
            <div className="activity-view__section-label">Mentions & Replies</div>
            {mentions.map((entry) => {
              const isReply = entry.kind === "reply";
              return (
                <button
                  key={entry.id}
                  className={`activity-view__item activity-view__item--mention ${entry.priority === "urgent" ? "activity-view__item--urgent" : ""}`}
                  onClick={() => onSelectRoom(entry.roomId)}
                >
                  <div className="activity-view__item-avatar activity-view__item-avatar--mention">
                    {isReply ? "↩" : "@"}
                  </div>
                  <div className="activity-view__item-content">
                    <div className="activity-view__item-name">
                      {entry.roomName}
                      <span className="activity-view__mention-tag">
                        {" "}{isReply ? "replied to you" : entry.everyone ? "@everyone" : "mentioned you"}
                      </span>
                      {entry.priority === "urgent" && <span className="activity-view__mention-tag activity-view__mention-tag--urgent"> 🚨 Emergency</span>}
                    </div>
                    {isReply && entry.replyToContent && (
                      <div className="activity-view__item-reply-quote">
                        “{entry.replyToContent.length > 60 ? `${entry.replyToContent.slice(0, 60)}…` : entry.replyToContent}”
                      </div>
                    )}
                    <div className="activity-view__item-preview">
                      {entry.content.length > 80 ? `${entry.content.slice(0, 80)}…` : entry.content}
                    </div>
                  </div>
                  <div className="activity-view__item-time">{formatRelativeTime(entry.occurredUtc)}</div>
                </button>
              );
            })}
          </div>
        )}

        {roomsWithUnread.length > 0 && (
          <div className="activity-view__section">
            <div className="activity-view__section-label">Unread</div>
            {roomsWithUnread.map((room) => {
              const unread = room.summary?.unreadCountByUser?.[userId] ?? 0;
              return (
                <button
                  key={room.id}
                  className="activity-view__item"
                  onClick={() => onSelectRoom(room.id)}
                >
                  <div className="activity-view__item-avatar">
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="activity-view__item-content">
                    <div className="activity-view__item-name">{room.name}</div>
                    <div className="activity-view__item-preview">
                      {room.summary?.lastMessagePreview ?? "New activity"}
                    </div>
                  </div>
                  <div className="activity-view__item-badge">{unread}</div>
                </button>
              );
            })}
          </div>
        )}

        <div className="activity-view__section">
          <div className="activity-view__section-label">Recent</div>
          {recentRooms.length > 0 ? (
            recentRooms.map((room) => (
              <button
                key={room.id}
                className="activity-view__item"
                onClick={() => onSelectRoom(room.id)}
              >
                <div className="activity-view__item-avatar">
                  {room.name.charAt(0).toUpperCase()}
                </div>
                <div className="activity-view__item-content">
                  <div className="activity-view__item-name">{room.name}</div>
                  <div className="activity-view__item-preview">
                    {room.summary?.lastMessagePreview ?? "No messages"}
                  </div>
                </div>
                {room.summary?.lastActivityUtc && (
                  <div className="activity-view__item-time">
                    {formatRelativeTime(room.summary.lastActivityUtc)}
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="activity-view__empty">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
