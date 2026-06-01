import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const availableUsers = [
    { id: "u1", name: "Alex" },
    { id: "u2", name: "Jordan" },
    { id: "u3", name: "Sam" }
];
export function NewChatDialog({ currentUserId, onClose, onCreate }) {
    const [name, setName] = useState("");
    const [type, setType] = useState("group");
    const [selectedIds, setSelectedIds] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const otherUsers = availableUsers.filter((u) => u.id !== currentUserId);
    const toggleUser = (id) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };
    const handleCreate = async () => {
        if (!name.trim() || selectedIds.length === 0 || isCreating)
            return;
        setIsCreating(true);
        try {
            const allParticipants = Array.from(new Set([currentUserId, ...selectedIds]));
            await onCreate(name, type, allParticipants);
            onClose();
        }
        finally {
            setIsCreating(false);
        }
    };
    return (_jsx("div", { className: "dialog-overlay", onClick: onClose, children: _jsxs("div", { className: "dialog", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "dialog__header", children: [_jsx("h3", { children: "New Chat" }), _jsx("button", { className: "dialog__close", onClick: onClose, children: "\u2715" })] }), _jsxs("div", { className: "dialog__body", children: [_jsxs("label", { className: "dialog__label", children: ["Chat name", _jsx("input", { className: "dialog__input", value: name, onChange: (e) => setName(e.target.value), placeholder: "Enter a name...", autoFocus: true })] }), _jsxs("label", { className: "dialog__label", children: ["Type", _jsxs("select", { className: "dialog__select", value: type, onChange: (e) => setType(e.target.value), children: [_jsx("option", { value: "group", children: "Group" }), _jsx("option", { value: "direct", children: "Direct Message" }), _jsx("option", { value: "announcement", children: "Announcement" })] })] }), _jsxs("div", { className: "dialog__label", children: ["Add people", _jsx("div", { className: "dialog__user-list", children: otherUsers.map((u) => (_jsxs("label", { className: "dialog__user-option", children: [_jsx("input", { type: "checkbox", checked: selectedIds.includes(u.id), onChange: () => toggleUser(u.id) }), _jsx("span", { children: u.name })] }, u.id))) })] })] }), _jsxs("div", { className: "dialog__footer", children: [_jsx("button", { className: "btn btn-secondary", onClick: onClose, children: "Cancel" }), _jsx("button", { className: "btn btn-primary", onClick: () => void handleCreate(), disabled: !name.trim() || selectedIds.length === 0 || isCreating, children: isCreating ? "Creating..." : "Create" })] })] }) }));
}
