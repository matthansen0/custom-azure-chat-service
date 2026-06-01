import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const navItems = [
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "teams", icon: "👥", label: "Teams" },
    { id: "activity", icon: "🔔", label: "Activity" }
];
export function ActivityBar({ connectionStatus, activeNav, onNavChange }) {
    return (_jsxs("div", { className: "activity-bar", children: [_jsx("div", { className: "activity-bar__top", children: navItems.map((item) => (_jsxs("button", { className: `activity-bar__item ${activeNav === item.id ? "active" : ""}`, onClick: () => onNavChange(item.id), title: item.label, children: [_jsx("span", { className: "activity-bar__icon", children: item.icon }), _jsx("span", { className: "activity-bar__label", children: item.label })] }, item.id))) }), _jsx("div", { className: "activity-bar__bottom", children: _jsx("div", { className: `connection-dot ${connectionStatus}`, title: connectionStatus }) })] }));
}
