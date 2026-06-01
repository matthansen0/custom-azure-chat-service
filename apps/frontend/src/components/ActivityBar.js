import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const navItems = [
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "teams", icon: "👥", label: "Teams" },
    { id: "activity", icon: "🔔", label: "Activity" }
];
const statusLabels = {
    connected: "Connected",
    connecting: "Connecting…",
    disconnected: "Disconnected"
};
export function ActivityBar({ connectionStatus, activeNav, onNavChange }) {
    const [showStatus, setShowStatus] = useState(false);
    return (_jsxs("div", { className: "activity-bar", children: [_jsx("div", { className: "activity-bar__top", children: navItems.map((item) => (_jsxs("button", { className: `activity-bar__item ${activeNav === item.id ? "active" : ""}`, onClick: () => onNavChange(item.id), title: item.label, children: [_jsx("span", { className: "activity-bar__icon", children: item.icon }), _jsx("span", { className: "activity-bar__label", children: item.label })] }, item.id))) }), _jsx("div", { className: "activity-bar__bottom", children: _jsxs("button", { className: "connection-indicator", onClick: () => setShowStatus((v) => !v), title: statusLabels[connectionStatus], children: [_jsx("div", { className: `connection-dot ${connectionStatus}` }), showStatus && (_jsx("div", { className: "connection-popup", children: _jsx("span", { className: `connection-popup__status ${connectionStatus}`, children: statusLabels[connectionStatus] }) }))] }) })] }));
}
