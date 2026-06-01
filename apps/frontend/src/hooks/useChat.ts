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
  const disconnectRef = useRef<null | (() => Promise<void>)>(null);

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

    void (async () => {
      await refreshMessages(activeRoomId);

      if (disconnectRef.current) {
        await disconnectRef.current();
      }

      disconnectRef.current = await connectRealtime({
        userId,
        roomId: activeRoomId,
        onStatus: setConnectionStatus,
        onEvent: (event: EventEnvelope) => {
          if (event.eventType === "TypingStarted") {
            const actor = event.actorUserId;
            if (actor !== userId) {
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
            void refreshMessages(activeRoomId);
            void refreshRooms(activeRoomId);
          }
        }
      });
    })();

    return () => {
      if (disconnectRef.current) {
        void disconnectRef.current();
        disconnectRef.current = null;
      }
    };
  }, [activeRoomId]);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || !activeRoomId) return;
      await sendMessage(userId, activeRoomId, content, randomClientMessageId());
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
    refreshMessages
  };
}
