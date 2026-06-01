import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const users = [
    { id: "u1", label: "Alex" },
    { id: "u2", label: "Jordan" },
    { id: "u3", label: "Sam" }
];
export function UserSwitcher({ userId, onSwitch }) {
    const current = users.find((u) => u.id === userId);
    const orgLabel = "Hospital Communications";
    return (_jsxs("div", { className: "user-switcher", children: [_jsxs("div", { className: "user-switcher__current", children: [_jsx("div", { className: "user-switcher__avatar", "aria-hidden": "true" }), _jsx("span", { className: "user-switcher__name", children: orgLabel })] }), _jsx("select", { className: "user-switcher__select", value: userId, onChange: (e) => onSwitch(e.target.value), children: users.map((u) => (_jsx("option", { value: u.id, children: u.label }, u.id))) })] }));
}
