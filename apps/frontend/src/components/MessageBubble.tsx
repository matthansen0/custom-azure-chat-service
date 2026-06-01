import type { Message } from "../types.js";

const quickReactions = ["👍", "❤️", "😂", "😮", "😢"];

interface MessageBubbleProps {
  message: Message;
  userId: string;
  senderName: string;
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onReact: (reaction: string) => void;
  onUnreact: (reaction: string) => void;
}

export function MessageBubble({
  message,
  userId,
  senderName,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onDelete,
  onReact,
  onUnreact
}: MessageBubbleProps) {
  const isMine = message.senderId === userId;
  const isDeleted = message.deleted;

  if (isDeleted) {
    return (
      <div className="message-bubble deleted">
        <span className="message-bubble__deleted-text">This message has been deleted</span>
      </div>
    );
  }

  return (
    <div className={`message-bubble ${isMine ? "mine" : ""}`}>
      {!isMine && (
        <div className="message-bubble__avatar">
          <span>{senderName.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="message-bubble__body">
        {!isMine && <div className="message-bubble__sender">{senderName}</div>}

        {isEditing ? (
          <div className="message-bubble__edit">
            <textarea
              className="message-bubble__edit-input"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onConfirmEdit();
                }
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <div className="message-bubble__edit-actions">
              <button className="btn-sm btn-primary" onClick={onConfirmEdit}>Save</button>
              <button className="btn-sm" onClick={onCancelEdit}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="message-bubble__content">
            <p>{message.content}</p>
            {message.editedUtc && <span className="message-bubble__edited">(edited)</span>}
          </div>
        )}

        {/* Reactions */}
        {Object.keys(message.reactionSummary ?? {}).length > 0 && (
          <div className="message-bubble__reactions">
            {Object.entries(message.reactionSummary).map(([emoji, userIds]) => (
              <button
                key={emoji}
                className={`reaction-chip ${userIds.includes(userId) ? "active" : ""}`}
                onClick={() =>
                  userIds.includes(userId) ? onUnreact(emoji) : onReact(emoji)
                }
              >
                {emoji} {userIds.length}
              </button>
            ))}
          </div>
        )}

        <div className="message-bubble__time">
          {new Date(message.createdUtc).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
          })}
        </div>
      </div>

      {/* Hover actions */}
      <div className="message-bubble__actions">
        {quickReactions.map((emoji) => (
          <button key={emoji} className="action-btn" onClick={() => onReact(emoji)} title={`React ${emoji}`}>
            {emoji}
          </button>
        ))}
        {isMine && (
          <>
            <button className="action-btn" onClick={onStartEdit} title="Edit">✏️</button>
            <button className="action-btn" onClick={onDelete} title="Delete">🗑️</button>
          </>
        )}
      </div>
    </div>
  );
}
