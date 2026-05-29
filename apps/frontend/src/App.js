import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { addParticipants, addReaction, clearRoom, createRoom, createTemplate, deleteMessage, deleteRoom, deliverMessage, demoLogin, getAuditEvents, getDirectory, getMembers, getMessages, getRoomDetails, getRoomsWithFilters, getTemplates, leaveRoom, linkContext, markRead, removeParticipant, removeReaction, searchInRoom, sendMessage, setMessagePriority, setNotificationPreference, setPin, setThreadArchived, setThreadFollowUp, setThreadHidden, setThreadMarkUnread, setTyping, updateAssignmentMembership, updateMessage, updateTemplate } from "./api.js";
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
    const [roomDetails, setRoomDetails] = useState(null);
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [auditEvents, setAuditEvents] = useState([]);
    const [directoryUsers, setDirectoryUsers] = useState([]);
    const [composerValue, setComposerValue] = useState("");
    const [searchValue, setSearchValue] = useState("");
    const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
    const [showHiddenRooms, setShowHiddenRooms] = useState(false);
    const [showArchivedRooms, setShowArchivedRooms] = useState(false);
    const [createRoomName, setCreateRoomName] = useState("");
    const [createRoomType, setCreateRoomType] = useState("group");
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingMessageValue, setEditingMessageValue] = useState("");
    const [templateDraft, setTemplateDraft] = useState({
        title: "",
        body: "",
        scopeType: "team",
        scopeId: "alpha",
        active: true
    });
    const [contextDraft, setContextDraft] = useState({
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
    const [typingByUser, setTypingByUser] = useState({});
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const disconnectRef = useRef(null);
    const pendingReadIdsRef = useRef(new Set());
    const pendingDeliveryIdsRef = useRef(new Set());
    const activeRoom = useMemo(() => rooms.find((value) => value.id === activeRoomId), [rooms, activeRoomId]);
    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("user", userId);
        window.history.replaceState(null, "", url);
    }, [userId]);
    async function refreshRooms(nextActiveRoomId) {
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
    useEffect(() => {
        void refreshDirectory();
    }, [userId, directoryFilters.query, directoryFilters.role, directoryFilters.team, directoryFilters.location, directoryFilters.shift]);
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
                const payload = event.payload;
                setMessages((current) => current.map((value) => value.id === payload.messageId
                    ? { ...value, content: payload.content, editedUtc: event.occurredUtc }
                    : value));
                void refreshRooms();
                break;
            }
            case "MessageDeleted": {
                const payload = event.payload;
                setMessages((current) => current.map((value) => value.id === payload.messageId ? { ...value, content: "Message deleted", deleted: true } : value));
                void refreshRooms();
                break;
            }
            case "MessageRead": {
                const payload = event.payload;
                setMessages((current) => current.map((value) => value.id === payload.messageId && !value.readByUserIds.includes(event.actorUserId)
                    ? { ...value, readByUserIds: [...value.readByUserIds, event.actorUserId] }
                    : value));
                break;
            }
            case "MessageDelivered": {
                const payload = event.payload;
                setMessages((current) => current.map((value) => value.id === payload.messageId && !(value.deliveredToUserIds ?? []).includes(event.actorUserId)
                    ? { ...value, deliveredToUserIds: [...(value.deliveredToUserIds ?? []), event.actorUserId] }
                    : value));
                break;
            }
            case "MessagePrioritySet": {
                const payload = event.payload;
                setMessages((current) => current.map((value) => (value.id === payload.messageId ? { ...value, priority: payload.priority } : value)));
                void refreshRooms();
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
        const optimisticMessage = {
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
    async function onSearch(query) {
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
    useEffect(() => {
        if (!activeRoomId) {
            return;
        }
        const undeliveredIncoming = messages.filter((message) => message.roomId === activeRoomId &&
            message.senderId !== userId &&
            !(message.deliveredToUserIds ?? []).includes(userId) &&
            !pendingDeliveryIdsRef.current.has(message.id));
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
        }
        else {
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
    async function handleRoomPreferenceUpdate(action) {
        await action();
        await refreshRooms(activeRoomId);
        await refreshActiveRoomData(activeRoomId);
    }
    return (_jsxs("div", { className: "layout", children: [_jsxs("aside", { className: "roomsRail", children: [_jsx("div", { className: "sectionTitle", children: "Users" }), _jsx("select", { value: userId, onChange: (event) => setUserId(event.target.value), children: users.map((user) => (_jsx("option", { value: user.id, children: user.label }, user.id))) }), _jsxs("label", { className: "toggleRow", children: [_jsx("input", { type: "checkbox", checked: showArchivedRooms, onChange: (event) => setShowArchivedRooms(event.target.checked) }), _jsx("span", { children: "Show archived" })] }), _jsxs("label", { className: "toggleRow", children: [_jsx("input", { type: "checkbox", checked: showHiddenRooms, onChange: (event) => setShowHiddenRooms(event.target.checked) }), _jsx("span", { children: "Show hidden" })] }), _jsx("div", { className: "sectionTitle", children: "Create Room" }), _jsx("input", { value: createRoomName, placeholder: "Room name", onChange: (event) => setCreateRoomName(event.target.value) }), _jsxs("select", { value: createRoomType, onChange: (event) => setCreateRoomType(event.target.value), children: [_jsx("option", { value: "group", children: "Group" }), _jsx("option", { value: "direct", children: "Direct" }), _jsx("option", { value: "announcement", children: "Announcement" })] }), _jsxs("div", { className: "helperText", children: ["Selected recipients: ", selectedRecipientIds.length] }), _jsx("button", { onClick: () => void handleCreateRoom(), children: "Create room" }), _jsx("div", { className: "sectionTitle", children: "Rooms" }), rooms.map((room) => {
                        const unread = room.summary.unreadCountByUser[userId] ?? 0;
                        const isPinned = room.pinnedByUserIds.includes(userId);
                        return (_jsxs("button", { className: `roomItem ${room.id === activeRoomId ? "active" : ""}`, onClick: () => setActiveRoomId(room.id), children: [_jsx("span", { children: room.name }), _jsxs("span", { className: "meta", children: [isPinned ? "Pinned " : "", room.summary.linkedContext ? `${room.summary.linkedContext.label} ` : "", unread > 0 ? `Unread ${unread}` : ""] })] }, room.id));
                    })] }), _jsxs("main", { className: "conversationPane", children: [_jsxs("header", { className: "conversationHeader", children: [_jsxs("div", { children: [_jsx("h1", { children: activeRoom?.name ?? "No room" }), _jsxs("div", { className: `status ${connectionStatus}`, children: ["Connection: ", connectionStatus] }), roomDetails?.linkedContext ? _jsxs("div", { className: "helperText", children: ["Context: ", roomDetails.linkedContext.label] }) : null] }), activeRoom ? (_jsxs("div", { className: "headerActions", children: [_jsx("button", { onClick: () => void handleRoomPreferenceUpdate(() => setPin(userId, activeRoom.id, !activeRoom.pinnedByUserIds.includes(userId))), children: activeRoom.pinnedByUserIds.includes(userId) ? "Unpin" : "Pin" }), _jsx("button", { onClick: () => void handleRoomPreferenceUpdate(() => setThreadArchived(userId, activeRoom.id, !roomDetails?.preference.archived)), children: roomDetails?.preference.archived ? "Unarchive" : "Archive" }), _jsx("button", { onClick: () => void handleRoomPreferenceUpdate(() => setThreadHidden(userId, activeRoom.id, !roomDetails?.preference.hidden)), children: roomDetails?.preference.hidden ? "Unhide" : "Hide" }), _jsx("button", { onClick: () => void handleRoomPreferenceUpdate(() => setThreadFollowUp(userId, activeRoom.id, !roomDetails?.preference.followUpFlag)), children: roomDetails?.preference.followUpFlag ? "Clear Follow-up" : "Follow-up" }), _jsx("button", { onClick: () => void handleRoomPreferenceUpdate(() => setThreadMarkUnread(userId, activeRoom.id, !roomDetails?.preference.markUnread)), children: roomDetails?.preference.markUnread ? "Clear Unread" : "Mark Unread" }), _jsx("button", { onClick: () => void handleRoomPreferenceUpdate(() => setNotificationPreference(userId, activeRoom.id, {
                                            muted: !roomDetails?.notificationPreference.muted,
                                            muteLowPriority: roomDetails?.notificationPreference.muteLowPriority ?? false,
                                            allowPriorityOverride: roomDetails?.notificationPreference.allowPriorityOverride ?? true
                                        })), children: roomDetails?.notificationPreference.muted ? "Unmute" : "Mute" }), _jsx("button", { onClick: () => void handleRoomPreferenceUpdate(() => clearRoom(userId, activeRoom.id)), children: "Clear" }), _jsx("button", { onClick: () => {
                                            void leaveRoom(userId, activeRoom.id).then(async () => {
                                                await refreshRooms();
                                            });
                                        }, children: "Leave" }), _jsx("button", { onClick: () => {
                                            void deleteRoom(userId, activeRoom.id).then(async () => {
                                                await refreshRooms();
                                            });
                                        }, children: "Delete" })] })) : null] }), _jsx("div", { className: "searchRow", children: _jsx("input", { value: searchValue, placeholder: "Search current room", onChange: (event) => {
                                void onSearch(event.target.value);
                            } }) }), _jsx("section", { className: "messageList", children: messages.map((message) => (_jsxs("article", { className: `message ${message.senderId === userId ? "mine" : ""}`, children: [_jsxs("div", { className: "messageTop", children: [_jsx("strong", { children: message.senderId }), _jsx("span", { children: new Date(message.createdUtc).toLocaleTimeString() })] }), _jsx("p", { children: message.content }), _jsxs("div", { className: "messageMeta", children: [_jsxs("span", { children: ["Priority: ", message.priority ?? "normal"] }), _jsxs("span", { children: ["Delivered: ", message.deliveredToUserIds?.length ?? 0] }), _jsxs("span", { children: ["Read: ", message.readByUserIds.length] })] }), editingMessageId === message.id ? (_jsxs("div", { className: "inlineEditor", children: [_jsx("input", { value: editingMessageValue, onChange: (event) => setEditingMessageValue(event.target.value) }), _jsx("button", { onClick: () => {
                                                void updateMessage(userId, message.roomId, message.id, editingMessageValue).then(async () => {
                                                    setEditingMessageId(null);
                                                    setEditingMessageValue("");
                                                    await refreshActiveRoomData(message.roomId);
                                                });
                                            }, children: "Save" }), _jsx("button", { onClick: () => {
                                                setEditingMessageId(null);
                                                setEditingMessageValue("");
                                            }, children: "Cancel" })] })) : null, _jsxs("div", { className: "messageActions", children: [_jsxs("button", { onClick: () => {
                                                void addReaction(userId, message.roomId, message.id, "thumbsUp");
                                            }, children: ["+1 (", message.reactionSummary.thumbsUp?.length ?? 0, ")"] }), _jsxs("button", { onClick: () => {
                                                void addReaction(userId, message.roomId, message.id, "heart");
                                            }, children: ["Heart (", message.reactionSummary.heart?.length ?? 0, ")"] }), _jsx("button", { onClick: () => {
                                                void removeReaction(userId, message.roomId, message.id, "thumbsUp");
                                            }, children: "Remove +1" }), _jsxs("button", { onClick: () => {
                                                void markRead(userId, message.roomId, message.id);
                                            }, children: ["Mark Read (", message.readByUserIds.length, ")"] }), _jsx("button", { onClick: () => {
                                                setEditingMessageId(message.id);
                                                setEditingMessageValue(message.content);
                                            }, children: "Edit" }), _jsx("button", { onClick: () => {
                                                void deleteMessage(userId, message.roomId, message.id).then(async () => {
                                                    await refreshActiveRoomData(message.roomId);
                                                });
                                            }, children: "Delete" }), _jsx("button", { onClick: () => {
                                                void deliverMessage(userId, message.roomId, message.id);
                                            }, children: "Deliver" }), _jsx("button", { onClick: () => {
                                                void setMessagePriority(userId, message.roomId, message.id, "high");
                                            }, children: "High" }), _jsx("button", { onClick: () => {
                                                void setMessagePriority(userId, message.roomId, message.id, "urgent");
                                            }, children: "Urgent" })] })] }, message.id))) }), _jsxs("footer", { className: "composer", children: [_jsx("div", { className: "typingIndicator", children: typingUsers.length > 0 ? `${typingUsers.join(", ")} typing...` : "" }), _jsx("div", { className: "templateBar", children: _jsxs("select", { value: activeTemplate?.id ?? "", onChange: (event) => {
                                        const template = templates.find((value) => value.id === event.target.value);
                                        if (template) {
                                            setComposerValue(template.body);
                                        }
                                    }, children: [_jsx("option", { value: "", children: "Templates" }), templates.map((template) => (_jsx("option", { value: template.id, children: template.title }, template.id)))] }) }), _jsx("textarea", { value: composerValue, onChange: (event) => {
                                    const next = event.target.value;
                                    setComposerValue(next);
                                    if (activeRoomId) {
                                        void setTyping(userId, activeRoomId, next.length > 0);
                                    }
                                }, placeholder: "Write a message" }), _jsx("button", { onClick: () => void onSend(), children: "Send" })] })] }), _jsxs("aside", { className: "membersPane", children: [_jsx("div", { className: "sectionTitle", children: "Room State" }), _jsxs("div", { className: "roomStateCard", children: [_jsxs("div", { children: ["Follow-up: ", roomDetails?.preference.followUpFlag ? "On" : "Off"] }), _jsxs("div", { children: ["Archived: ", roomDetails?.preference.archived ? "Yes" : "No"] }), _jsxs("div", { children: ["Muted: ", roomDetails?.notificationPreference.muted ? "Yes" : "No"] }), _jsxs("div", { children: ["Mute low priority: ", roomDetails?.notificationPreference.muteLowPriority ? "Yes" : "No"] })] }), _jsx("div", { className: "sectionTitle", children: "Context" }), _jsx("input", { placeholder: "Context id", value: contextDraft.contextId, onChange: (event) => setContextDraft((current) => ({ ...current, contextId: event.target.value })) }), _jsx("input", { placeholder: "Context label", value: contextDraft.label, onChange: (event) => setContextDraft((current) => ({ ...current, label: event.target.value })) }), _jsx("button", { onClick: () => {
                            if (!activeRoomId || !contextDraft.contextId || !contextDraft.label) {
                                return;
                            }
                            void linkContext(userId, activeRoomId, contextDraft).then(async () => {
                                await refreshActiveRoomData(activeRoomId);
                            });
                        }, children: "Link context" }), _jsx("div", { className: "sectionTitle", children: "Directory" }), _jsx("input", { placeholder: "Search people", value: directoryFilters.query, onChange: (event) => setDirectoryFilters((current) => ({ ...current, query: event.target.value })) }), _jsxs("div", { className: "compactGrid", children: [_jsx("input", { placeholder: "Role", value: directoryFilters.role, onChange: (event) => setDirectoryFilters((current) => ({ ...current, role: event.target.value })) }), _jsx("input", { placeholder: "Team", value: directoryFilters.team, onChange: (event) => setDirectoryFilters((current) => ({ ...current, team: event.target.value })) }), _jsx("input", { placeholder: "Location", value: directoryFilters.location, onChange: (event) => setDirectoryFilters((current) => ({ ...current, location: event.target.value })) }), _jsx("input", { placeholder: "Shift", value: directoryFilters.shift, onChange: (event) => setDirectoryFilters((current) => ({ ...current, shift: event.target.value })) })] }), _jsx("div", { className: "directoryList", children: directoryUsers.map((candidate) => {
                            const selected = selectedRecipientIds.includes(candidate.id);
                            const alreadyMember = members.some((member) => member.id === candidate.id);
                            return (_jsxs("div", { className: "directoryRow", children: [_jsxs("div", { children: [_jsx("strong", { children: candidate.displayName }), _jsx("div", { className: "helperText", children: candidate.roleNames?.join(", ") ?? candidate.id })] }), _jsxs("div", { className: "rowActions", children: [_jsx("button", { onClick: () => {
                                                    setSelectedRecipientIds((current) => selected ? current.filter((value) => value !== candidate.id) : [...current, candidate.id]);
                                                }, children: selected ? "Unselect" : "Select" }), activeRoomId ? (alreadyMember ? (_jsx("button", { onClick: () => {
                                                    void removeParticipant(userId, activeRoomId, candidate.id).then(async () => {
                                                        await refreshActiveRoomData(activeRoomId);
                                                        await refreshRooms(activeRoomId);
                                                    });
                                                }, children: "Remove" })) : (_jsx("button", { onClick: () => {
                                                    void addParticipants(userId, activeRoomId, [candidate.id]).then(async () => {
                                                        await refreshActiveRoomData(activeRoomId);
                                                        await refreshRooms(activeRoomId);
                                                    });
                                                }, children: "Add" }))) : null] })] }, candidate.id));
                        }) }), activeRoomId ? (_jsx("button", { onClick: () => {
                            void updateAssignmentMembership(userId, activeRoomId, Array.from(new Set([userId, ...selectedRecipientIds]))).then(async () => {
                                await refreshActiveRoomData(activeRoomId);
                                await refreshRooms(activeRoomId);
                            });
                        }, children: "Apply selection as assignment" })) : null, _jsx("div", { className: "sectionTitle", children: "Members" }), members.map((member) => (_jsxs("div", { className: "memberRow", children: [_jsx("span", { children: member.displayName }), _jsx("span", { className: `presence ${member.presence}`, children: member.presence })] }, member.id))), _jsx("div", { className: "sectionTitle", children: "Templates" }), _jsx("div", { className: "templateList", children: templates.map((template) => (_jsx("button", { className: "templateItem", onClick: () => {
                                setTemplateDraft({
                                    id: template.id,
                                    title: template.title,
                                    body: template.body,
                                    scopeType: template.scopeType,
                                    scopeId: template.scopeId,
                                    active: template.active
                                });
                                setComposerValue(template.body);
                            }, children: template.title }, template.id))) }), _jsx("input", { placeholder: "Template title", value: templateDraft.title, onChange: (event) => setTemplateDraft((current) => ({ ...current, title: event.target.value })) }), _jsx("textarea", { value: templateDraft.body, onChange: (event) => setTemplateDraft((current) => ({ ...current, body: event.target.value })), placeholder: "Template body" }), _jsxs("div", { className: "compactGrid", children: [_jsxs("select", { value: templateDraft.scopeType, onChange: (event) => setTemplateDraft((current) => ({ ...current, scopeType: event.target.value })), children: [_jsx("option", { value: "tenant", children: "Tenant" }), _jsx("option", { value: "site", children: "Site" }), _jsx("option", { value: "unit", children: "Unit" }), _jsx("option", { value: "department", children: "Department" }), _jsx("option", { value: "team", children: "Team" })] }), _jsx("input", { placeholder: "Scope id", value: templateDraft.scopeId, onChange: (event) => setTemplateDraft((current) => ({ ...current, scopeId: event.target.value })) })] }), _jsx("button", { onClick: () => void handleSaveTemplate(), children: templateDraft.id ? "Update template" : "Create template" }), _jsx("div", { className: "sectionTitle", children: "Audit" }), _jsx("div", { className: "auditList", children: auditEvents.map((event) => (_jsxs("div", { className: "auditRow", children: [_jsx("strong", { children: event.eventType }), _jsx("span", { children: new Date(event.occurredUtc).toLocaleTimeString() })] }, event.id))) })] })] }));
}
