import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
export function Composer({ onSend, onTyping }) {
    const [value, setValue] = useState("");
    const typingTimeout = useRef(null);
    const handleChange = (e) => {
        setValue(e.target.value);
        if (!typingTimeout.current) {
            void onTyping();
        }
        if (typingTimeout.current)
            clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            typingTimeout.current = null;
        }, 2000);
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    const handleSend = () => {
        if (!value.trim())
            return;
        void onSend(value.trim());
        setValue("");
    };
    return (_jsxs("div", { className: "composer", children: [_jsxs("div", { className: "composer__toolbar", children: [_jsx("button", { className: "composer__tool-btn", title: "Format", children: _jsx("span", { children: "A" }) }), _jsx("button", { className: "composer__tool-btn", title: "Attach", children: "\uD83D\uDCCE" }), _jsx("button", { className: "composer__tool-btn", title: "Emoji", children: "\uD83D\uDE0A" })] }), _jsxs("div", { className: "composer__input-row", children: [_jsx("textarea", { className: "composer__textarea", placeholder: "Type a new message...", value: value, onChange: handleChange, onKeyDown: handleKeyDown, rows: 1 }), _jsx("button", { className: "composer__send-btn", onClick: handleSend, disabled: !value.trim(), title: "Send", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 20 20", fill: "none", children: _jsx("path", { d: "M3 10L17 3L13 10L17 17L3 10Z", fill: "currentColor" }) }) })] })] }));
}
