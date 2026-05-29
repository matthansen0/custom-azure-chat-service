import { useEffect, useMemo, useRef, useState } from "react";
import {
  addParticipants,
  addReaction,
  clearRoom,
  createRoom,
  createTemplate,
  deleteMessage,
  deleteRoom,
  deliverMessage,
  demoLogin,
  getAuditEvents,
  getDirectory,
  getMembers,
  getMessages,
  getRoomDetails,
  getRoomsWithFilters,
  getTemplates,
  leaveRoom,
  linkContext,
  markRead,
  removeParticipant,
  removeReaction,
  searchInRoom,
  sendMessage,
  setMessagePriority,
  setNotificationPreference,
  setPin,
  setThreadArchived,
  setThreadFollowUp,
  setThreadHidden,
  setThreadMarkUnread,
  setTyping,
  updateAssignmentMembership,
  updateMessage,
  updateTemplate
} from "./api.js";
import { connectRealtime, type ConnectionStatus } from "./realtime.js";
import type {
  AuditEvent,
  EventEnvelope,
  LinkedContext,
  Message,
  QuickMessageTemplate,
  Room,
  RoomDetails,
  User
} from "./types.js";

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
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<QuickMessageTemplate[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [showHiddenRooms, setShowHiddenRooms] = useState(false);
  const [showArchivedRooms, setShowArchivedRooms] = useState(false);
  const [createRoomName, setCreateRoomName] = useState("");
  const [createRoomType, setCreateRoomType] = useState<Room["type"]>("group");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageValue, setEditingMessageValue] = useState("");
  const [templateDraft, setTemplateDraft] = useState<{
    id?: string;
    title: string;
    body: string;
    scopeType: QuickMessageTemplate["scopeType"];
    scopeId: string;
    active: boolean;
  }>({
    title: "",
    body: "",
    scopeType: "team",
    scopeId: "alpha",
    active: true
  });
  const [contextDraft, setContextDraft] = useState<LinkedContext>({
    type: "case",
    contextId: "",
    label: "",
    metadata: {}
  });
  const [directoryFilters, setDirectoryFilters] = useState({
    query: "",
    role: "",
    team: "",
    location: "",
    shift: ""
  });
  const [typingByUser, setTypingByUser] = useState<Record<string, number>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const disconnectRef = useRef<null | (() => Promise<void>)>(null);
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const pendingDeliveryIdsRef = useRef<Set<string>>(new Set());

  const activeRoom = useMemo(() => rooms.find((value) => value.id === activeRoomId), [rooms, activeRoomId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("user", userId);
    window.history.replaceState(null, "", url);
  }, [userId]);

  async function refreshRooms(nextActiveRoomId?: string) {
    const nextRooms = await getRoomsWithFilters(userId, {
      includeArchived: showArchivedRooms,
      includeHidden: showHiddenRooms
    });
    setRooms(nextRooms);
    const targetRoomId = nextActiveRoomId ?? activeRoomId;
    if (!targetRoomId || !nextRooms.some((room) => room.id === targetRoomId)) {
      setActiveRoomId(nextRooms[0]?.id ?? "");
      return;
    }
    setActiveRoomId(targetRoomId);
  }

  async function refreshActiveRoomData(roomId = activeRoomId) {
    if (!roomId) {
      setMessages([]);
      setMembers([]);
      setRoomDetails(null);
      setAuditEvents([]);
      return;
    }

    const [nextMessages, nextMembers, nextRoomDetails, nextAuditEvents, nextTemplates] = await Promise.all([
      searchValue.trim() ? searchInRoom(userId, roomId, searchValue) : getMessages(userId, roomId),
      getMembers(userId, roomId),
      getRoomDetails(userId, roomId),
      getAuditEvents(userId, { threadId: roomId }),
      getTemplates(userId)
    ]);

    setMessages(nextMessages);
    setMembers(nextMembers);
    setRoomDetails(nextRoomDetails);
    setAuditEvents(nextAuditEvents.slice(-12).reverse());
    setTemplates(nextTemplates);
    if (nextRoomDetails.linkedContext) {
      setContextDraft(nextRoomDetails.linkedContext);
    }
  }

  async function refreshDirectory() {
    await demoLogin(userId);
    const users = await getDirectory(userId, {
      query: directoryFilters.query || undefined,
      role: directoryFilters.role || undefined,
      team: directoryFilters.team || undefined,
      location: directoryFilters.location || undefined,
      shift: directoryFilters.shift || undefined
    });
    setDirectoryUsers(users);
  }

  useEffect(() => {
    void (async () => {
      await demoLogin(userId);
      await refreshRooms("");
      await refreshDirectory();
      const nextTemplates = await getTemplates(userId);
      setTemplates(nextTemplates);
    })();
  }, [userId, showArchivedRooms, showHiddenRooms]);

  useEffect(() => {
    if (!activeRoomId) {
      setRoomDetails(null);
      setMessages([]);
      setMembers([]);
      setAuditEvents([]);
      return;
    }
    void (async () => {
      await refreshActiveRoomData(activeRoomId);

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

  useEffect(() => {
    void refreshDirectory();
  }, [userId, directoryFilters.query, directoryFilters.role, directoryFilters.team, directoryFilters.location, directoryFilters.shift]);

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
            tenantId: event.tenantId,
            threadId: event.threadId ?? event.roomId ?? activeRoomId,
            roomId: event.roomId ?? activeRoomId,
            senderId: event.actorUserId,
            content: payload.content,
            contentType: "text/plain",
            metadata: {},
            priority: "normal",
            createdUtc: event.occurredUtc,
            deleted: false,
            reactionSummary: {},
            deliveredToUserIds: [event.actorUserId],
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
        void refreshRooms();
        break;
      }
      case "MessageEdited": {
        const payload = event.payload as { messageId: string; content: string };
        setMessages((current) =>
          current.map((value) =>
            value.id === payload.messageId
              ? { ...value, content: payload.content, editedUtc: event.occurredUtc }
              : value
          )
        );
        void refreshRooms();
        break;
      }
      case "MessageDeleted": {
        const payload = event.payload as { messageId: string };
        setMessages((current) =>
          current.map((value) =>
            value.id === payload.messageId ? { ...value, content: "Message deleted", deleted: true } : value
          )
        );
        void refreshRooms();
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
      case "MessageDelivered": {
        const payload = event.payload as { messageId: string };
        setMessages((current) =>
          current.map((value) =>
            value.id === payload.messageId && !(value.deliveredToUserIds ?? []).includes(event.actorUserId)
              ? { ...value, deliveredToUserIds: [...(value.deliveredToUserIds ?? []), event.actorUserId] }
              : value
          )
        );
        break;
      }
      case "MessagePrioritySet": {
        const payload = event.payload as { messageId: string; priority: string };
        setMessages((current) => current.map((value) => (value.id === payload.messageId ? { ...value, priority: payload.priority } : value)));
        void refreshRooms();
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
        void refreshActiveRoomData();
        break;
      }
      default:
        void refreshRooms();
        void refreshActiveRoomData();
        break;
    }
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
      deliveredToUserIds: [userId],
      readByUserIds: [userId],
      sequenceNumber: Number.MAX_SAFE_INTEGER,
      clientMessageId
    };

    setMessages((current) => [...current, optimisticMessage]);
    const text = composerValue;
    setComposerValue("");
    await sendMessage(userId, activeRoomId, text, clientMessageId);
    await setTyping(userId, activeRoomId, false);
    await refreshRooms(activeRoomId);
  }

  async function onSearch(query: string) {
    if (!activeRoomId) {
      return;
    }
    setSearchValue(query);
    if (!query.trim()) {
      await refreshActiveRoomData(activeRoomId);
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

  useEffect(() => {
    if (!activeRoomId) {
      return;
    }

    const unreadIncoming = messages.filter(
      (message) =>
        message.roomId === activeRoomId &&
        message.senderId !== userId &&
        !message.readByUserIds.includes(userId) &&
        !pendingReadIdsRef.current.has(message.id)
    );

    for (const message of unreadIncoming) {
      pendingReadIdsRef.current.add(message.id);
      void markRead(userId, activeRoomId, message.id).finally(() => {
        pendingReadIdsRef.current.delete(message.id);
      });
    }
  }, [activeRoomId, messages, userId]);

  useEffect(() => {
    if (!activeRoomId) {
      return;
    }

    const undeliveredIncoming = messages.filter(
      (message) =>
        message.roomId === activeRoomId &&
        message.senderId !== userId &&
        !(message.deliveredToUserIds ?? []).includes(userId) &&
        !pendingDeliveryIdsRef.current.has(message.id)
    );

    for (const message of undeliveredIncoming) {
      pendingDeliveryIdsRef.current.add(message.id);
      void deliverMessage(userId, activeRoomId, message.id).finally(() => {
        pendingDeliveryIdsRef.current.delete(message.id);
      });
    }
  }, [activeRoomId, messages, userId]);

  const typingUsers = Object.keys(typingByUser)
    .filter((id) => id !== userId)
    .map((id) => users.find((value) => value.id === id)?.label ?? id);

  const activeTemplate = templates.find((template) => template.id === templateDraft.id);

  async function handleCreateRoom() {
    if (!createRoomName.trim()) {
      return;
    }
    const roomId = await createRoom(userId, {
      name: createRoomName,
      type: createRoomType,
      participantIds: selectedRecipientIds,
      linkedContext: contextDraft.contextId ? contextDraft : undefined,
      metadata: { createdFrom: "pass3-ui" }
    });
    setCreateRoomName("");
    await refreshRooms(roomId);
  }

  async function handleSaveTemplate() {
    if (!templateDraft.title.trim() || !templateDraft.body.trim()) {
      return;
    }
    const payload = {
      scopeType: templateDraft.scopeType,
      scopeId: templateDraft.scopeId,
      title: templateDraft.title,
      body: templateDraft.body,
      active: templateDraft.active
    };
    if (templateDraft.id) {
      await updateTemplate(userId, templateDraft.id, payload);
    } else {
      await createTemplate(userId, payload);
    }
    setTemplateDraft({
      title: "",
      body: "",
      scopeType: "team",
      scopeId: "alpha",
      active: true
    });
    setTemplates(await getTemplates(userId));
  }

  async function handleRoomPreferenceUpdate(action: () => Promise<void>) {
    await action();
    await refreshRooms(activeRoomId);
    await refreshActiveRoomData(activeRoomId);
  }

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

        <label className="toggleRow">
          <input type="checkbox" checked={showArchivedRooms} onChange={(event) => setShowArchivedRooms(event.target.checked)} />
          <span>Show archived</span>
        </label>
        <label className="toggleRow">
          <input type="checkbox" checked={showHiddenRooms} onChange={(event) => setShowHiddenRooms(event.target.checked)} />
          <span>Show hidden</span>
        </label>

        <div className="sectionTitle">Create Room</div>
        <input value={createRoomName} placeholder="Room name" onChange={(event) => setCreateRoomName(event.target.value)} />
        <select value={createRoomType} onChange={(event) => setCreateRoomType(event.target.value as Room["type"])}>
          <option value="group">Group</option>
          <option value="direct">Direct</option>
          <option value="announcement">Announcement</option>
        </select>
        <div className="helperText">Selected recipients: {selectedRecipientIds.length}</div>
        <button onClick={() => void handleCreateRoom()}>Create room</button>

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
              <span className="meta">{isPinned ? "Pinned " : ""}{room.summary.linkedContext ? `${room.summary.linkedContext.label} ` : ""}{unread > 0 ? `Unread ${unread}` : ""}</span>
            </button>
          );
        })}
      </aside>

      <main className="conversationPane">
        <header className="conversationHeader">
          <div>
            <h1>{activeRoom?.name ?? "No room"}</h1>
            <div className={`status ${connectionStatus}`}>Connection: {connectionStatus}</div>
            {roomDetails?.linkedContext ? <div className="helperText">Context: {roomDetails.linkedContext.label}</div> : null}
          </div>
          {activeRoom ? (
            <div className="headerActions">
              <button onClick={() => void handleRoomPreferenceUpdate(() => setPin(userId, activeRoom.id, !activeRoom.pinnedByUserIds.includes(userId)))}>
                {activeRoom.pinnedByUserIds.includes(userId) ? "Unpin" : "Pin"}
              </button>
              <button onClick={() => void handleRoomPreferenceUpdate(() => setThreadArchived(userId, activeRoom.id, !roomDetails?.preference.archived))}>
                {roomDetails?.preference.archived ? "Unarchive" : "Archive"}
              </button>
              <button onClick={() => void handleRoomPreferenceUpdate(() => setThreadHidden(userId, activeRoom.id, !roomDetails?.preference.hidden))}>
                {roomDetails?.preference.hidden ? "Unhide" : "Hide"}
              </button>
              <button onClick={() => void handleRoomPreferenceUpdate(() => setThreadFollowUp(userId, activeRoom.id, !roomDetails?.preference.followUpFlag))}>
                {roomDetails?.preference.followUpFlag ? "Clear Follow-up" : "Follow-up"}
              </button>
              <button onClick={() => void handleRoomPreferenceUpdate(() => setThreadMarkUnread(userId, activeRoom.id, !roomDetails?.preference.markUnread))}>
                {roomDetails?.preference.markUnread ? "Clear Unread" : "Mark Unread"}
              </button>
              <button
                onClick={() =>
                  void handleRoomPreferenceUpdate(() =>
                    setNotificationPreference(userId, activeRoom.id, {
                      muted: !roomDetails?.notificationPreference.muted,
                      muteLowPriority: roomDetails?.notificationPreference.muteLowPriority ?? false,
                      allowPriorityOverride: roomDetails?.notificationPreference.allowPriorityOverride ?? true
                    })
                  )
                }
              >
                {roomDetails?.notificationPreference.muted ? "Unmute" : "Mute"}
              </button>
              <button onClick={() => void handleRoomPreferenceUpdate(() => clearRoom(userId, activeRoom.id))}>Clear</button>
              <button
                onClick={() => {
                  void leaveRoom(userId, activeRoom.id).then(async () => {
                    await refreshRooms();
                  });
                }}
              >
                Leave
              </button>
              <button
                onClick={() => {
                  void deleteRoom(userId, activeRoom.id).then(async () => {
                    await refreshRooms();
                  });
                }}
              >
                Delete
              </button>
            </div>
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
              <div className="messageMeta">
                <span>Priority: {message.priority ?? "normal"}</span>
                <span>Delivered: {message.deliveredToUserIds?.length ?? 0}</span>
                <span>Read: {message.readByUserIds.length}</span>
              </div>
              {editingMessageId === message.id ? (
                <div className="inlineEditor">
                  <input value={editingMessageValue} onChange={(event) => setEditingMessageValue(event.target.value)} />
                  <button
                    onClick={() => {
                      void updateMessage(userId, message.roomId, message.id, editingMessageValue).then(async () => {
                        setEditingMessageId(null);
                        setEditingMessageValue("");
                        await refreshActiveRoomData(message.roomId);
                      });
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingMessageId(null);
                      setEditingMessageValue("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
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
                <button
                  onClick={() => {
                    setEditingMessageId(message.id);
                    setEditingMessageValue(message.content);
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    void deleteMessage(userId, message.roomId, message.id).then(async () => {
                      await refreshActiveRoomData(message.roomId);
                    });
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    void deliverMessage(userId, message.roomId, message.id);
                  }}
                >
                  Deliver
                </button>
                <button
                  onClick={() => {
                    void setMessagePriority(userId, message.roomId, message.id, "high");
                  }}
                >
                  High
                </button>
                <button
                  onClick={() => {
                    void setMessagePriority(userId, message.roomId, message.id, "urgent");
                  }}
                >
                  Urgent
                </button>
              </div>
            </article>
          ))}
        </section>

        <footer className="composer">
          <div className="typingIndicator">
            {typingUsers.length > 0 ? `${typingUsers.join(", ")} typing...` : ""}
          </div>
          <div className="templateBar">
            <select
              value={activeTemplate?.id ?? ""}
              onChange={(event) => {
                const template = templates.find((value) => value.id === event.target.value);
                if (template) {
                  setComposerValue(template.body);
                }
              }}
            >
              <option value="">Templates</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
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
        <div className="sectionTitle">Room State</div>
        <div className="roomStateCard">
          <div>Follow-up: {roomDetails?.preference.followUpFlag ? "On" : "Off"}</div>
          <div>Archived: {roomDetails?.preference.archived ? "Yes" : "No"}</div>
          <div>Muted: {roomDetails?.notificationPreference.muted ? "Yes" : "No"}</div>
          <div>Mute low priority: {roomDetails?.notificationPreference.muteLowPriority ? "Yes" : "No"}</div>
        </div>

        <div className="sectionTitle">Context</div>
        <input placeholder="Context id" value={contextDraft.contextId} onChange={(event) => setContextDraft((current) => ({ ...current, contextId: event.target.value }))} />
        <input placeholder="Context label" value={contextDraft.label} onChange={(event) => setContextDraft((current) => ({ ...current, label: event.target.value }))} />
        <button
          onClick={() => {
            if (!activeRoomId || !contextDraft.contextId || !contextDraft.label) {
              return;
            }
            void linkContext(userId, activeRoomId, contextDraft).then(async () => {
              await refreshActiveRoomData(activeRoomId);
            });
          }}
        >
          Link context
        </button>

        <div className="sectionTitle">Directory</div>
        <input placeholder="Search people" value={directoryFilters.query} onChange={(event) => setDirectoryFilters((current) => ({ ...current, query: event.target.value }))} />
        <div className="compactGrid">
          <input placeholder="Role" value={directoryFilters.role} onChange={(event) => setDirectoryFilters((current) => ({ ...current, role: event.target.value }))} />
          <input placeholder="Team" value={directoryFilters.team} onChange={(event) => setDirectoryFilters((current) => ({ ...current, team: event.target.value }))} />
          <input placeholder="Location" value={directoryFilters.location} onChange={(event) => setDirectoryFilters((current) => ({ ...current, location: event.target.value }))} />
          <input placeholder="Shift" value={directoryFilters.shift} onChange={(event) => setDirectoryFilters((current) => ({ ...current, shift: event.target.value }))} />
        </div>
        <div className="directoryList">
          {directoryUsers.map((candidate) => {
            const selected = selectedRecipientIds.includes(candidate.id);
            const alreadyMember = members.some((member) => member.id === candidate.id);
            return (
              <div key={candidate.id} className="directoryRow">
                <div>
                  <strong>{candidate.displayName}</strong>
                  <div className="helperText">{candidate.roleNames?.join(", ") ?? candidate.id}</div>
                </div>
                <div className="rowActions">
                  <button
                    onClick={() => {
                      setSelectedRecipientIds((current) =>
                        selected ? current.filter((value) => value !== candidate.id) : [...current, candidate.id]
                      );
                    }}
                  >
                    {selected ? "Unselect" : "Select"}
                  </button>
                  {activeRoomId ? (
                    alreadyMember ? (
                      <button
                        onClick={() => {
                          void removeParticipant(userId, activeRoomId, candidate.id).then(async () => {
                            await refreshActiveRoomData(activeRoomId);
                            await refreshRooms(activeRoomId);
                          });
                        }}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          void addParticipants(userId, activeRoomId, [candidate.id]).then(async () => {
                            await refreshActiveRoomData(activeRoomId);
                            await refreshRooms(activeRoomId);
                          });
                        }}
                      >
                        Add
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {activeRoomId ? (
          <button
            onClick={() => {
              void updateAssignmentMembership(userId, activeRoomId, Array.from(new Set([userId, ...selectedRecipientIds]))).then(async () => {
                await refreshActiveRoomData(activeRoomId);
                await refreshRooms(activeRoomId);
              });
            }}
          >
            Apply selection as assignment
          </button>
        ) : null}

        <div className="sectionTitle">Members</div>
        {members.map((member) => (
          <div key={member.id} className="memberRow">
            <span>{member.displayName}</span>
            <span className={`presence ${member.presence}`}>{member.presence}</span>
          </div>
        ))}

        <div className="sectionTitle">Templates</div>
        <div className="templateList">
          {templates.map((template) => (
            <button
              key={template.id}
              className="templateItem"
              onClick={() => {
                setTemplateDraft({
                  id: template.id,
                  title: template.title,
                  body: template.body,
                  scopeType: template.scopeType,
                  scopeId: template.scopeId,
                  active: template.active
                });
                setComposerValue(template.body);
              }}
            >
              {template.title}
            </button>
          ))}
        </div>
        <input placeholder="Template title" value={templateDraft.title} onChange={(event) => setTemplateDraft((current) => ({ ...current, title: event.target.value }))} />
        <textarea value={templateDraft.body} onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Template body" />
        <div className="compactGrid">
          <select value={templateDraft.scopeType} onChange={(event) => setTemplateDraft((current) => ({ ...current, scopeType: event.target.value as QuickMessageTemplate["scopeType"] }))}>
            <option value="tenant">Tenant</option>
            <option value="site">Site</option>
            <option value="unit">Unit</option>
            <option value="department">Department</option>
            <option value="team">Team</option>
          </select>
          <input placeholder="Scope id" value={templateDraft.scopeId} onChange={(event) => setTemplateDraft((current) => ({ ...current, scopeId: event.target.value }))} />
        </div>
        <button onClick={() => void handleSaveTemplate()}>{templateDraft.id ? "Update template" : "Create template"}</button>

        <div className="sectionTitle">Audit</div>
        <div className="auditList">
          {auditEvents.map((event) => (
            <div key={event.id} className="auditRow">
              <strong>{event.eventType}</strong>
              <span>{new Date(event.occurredUtc).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
