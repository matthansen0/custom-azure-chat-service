import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { addReaction, demoLogin, getMembers, getMessages, getRooms, markRead, removeReaction, searchInRoom, sendMessage, setPin, setTyping } from "./api.js";
import { connectRealtime } from "./realtime.js";
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
    const [rooms, setRooms] = useState([]);
    const [activeRoomId, setActiveRoomId] = useState("");
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [composerValue, setComposerValue] = useState("");
    const [searchValue, setSearchValue] = useState("");
    const [typingByUser, setTypingByUser] = useState({});
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const disconnectRef = useRef(null);
    const pendingReadIdsRef = useRef(new Set());
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
                onEvent: (event) => {
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
    function handleRealtimeEvent(event) {
        if (event.roomId && event.roomId !== activeRoomId) {
            void refreshRooms();
            return;
        }
        switch (event.eventType) {
            case "MessageCreated": {
                const payload = event.payload;
                setMessages((current) => {
                    const optimisticIndex = current.findIndex((value) => value.clientMessageId === payload.clientMessageId);
                    const created = {
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
                const payload = event.payload;
                setMessages((current) => current.map((value) => value.id === payload.messageId && !value.readByUserIds.includes(event.actorUserId)
                    ? { ...value, readByUserIds: [...value.readByUserIds, event.actorUserId] }
                    : value));
                break;
            }
            case "ReactionAdded":
            case "ReactionRemoved": {
                const payload = event.payload;
                setMessages((current) => current.map((value) => {
                    if (value.id !== payload.messageId) {
                        return value;
                    }
                    const usersByReaction = new Set(value.reactionSummary[payload.reaction] ?? []);
                    if (event.eventType === "ReactionAdded") {
                        usersByReaction.add(event.actorUserId);
                    }
                    else {
                        usersByReaction.delete(event.actorUserId);
                    }
                    return {
                        ...value,
                        reactionSummary: {
                            ...value.reactionSummary,
                            [payload.reaction]: Array.from(usersByReaction)
                        }
                    };
                }));
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
        const optimisticMessage = {
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
    async function onSearch(query) {
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
                const next = {};
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
        const unreadIncoming = messages.filter((message) => message.roomId === activeRoomId &&
            message.senderId !== userId &&
            !message.readByUserIds.includes(userId) &&
            !pendingReadIdsRef.current.has(message.id));
        for (const message of unreadIncoming) {
            pendingReadIdsRef.current.add(message.id);
            void markRead(userId, activeRoomId, message.id).finally(() => {
                pendingReadIdsRef.current.delete(message.id);
            });
        }
    }, [activeRoomId, messages, userId]);
    const typingUsers = Object.keys(typingByUser)
        .filter((id) => id !== userId)
        .map((id) => users.find((value) => value.id === id)?.label ?? id);
    return (_jsxs("div", { className: "layout", children: [_jsxs("aside", { className: "roomsRail", children: [_jsx("div", { className: "sectionTitle", children: "Users" }), _jsx("select", { value: userId, onChange: (event) => setUserId(event.target.value), children: users.map((user) => (_jsx("option", { value: user.id, children: user.label }, user.id))) }), _jsx("div", { className: "sectionTitle", children: "Rooms" }), rooms.map((room) => {
                        const unread = room.summary.unreadCountByUser[userId] ?? 0;
                        const isPinned = room.pinnedByUserIds.includes(userId);
                        return (_jsxs("button", { className: `roomItem ${room.id === activeRoomId ? "active" : ""}`, onClick: () => setActiveRoomId(room.id), children: [_jsx("span", { children: room.name }), _jsxs("span", { className: "meta", children: [isPinned ? "Pinned" : "", " ", unread > 0 ? `Unread ${unread}` : ""] })] }, room.id));
                    })] }), _jsxs("main", { className: "conversationPane", children: [_jsxs("header", { className: "conversationHeader", children: [_jsxs("div", { children: [_jsx("h1", { children: activeRoom?.name ?? "No room" }), _jsxs("div", { className: `status ${connectionStatus}`, children: ["Connection: ", connectionStatus] })] }), activeRoom ? (_jsx("button", { onClick: () => {
                                    const pinned = !activeRoom.pinnedByUserIds.includes(userId);
                                    void setPin(userId, activeRoom.id, pinned).then(refreshRooms);
                                }, children: activeRoom.pinnedByUserIds.includes(userId) ? "Unpin" : "Pin" })) : null] }), _jsx("div", { className: "searchRow", children: _jsx("input", { value: searchValue, placeholder: "Search current room", onChange: (event) => {
                                void onSearch(event.target.value);
                            } }) }), _jsx("section", { className: "messageList", children: messages.map((message) => (_jsxs("article", { className: `message ${message.senderId === userId ? "mine" : ""}`, children: [_jsxs("div", { className: "messageTop", children: [_jsx("strong", { children: message.senderId }), _jsx("span", { children: new Date(message.createdUtc).toLocaleTimeString() })] }), _jsx("p", { children: message.content }), _jsxs("div", { className: "messageActions", children: [_jsxs("button", { onClick: () => {
                                                void addReaction(userId, message.roomId, message.id, "thumbsUp");
                                            }, children: ["+1 (", message.reactionSummary.thumbsUp?.length ?? 0, ")"] }), _jsxs("button", { onClick: () => {
                                                void addReaction(userId, message.roomId, message.id, "heart");
                                            }, children: ["Heart (", message.reactionSummary.heart?.length ?? 0, ")"] }), _jsx("button", { onClick: () => {
                                                void removeReaction(userId, message.roomId, message.id, "thumbsUp");
                                            }, children: "Remove +1" }), _jsxs("button", { onClick: () => {
                                                void markRead(userId, message.roomId, message.id);
                                            }, children: ["Mark Read (", message.readByUserIds.length, ")"] })] })] }, message.id))) }), _jsxs("footer", { className: "composer", children: [_jsx("div", { className: "typingIndicator", children: typingUsers.length > 0 ? `${typingUsers.join(", ")} typing...` : "" }), _jsx("textarea", { value: composerValue, onChange: (event) => {
                                    const next = event.target.value;
                                    setComposerValue(next);
                                    if (activeRoomId) {
                                        void setTyping(userId, activeRoomId, next.length > 0);
                                    }
                                }, placeholder: "Write a message" }), _jsx("button", { onClick: () => void onSend(), children: "Send" })] })] }), _jsxs("aside", { className: "membersPane", children: [_jsx("div", { className: "sectionTitle", children: "Members" }), members.map((member) => (_jsxs("div", { className: "memberRow", children: [_jsx("span", { children: member.displayName }), _jsx("span", { className: `presence ${member.presence}`, children: member.presence })] }, member.id)))] })] }));
}
