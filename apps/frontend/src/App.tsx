import { useEffect, useMemo, useRef, useState } from "react";
import {
  addReaction,
  demoLogin,
  getMembers,
  getMessages,
  getRooms,
  markRead,
  removeReaction,
  searchInRoom,
  sendMessage,
  setPin,
  setTyping
} from "./api.js";
import { connectRealtime, type ConnectionStatus } from "./realtime.js";
import type { EventEnvelope, Message, Room, User } from "./types.js";

const users = [
  { id: "u1", label: "Alex" },
  { id: "u2", label: "Jordan" },
  { id: "u3", label: "Sam" }
];

function randomClientMessageId() {
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function App() {
  const queryUser = new URLSearchParams(window.location.search).get("user") ?? "u1";
  const [userId, setUserId] = useState(queryUser);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [typingByUser, setTypingByUser] = useState<Record<string, number>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const disconnectRef = useRef<null | (() => Promise<void>)>(null);

  const activeRoom = useMemo(() => rooms.find((value) => value.id === activeRoomId), [rooms, activeRoomId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("user", userId);
    window.history.replaceState(null, "", url);
  }, [userId]);

  useEffect(() => {
    void (async () => {
      await demoLogin(userId);
      const nextRooms = await getRooms(userId);
      setRooms(nextRooms);
      const firstRoomId = nextRooms[0]?.id ?? "";
      setActiveRoomId(firstRoomId);
    })();
  }, [userId]);

  useEffect(() => {
    if (!activeRoomId) {
      return;
    }
    void (async () => {
      const [nextMessages, nextMembers] = await Promise.all([
        getMessages(userId, activeRoomId),
        getMembers(userId, activeRoomId)
      ]);
      setMessages(nextMessages);
      setMembers(nextMembers);

      if (disconnectRef.current) {
        await disconnectRef.current();
      }

      disconnectRef.current = await connectRealtime({
        userId,
        roomId: activeRoomId,
        onStatus: setConnectionStatus,
        onEvent: (event: EventEnvelope) => {
          handleRealtimeEvent(event);
        }
      });
    })();

    return () => {
      if (disconnectRef.current) {
        void disconnectRef.current();
        disconnectRef.current = null;
      }
    };
  }, [userId, activeRoomId]);

  function handleRealtimeEvent(event: EventEnvelope) {
    if (event.roomId && event.roomId !== activeRoomId) {
      void refreshRooms();
      return;
    }

    switch (event.eventType) {
      case "MessageCreated": {
        const payload = event.payload as { messageId: string; content: string; clientMessageId?: string };
        setMessages((current) => {
          const optimisticIndex = current.findIndex((value) => value.clientMessageId === payload.clientMessageId);
          const created: Message = {
            id: payload.messageId,
            roomId: event.roomId ?? activeRoomId,
            senderId: event.actorUserId,
            content: payload.content,
            createdUtc: event.occurredUtc,
            deleted: false,
            reactionSummary: {},
            readByUserIds: [event.actorUserId],
            sequenceNumber: event.sequenceNumber ?? 0,
            clientMessageId: payload.clientMessageId
          };
          if (optimisticIndex >= 0) {
            const next = [...current];
            next[optimisticIndex] = created;
            return next;
          }
          return [...current, created].sort((left, right) => left.sequenceNumber - right.sequenceNumber);
        });
        break;
      }
      case "MessageRead": {
        const payload = event.payload as { messageId: string };
        setMessages((current) =>
          current.map((value) =>
            value.id === payload.messageId && !value.readByUserIds.includes(event.actorUserId)
              ? { ...value, readByUserIds: [...value.readByUserIds, event.actorUserId] }
              : value
          )
        );
        break;
      }
      case "ReactionAdded":
      case "ReactionRemoved": {
        const payload = event.payload as { messageId: string; reaction: string };
        setMessages((current) =>
          current.map((value) => {
            if (value.id !== payload.messageId) {
              return value;
            }
            const usersByReaction = new Set(value.reactionSummary[payload.reaction] ?? []);
            if (event.eventType === "ReactionAdded") {
              usersByReaction.add(event.actorUserId);
            } else {
              usersByReaction.delete(event.actorUserId);
            }
            return {
              ...value,
              reactionSummary: {
                ...value.reactionSummary,
                [payload.reaction]: Array.from(usersByReaction)
              }
            };
          })
        );
        break;
      }
      case "TypingStarted": {
        setTypingByUser((current) => ({ ...current, [event.actorUserId]: Date.now() + 6000 }));
        break;
      }
      case "TypingStopped": {
        setTypingByUser((current) => {
          const next = { ...current };
          delete next[event.actorUserId];
          return next;
        });
        break;
      }
      case "RoomPinnedToggled": {
        void refreshRooms();
        break;
      }
      default:
        break;
    }
  }

  async function refreshRooms() {
    const nextRooms = await getRooms(userId);
    setRooms(nextRooms);
  }

  async function onSend() {
    if (!activeRoomId || !composerValue.trim()) {
      return;
    }

    const clientMessageId = randomClientMessageId();
    const optimisticMessage: Message = {
      id: clientMessageId,
      roomId: activeRoomId,
      senderId: userId,
      content: composerValue,
      createdUtc: new Date().toISOString(),
      deleted: false,
      reactionSummary: {},
      readByUserIds: [userId],
      sequenceNumber: Number.MAX_SAFE_INTEGER,
      clientMessageId
    };

    setMessages((current) => [...current, optimisticMessage]);
    const text = composerValue;
    setComposerValue("");
    await sendMessage(userId, activeRoomId, text, clientMessageId);
    await setTyping(userId, activeRoomId, false);
  }

  async function onSearch(query: string) {
    if (!activeRoomId) {
      return;
    }
    setSearchValue(query);
    if (!query.trim()) {
      const nextMessages = await getMessages(userId, activeRoomId);
      setMessages(nextMessages);
      return;
    }
    const nextMessages = await searchInRoom(userId, activeRoomId, query);
    setMessages(nextMessages);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingByUser((current) => {
        const next: Record<string, number> = {};
        for (const [key, expires] of Object.entries(current)) {
          if (expires > now) {
            next[key] = expires;
          }
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const typingUsers = Object.keys(typingByUser).filter((id) => id !== userId);

  return (
    <div className="layout">
      <aside className="roomsRail">
        <div className="sectionTitle">Users</div>
        <select value={userId} onChange={(event) => setUserId(event.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>

        <div className="sectionTitle">Rooms</div>
        {rooms.map((room) => {
          const unread = room.summary.unreadCountByUser[userId] ?? 0;
          const isPinned = room.pinnedByUserIds.includes(userId);
          return (
            <button
              key={room.id}
              className={`roomItem ${room.id === activeRoomId ? "active" : ""}`}
              onClick={() => setActiveRoomId(room.id)}
            >
              <span>{room.name}</span>
              <span className="meta">{isPinned ? "Pinned" : ""} {unread > 0 ? `Unread ${unread}` : ""}</span>
            </button>
          );
        })}
      </aside>

      <main className="conversationPane">
        <header className="conversationHeader">
          <div>
            <h1>{activeRoom?.name ?? "No room"}</h1>
            <div className={`status ${connectionStatus}`}>Connection: {connectionStatus}</div>
          </div>
          {activeRoom ? (
            <button
              onClick={() => {
                const pinned = !activeRoom.pinnedByUserIds.includes(userId);
                void setPin(userId, activeRoom.id, pinned).then(refreshRooms);
              }}
            >
              {activeRoom.pinnedByUserIds.includes(userId) ? "Unpin" : "Pin"}
            </button>
          ) : null}
        </header>

        <div className="searchRow">
          <input
            value={searchValue}
            placeholder="Search current room"
            onChange={(event) => {
              void onSearch(event.target.value);
            }}
          />
        </div>

        <section className="messageList">
          {messages.map((message) => (
            <article key={message.id} className={`message ${message.senderId === userId ? "mine" : ""}`}>
              <div className="messageTop">
                <strong>{message.senderId}</strong>
                <span>{new Date(message.createdUtc).toLocaleTimeString()}</span>
              </div>
              <p>{message.content}</p>
              <div className="messageActions">
                <button
                  onClick={() => {
                    void addReaction(userId, message.roomId, message.id, "thumbsUp");
                  }}
                >
                  +1 ({message.reactionSummary.thumbsUp?.length ?? 0})
                </button>
                <button
                  onClick={() => {
                    void addReaction(userId, message.roomId, message.id, "heart");
                  }}
                >
                  Heart ({message.reactionSummary.heart?.length ?? 0})
                </button>
                <button
                  onClick={() => {
                    void removeReaction(userId, message.roomId, message.id, "thumbsUp");
                  }}
                >
                  Remove +1
                </button>
                <button
                  onClick={() => {
                    void markRead(userId, message.roomId, message.id);
                  }}
                >
                  Mark Read ({message.readByUserIds.length})
                </button>
              </div>
            </article>
          ))}
        </section>

        <footer className="composer">
          <div className="typingIndicator">
            {typingUsers.length > 0 ? `${typingUsers.join(", ")} typing...` : ""}
          </div>
          <textarea
            value={composerValue}
            onChange={(event) => {
              const next = event.target.value;
              setComposerValue(next);
              if (activeRoomId) {
                void setTyping(userId, activeRoomId, next.length > 0);
              }
            }}
            placeholder="Write a message"
          />
          <button onClick={() => void onSend()}>Send</button>
        </footer>
      </main>

      <aside className="membersPane">
        <div className="sectionTitle">Members</div>
        {members.map((member) => (
          <div key={member.id} className="memberRow">
            <span>{member.displayName}</span>
            <span className={`presence ${member.presence}`}>{member.presence}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}
