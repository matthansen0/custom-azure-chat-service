import type { ConnectionStatus } from "../realtime.js";

const navItems = [
  { id: "chat", icon: "💬", label: "Chat" },
  { id: "teams", icon: "👥", label: "Teams" },
  { id: "activity", icon: "🔔", label: "Activity" }
];

interface ActivityBarProps {
  connectionStatus: ConnectionStatus;
  activeNav: string;
  onNavChange: (id: string) => void;
}

export function ActivityBar({ connectionStatus, activeNav, onNavChange }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <div className="activity-bar__top">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`activity-bar__item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => onNavChange(item.id)}
            title={item.label}
          >
            <span className="activity-bar__icon">{item.icon}</span>
            <span className="activity-bar__label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="activity-bar__bottom">
        <div className={`connection-dot ${connectionStatus}`} title={connectionStatus} />
      </div>
    </div>
  );
}
