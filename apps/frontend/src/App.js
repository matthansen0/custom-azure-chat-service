import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { ActivityBar } from "./components/ActivityBar.js";
import { ActivityView } from "./components/ActivityView.js";
import { ChatList } from "./components/ChatList.js";
import { ConversationView } from "./components/ConversationView.js";
import { EmergencyOverlay } from "./components/EmergencyOverlay.js";
import { MembersPanel } from "./components/MembersPanel.js";
import { NewChatDialog } from "./components/NewChatDialog.js";
import { TeamsView } from "./components/TeamsView.js";
import { UserSwitcher } from "./components/UserSwitcher.js";
import { useChat } from "./hooks/useChat.js";
export function App() {
    const chat = useChat();
    const [activeNav, setActiveNav] = useState("chat");
    const [showMembers, setShowMembers] = useState(true);
    const [showNewChat, setShowNewChat] = useState(false);
    const typingUsers = useMemo(() => Object.keys(chat.typingByUser).filter((id) => id !== chat.userId && chat.typingByUser[id] > Date.now()), [chat.typingByUser, chat.userId]);
    const handleNavSelectRoom = (roomId) => {
        chat.selectRoom(roomId);
        setActiveNav("chat");
    };
    return (_jsxs("div", { className: "teams-layout", children: [_jsx(ActivityBar, { connectionStatus: chat.connectionStatus, activeNav: activeNav, onNavChange: setActiveNav }), _jsxs("div", { className: "teams-sidebar", children: [_jsx(UserSwitcher, { userId: chat.userId, onSwitch: (id) => void chat.switchUser(id) }), activeNav === "chat" && (_jsx(ChatList, { rooms: chat.rooms, activeRoomId: chat.activeRoomId, userId: chat.userId, onSelectRoom: chat.selectRoom, onNewChat: () => setShowNewChat(true) })), activeNav === "teams" && (_jsx(TeamsView, { rooms: chat.rooms, userId: chat.userId, onSelectRoom: handleNavSelectRoom })), activeNav === "activity" && (_jsx(ActivityView, { rooms: chat.rooms, userId: chat.userId, onSelectRoom: handleNavSelectRoom, mentions: chat.mentionFeed, onClearMentions: chat.clearMentions }))] }), _jsx("div", { className: "teams-main", children: chat.activeRoom ? (_jsx(ConversationView, { roomName: chat.activeRoom.name, roomType: chat.activeRoom.type, messages: chat.messages, members: chat.members, userId: chat.userId, typingUsers: typingUsers, onSend: chat.send, onEdit: chat.editMessage, onDelete: chat.removeMessage, onReact: chat.react, onUnreact: chat.unreact, onMarkRead: chat.markAsRead, onTyping: chat.startTyping, onToggleMembers: () => setShowMembers((v) => !v), showMembers: showMembers })) : (_jsx("div", { className: "teams-empty", children: _jsxs("div", { className: "teams-empty__content", children: [_jsx("h2", { children: "Welcome to Teams Chat" }), _jsx("p", { children: "Select a conversation or start a new chat" })] }) })) }), showMembers && chat.activeRoom && (_jsx("div", { className: "teams-detail", children: _jsx(MembersPanel, { members: chat.members, userId: chat.userId }) })), showNewChat && (_jsx(NewChatDialog, { currentUserId: chat.userId, onClose: () => setShowNewChat(false), onCreate: chat.newRoom })), chat.emergencyAlert && (_jsx(EmergencyOverlay, { alert: chat.emergencyAlert, senderName: chat.members.find((m) => m.id === chat.emergencyAlert.actorUserId)?.displayName ??
                    chat.emergencyAlert.actorUserId, onDismiss: chat.dismissEmergency, onGoToRoom: () => {
                    chat.selectRoom(chat.emergencyAlert.roomId);
                    setActiveNav("chat");
                    chat.dismissEmergency();
                } }))] }));
}
