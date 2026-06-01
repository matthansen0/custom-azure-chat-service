import type { Room } from "../types.js";
import { ChatListItem } from "./ChatListItem.js";

interface ChatListProps {
  rooms: Room[];
  activeRoomId: string;
  userId: string;
  onSelectRoom: (roomId: string) => void;
  onNewChat: () => void;
}

export function ChatList({ rooms, activeRoomId, userId, onSelectRoom, onNewChat }: ChatListProps) {
  const pinned = rooms.filter((r) => r.pinnedByUserIds?.includes(userId));
  const unpinned = rooms.filter((r) => !r.pinnedByUserIds?.includes(userId));

  return (
    <div className="chat-list">
      <div className="chat-list__header">
        <h2 className="chat-list__title">Chat</h2>
        <button className="chat-list__new-btn" onClick={onNewChat} title="New chat">
          ✏️
        </button>
      </div>

      <div className="chat-list__search">
        <input type="text" placeholder="Search conversations..." className="chat-list__search-input" readOnly />
      </div>

      <div className="chat-list__items">
        {pinned.length > 0 && (
          <>
            <div className="chat-list__section-label">Pinned</div>
            {pinned.map((room) => (
              <ChatListItem
                key={room.id}
                room={room}
                userId={userId}
                isActive={room.id === activeRoomId}
                onSelect={() => onSelectRoom(room.id)}
              />
            ))}
          </>
        )}

        {unpinned.length > 0 && (
          <>
            {pinned.length > 0 && <div className="chat-list__section-label">Recent</div>}
            {unpinned.map((room) => (
              <ChatListItem
                key={room.id}
                room={room}
                userId={userId}
                isActive={room.id === activeRoomId}
                onSelect={() => onSelectRoom(room.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
