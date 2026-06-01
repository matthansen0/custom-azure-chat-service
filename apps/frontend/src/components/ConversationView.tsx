import { useEffect, useRef, useState } from "react";
import type { Message, User } from "../types.js";
import { Composer } from "./Composer.js";
import { MessageBubble } from "./MessageBubble.js";

interface ConversationViewProps {
  roomName: string;
  roomType: string;
  messages: Message[];
  members: User[];
  userId: string;
  typingUsers: string[];
  onSend: (content: string) => Promise<void>;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, reaction: string) => Promise<void>;
  onUnreact: (messageId: string, reaction: string) => Promise<void>;
  onTyping: () => Promise<void>;
  onToggleMembers: () => void;
  showMembers: boolean;
}

export function ConversationView({
  roomName,
  roomType,
  messages,
  members,
  userId,
  typingUsers,
  onSend,
  onEdit,
  onDelete,
  onReact,
  onUnreact,
  onTyping,
  onToggleMembers,
  showMembers
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.displayName ?? id;

  const startEdit = (msg: Message) => {
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

  return (
    <div className="conversation">
      <div className="conversation__header">
        <div className="conversation__header-left">
          <h2 className="conversation__title">{roomName}</h2>
          <span className="conversation__subtitle">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="conversation__header-actions">
          <button
            className={`header-btn ${showMembers ? "active" : ""}`}
            onClick={onToggleMembers}
            title="Toggle members panel"
          >
            👥
          </button>
        </div>
      </div>

      <div className="conversation__messages" ref={scrollRef}>
        {groupedMessages.map(({ date, msgs }) => (
          <div key={date} className="message-group">
            <div className="message-group__date">
              <span>{date}</span>
            </div>
            {msgs.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                userId={userId}
                senderName={getMemberName(msg.senderId)}
                isEditing={editingId === msg.id}
                editValue={editValue}
                onEditValueChange={setEditValue}
                onStartEdit={() => startEdit(msg)}
                onConfirmEdit={confirmEdit}
                onCancelEdit={cancelEdit}
                onDelete={() => onDelete(msg.id)}
                onReact={(reaction) => onReact(msg.id, reaction)}
                onUnreact={(reaction) => onUnreact(msg.id, reaction)}
              />
            ))}
          </div>
        ))}
      </div>

      {typingUsers.length > 0 && (
        <div className="conversation__typing">
          {typingUsers.map((u) => getMemberName(u)).join(", ")}{" "}
          {typingUsers.length === 1 ? "is" : "are"} typing...
        </div>
      )}

      <Composer onSend={onSend} onTyping={onTyping} />
    </div>
  );
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; msgs: Message[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const date = formatDate(msg.createdUtc);
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, msgs: [msg] });
    } else {
      groups[groups.length - 1].msgs.push(msg);
    }
  }

  return groups;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}
