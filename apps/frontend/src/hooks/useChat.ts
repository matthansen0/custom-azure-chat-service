import { useCallback, useEffect, useRef, useState } from "react";
import {
  addReaction,
  createRoom,
  demoLogin,
  deleteMessage,
  deliverMessage,
  getMembers,
  getMessages,
  getRoomsWithFilters,
  markRead,
  removeReaction,
  searchInRoom,
  sendMessage,
  setPin,
  setTyping,
  updateMessage
} from "../api.js";
import { connectRealtime, type ConnectionStatus } from "../realtime.js";
import type { EventEnvelope, Message, Room, User } from "../types.js";

function randomClientMessageId() {
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface MentionFeedEntry {
  id: string;
  kind: "mention" | "reply";
  messageId: string;
  roomId: string;
  roomName: string;
  actorUserId: string;
  content: string;
  occurredUtc: string;
  everyone: boolean;
  priority: "low" | "normal" | "high" | "urgent";
  replyToContent?: string;
}

export interface EmergencyAlert {
  id: string;
  roomId: string;
  roomName: string;
  actorUserId: string;
  content: string;
  occurredUtc: string;
}

export function useChat() {
  const queryUser = new URLSearchParams(window.location.search).get("user") ?? "u1";
  const [userId, setUserId] = useState(queryUser);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [typingByUser, setTypingByUser] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [mentionFeed, setMentionFeed] = useState<MentionFeedEntry[]>([]);
  const [emergencyAlert, setEmergencyAlert] = useState<EmergencyAlert | null>(null);
  const disconnectRef = useRef<null | (() => Promise<void>)>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const roomsRef = useRef<Room[]>(rooms);
  roomsRef.current = rooms;
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
  const activeRoomIdRef = useRef<string>(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const refreshMessagesRef = useRef<(roomId?: string) => Promise<void>>(async () => {});
  const refreshRoomsRef = useRef<(selectRoomId?: string) => Promise<void>>(async () => {});

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("user", userId);
    window.history.replaceState(null, "", url);
  }, [userId]);

  const refreshRooms = useCallback(
    async (selectRoomId?: string) => {
      const nextRooms = await getRoomsWithFilters(userId);
      setRooms(nextRooms);
      const target = selectRoomId ?? activeRoomId;
      if (!target || !nextRooms.some((r) => r.id === target)) {
        setActiveRoomId(nextRooms[0]?.id ?? "");
      } else {
        setActiveRoomId(target);
      }
    },
    [userId, activeRoomId]
  );

  const refreshMessages = useCallback(
    async (roomId = activeRoomId) => {
      if (!roomId) {
        setMessages([]);
        setMembers([]);
        return;
      }
      const [nextMessages, nextMembers] = await Promise.all([
        searchQuery.trim() ? searchInRoom(userId, roomId, searchQuery) : getMessages(userId, roomId),
        getMembers(userId, roomId)
      ]);
      setMessages(nextMessages);
      setMembers(nextMembers);
    },
    [userId, activeRoomId, searchQuery]
  );

  refreshRoomsRef.current = refreshRooms;
  refreshMessagesRef.current = refreshMessages;

  useEffect(() => {
    void (async () => {
      await demoLogin(userId);
      await refreshRooms("");
    })();
  }, [userId]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      setMembers([]);
      return;
    }
    void refreshMessages(activeRoomId);
  }, [activeRoomId, refreshMessages]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void (async () => {
      try {
        await demoLogin(userId);

        if (disconnectRef.current) {
          await disconnectRef.current();
          disconnectRef.current = null;
        }

        disconnectRef.current = await connectRealtime({
          userId,
          onStatus: setConnectionStatus,
          onEvent: (event: EventEnvelope) => {
          if (event.eventType === "TypingStarted") {
            const actor = event.actorUserId;
            if (actor !== userIdRef.current && event.roomId === activeRoomIdRef.current) {
              setTypingByUser((prev) => ({ ...prev, [actor]: Date.now() }));
              setTimeout(() => {
                setTypingByUser((prev) => {
                  const copy = { ...prev };
                  if (copy[actor] && Date.now() - copy[actor] >= 3000) {
                    delete copy[actor];
                  }
                  return copy;
                });
              }, 3500);
            }
          } else {
            if (event.eventType === "MessageCreated" && event.actorUserId !== userIdRef.current) {
              const payload = event.payload as {
                messageId?: string;
                content?: string;
                mentions?: string[];
                mentionEveryone?: boolean;
                priority?: "low" | "normal" | "high" | "urgent";
                replyToMessageId?: string;
              };
              const mentions = Array.isArray(payload.mentions) ? payload.mentions : [];
              const everyone = Boolean(payload.mentionEveryone);
              const me = userIdRef.current;
              const room = roomsRef.current.find((r) => r.id === event.roomId);
              const isMentioned = mentions.includes(me) || everyone;
              // Check if this is a reply to one of my messages.
              let replyOriginal: Message | undefined;
              if (payload.replyToMessageId) {
                replyOriginal = messagesRef.current.find((m) => m.id === payload.replyToMessageId);
              }
              const isReplyToMe = Boolean(replyOriginal && replyOriginal.senderId === me);
              if ((isMentioned || isReplyToMe) && room) {
                const entry: MentionFeedEntry = {
                  id: event.eventId,
                  kind: isMentioned ? "mention" : "reply",
                  messageId: payload.messageId ?? event.entityId,
                  roomId: room.id,
                  roomName: room.name,
                  actorUserId: event.actorUserId,
                  content: payload.content ?? "",
                  occurredUtc: event.occurredUtc,
                  everyone,
                  priority: payload.priority ?? "normal",
                  replyToContent: replyOriginal?.content
                };
                setMentionFeed((prev) => {
                  if (prev.some((e) => e.id === entry.id)) return prev;
                  return [entry, ...prev].slice(0, 50);
                });
              }
              if (payload.priority === "urgent" && room && room.participantIds.includes(me)) {
                setEmergencyAlert({
                  id: event.eventId,
                  roomId: room.id,
                  roomName: room.name,
                  actorUserId: event.actorUserId,
                  content: payload.content ?? "",
                  occurredUtc: event.occurredUtc
                });
              }
            }
            const currentRoom = activeRoomIdRef.current;
            if (event.roomId === currentRoom) {
              void refreshMessagesRef.current(currentRoom);
            }
            void refreshRoomsRef.current(currentRoom);
          }
          }
        });
      } catch {
        setConnectionStatus("disconnected");
      }
    })();

    return () => {
      if (disconnectRef.current) {
        void disconnectRef.current();
        disconnectRef.current = null;
      }
    };
  }, [userId]);

  const send = useCallback(
    async (
      content: string,
      options?: {
        mentions?: string[];
        mentionEveryone?: boolean;
        priority?: "low" | "normal" | "high" | "urgent";
        replyToMessageId?: string;
      }
    ) => {
      if (!content.trim() || !activeRoomId) return;
      await sendMessage(userId, activeRoomId, content, randomClientMessageId(), options);
      await refreshMessages(activeRoomId);
      await refreshRooms(activeRoomId);
    },
    [userId, activeRoomId, refreshMessages, refreshRooms]
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeRoomId) return;
      await updateMessage(userId, activeRoomId, messageId, content);
      await refreshMessages(activeRoomId);
    },
    [userId, activeRoomId, refreshMessages]
  );

  const removeMessage = useCallback(
    async (messageId: string) => {
      if (!activeRoomId) return;
      await deleteMessage(userId, activeRoomId, messageId);
      await refreshMessages(activeRoomId);
    },
    [userId, activeRoomId, refreshMessages]
  );

  const react = useCallback(
    async (messageId: string, reaction: string) => {
      if (!activeRoomId) return;
      await addReaction(userId, activeRoomId, messageId, reaction);
      await refreshMessages(activeRoomId);
    },
    [userId, activeRoomId, refreshMessages]
  );

  const unreact = useCallback(
    async (messageId: string, reaction: string) => {
      if (!activeRoomId) return;
      await removeReaction(userId, activeRoomId, messageId, reaction);
      await refreshMessages(activeRoomId);
    },
    [userId, activeRoomId, refreshMessages]
  );

  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!activeRoomId) return;
      await markRead(userId, activeRoomId, messageId);
    },
    [userId, activeRoomId]
  );

  const deliver = useCallback(
    async (messageId: string) => {
      if (!activeRoomId) return;
      await deliverMessage(userId, activeRoomId, messageId);
    },
    [userId, activeRoomId]
  );

  const startTyping = useCallback(async () => {
    if (!activeRoomId) return;
    await setTyping(userId, activeRoomId, true);
  }, [userId, activeRoomId]);

  const togglePin = useCallback(
    async (roomId: string, pinned: boolean) => {
      await setPin(userId, roomId, pinned);
      await refreshRooms(activeRoomId);
    },
    [userId, activeRoomId, refreshRooms]
  );

  const newRoom = useCallback(
    async (name: string, type: Room["type"], participantIds: string[]) => {
      const roomId = await createRoom(userId, { name, type, participantIds });
      await refreshRooms(roomId);
    },
    [userId, refreshRooms]
  );

  const switchUser = useCallback(
    async (newUserId: string) => {
      if (disconnectRef.current) {
        await disconnectRef.current();
        disconnectRef.current = null;
      }
      setUserId(newUserId);
    },
    []
  );

  const selectRoom = useCallback((roomId: string) => {
    setActiveRoomId(roomId);
  }, []);

  const dismissEmergency = useCallback(() => {
    setEmergencyAlert(null);
  }, []);

  const clearMentions = useCallback(() => {
    setMentionFeed([]);
  }, []);

  return {
    userId,
    rooms,
    activeRoom,
    activeRoomId,
    messages,
    members,
    connectionStatus,
    typingByUser,
    searchQuery,
    setSearchQuery,
    send,
    editMessage,
    removeMessage,
    react,
    unreact,
    markAsRead,
    deliver,
    startTyping,
    togglePin,
    newRoom,
    switchUser,
    selectRoom,
    refreshMessages,
    mentionFeed,
    emergencyAlert,
    dismissEmergency,
    clearMentions
  };
}
