import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
export function EmergencyOverlay({ alert, senderName, onDismiss, onGoToRoom }) {
    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape")
                onDismiss();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onDismiss]);
    return (_jsx("div", { className: "emergency-overlay", role: "alertdialog", "aria-modal": "true", "aria-label": "Emergency alert", children: _jsxs("div", { className: "emergency-overlay__box", children: [_jsx("div", { className: "emergency-overlay__siren", children: "\uD83D\uDEA8" }), _jsx("h1", { className: "emergency-overlay__title", children: "EMERGENCY" }), _jsxs("div", { className: "emergency-overlay__meta", children: [_jsxs("span", { className: "emergency-overlay__from", children: ["From ", senderName] }), _jsxs("span", { className: "emergency-overlay__room", children: ["in ", alert.roomName] })] }), _jsx("p", { className: "emergency-overlay__content", children: alert.content }), _jsxs("div", { className: "emergency-overlay__actions", children: [_jsx("button", { className: "emergency-overlay__btn emergency-overlay__btn--primary", onClick: onGoToRoom, children: "Open conversation" }), _jsx("button", { className: "emergency-overlay__btn", onClick: onDismiss, children: "Dismiss" })] })] }) }));
}
