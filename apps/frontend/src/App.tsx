import { useMemo, useState } from "react";
import { ActivityBar } from "./components/ActivityBar.js";
import { ActivityView } from "./components/ActivityView.js";
import { ChatList } from "./components/ChatList.js";
import { ConversationView } from "./components/ConversationView.js";
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

  const typingUsers = useMemo(
    () =>
      Object.keys(chat.typingByUser).filter(
        (id) => id !== chat.userId && chat.typingByUser[id] > Date.now()
      ),
    [chat.typingByUser, chat.userId]
  );

  const handleNavSelectRoom = (roomId: string) => {
    chat.selectRoom(roomId);
    setActiveNav("chat");
  };

  return (
    <div className="teams-layout">
      <ActivityBar
        connectionStatus={chat.connectionStatus}
        activeNav={activeNav}
        onNavChange={setActiveNav}
      />

      <div className="teams-sidebar">
        <UserSwitcher userId={chat.userId} onSwitch={(id) => void chat.switchUser(id)} />
        {activeNav === "chat" && (
          <ChatList
            rooms={chat.rooms}
            activeRoomId={chat.activeRoomId}
            userId={chat.userId}
            onSelectRoom={chat.selectRoom}
            onNewChat={() => setShowNewChat(true)}
          />
        )}
        {activeNav === "teams" && (
          <TeamsView
            rooms={chat.rooms}
            userId={chat.userId}
            onSelectRoom={handleNavSelectRoom}
          />
        )}
        {activeNav === "activity" && (
          <ActivityView
            rooms={chat.rooms}
            userId={chat.userId}
            onSelectRoom={handleNavSelectRoom}
          />
        )}
      </div>

      <div className="teams-main">
        {chat.activeRoom ? (
          <ConversationView
            roomName={chat.activeRoom.name}
            roomType={chat.activeRoom.type}
            messages={chat.messages}
            members={chat.members}
            userId={chat.userId}
            typingUsers={typingUsers}
            onSend={chat.send}
            onEdit={chat.editMessage}
            onDelete={chat.removeMessage}
            onReact={chat.react}
            onUnreact={chat.unreact}
            onTyping={chat.startTyping}
            onToggleMembers={() => setShowMembers((v) => !v)}
            showMembers={showMembers}
          />
        ) : (
          <div className="teams-empty">
            <div className="teams-empty__content">
              <h2>Welcome to Teams Chat</h2>
              <p>Select a conversation or start a new chat</p>
            </div>
          </div>
        )}
      </div>

      {showMembers && chat.activeRoom && (
        <div className="teams-detail">
          <MembersPanel members={chat.members} userId={chat.userId} />
        </div>
      )}

      {showNewChat && (
        <NewChatDialog
          currentUserId={chat.userId}
          onClose={() => setShowNewChat(false)}
          onCreate={chat.newRoom}
        />
      )}
    </div>
  );
}

