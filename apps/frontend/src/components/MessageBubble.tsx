import { useEffect, useRef, type ReactNode } from "react";
import type { Message, User } from "../types.js";

const quickReactions = ["👍", "❤️", "😂", "😮", "😢"];

interface MessageBubbleProps {
  message: Message;
  userId: string;
  senderName: string;
  members: User[];
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onReact: (reaction: string) => void;
  onUnreact: (reaction: string) => void;
  onReply: () => void;
  onVisible?: (messageId: string) => void;
}

export function MessageBubble({
  message,
  userId,
  senderName,
  members,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onDelete,
  onReact,
  onUnreact,
  onReply,
  onVisible
}: MessageBubbleProps) {
  const isMine = message.senderId === userId;
  const isDeleted = message.deleted;
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onVisible || isMine || isDeleted) return;
    if (message.readByUserIds?.includes(userId)) return;
    const node = bubbleRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // Fallback: optimistically mark on mount.
      onVisible(message.id);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onVisible(message.id);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [message.id, message.readByUserIds, isMine, isDeleted, onVisible, userId]);

  if (isDeleted) {
    return (
      <div className="message-bubble deleted" ref={bubbleRef}>
        <span className="message-bubble__deleted-text">This message has been deleted</span>
      </div>
    );
  }

  // Read receipt — show on own messages only (Teams-style: who has seen this).
  const otherReaders = isMine
    ? (message.readByUserIds ?? []).filter((id) => id !== userId)
    : [];

  const metadata = (message.metadata ?? {}) as {
    mentions?: string[];
    mentionEveryone?: boolean;
    replyTo?: { messageId: string; senderId: string; content: string };
  };
  const mentionedUserIds = Array.isArray(metadata.mentions) ? metadata.mentions : [];
  const mentionEveryone = Boolean(metadata.mentionEveryone);
  const mentionsMe = mentionedUserIds.includes(userId) || mentionEveryone;
  const isUrgent = message.priority === "urgent";
  const replyTo = metadata.replyTo;
  const replyToSenderName = replyTo
    ? members.find((m) => m.id === replyTo.senderId)?.displayName ?? "someone"
    : null;

  return (
    <div
      className={`message-bubble ${isMine ? "mine" : ""} ${mentionsMe && !isMine ? "mentioned" : ""} ${isUrgent ? "urgent" : ""}`}
      ref={bubbleRef}
    >
      {!isMine && (
        <div className="message-bubble__avatar">
          <span>{senderName.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="message-bubble__body">
        {!isMine && <div className="message-bubble__sender">{senderName}</div>}
        {isUrgent && (
          <div className="message-bubble__urgent-badge" title="Emergency message">
            🚨 Emergency
          </div>
        )}
        {replyTo && (
          <div className="message-bubble__reply-quote">
            <div className="message-bubble__reply-bar" />
            <div className="message-bubble__reply-body">
              <div className="message-bubble__reply-author">{replyToSenderName}</div>
              <div className="message-bubble__reply-preview">
                {replyTo.content
                  ? replyTo.content.length > 140
                    ? `${replyTo.content.slice(0, 140)}…`
                    : replyTo.content
                  : "Original message unavailable"}
              </div>
            </div>
          </div>
        )}

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
            <p>{renderContentWithMentions(message.content, members, userId)}</p>
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
          {isMine && (
            <span
              className={`message-bubble__receipt ${otherReaders.length > 0 ? "seen" : "sent"}`}
              title={
                otherReaders.length > 0
                  ? `Seen by ${otherReaders
                      .map((id) => members.find((m) => m.id === id)?.displayName ?? id)
                      .join(", ")}`
                  : "Sent"
              }
            >
              {otherReaders.length > 0 ? `✓✓ Seen${otherReaders.length > 1 ? ` · ${otherReaders.length}` : ""}` : "✓ Sent"}
            </span>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="message-bubble__actions">
        {quickReactions.map((emoji) => (
          <button key={emoji} className="action-btn" onClick={() => onReact(emoji)} title={`React ${emoji}`}>
            {emoji}
          </button>
        ))}
        <button className="action-btn" onClick={onReply} title="Reply">↩️</button>
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

function renderContentWithMentions(content: string, members: User[], currentUserId: string) {
  const memberNames = members.map((m) => m.displayName);
  // Match @everyone or @<display name> (greedy up to two words to support spaces).
  const pattern = /@(everyone|[A-Za-z0-9_][A-Za-z0-9_ .-]{0,40}?)(?=$|[\s,.;:!?])/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1];
    // Try to greedily match the longest known display name starting at this position.
    let token = raw;
    let resolvedId: string | null = null;
    let isEveryone = false;
    if (raw.toLowerCase() === "everyone") {
      isEveryone = true;
    } else {
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
    parts.push(
      <span
        key={`m-${key++}`}
        className={`mention-chip ${mentionsMe ? "mention-chip--me" : ""} ${isEveryone ? "mention-chip--everyone" : ""}`}
      >
        @{token}
      </span>
    );
    lastIndex = start + 1 + token.length;
    pattern.lastIndex = lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts.length > 0 ? parts : content;
}
