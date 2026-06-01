import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from "react";
const EVERYONE_ID = "@everyone";
export function Composer({ onSend, onTyping, members, currentUserId, replyingTo, onCancelReply }) {
    const [value, setValue] = useState("");
    const [emergency, setEmergency] = useState(false);
    const [pickerIndex, setPickerIndex] = useState(0);
    const [mentionToken, setMentionToken] = useState(null);
    const [resolvedMentions, setResolvedMentions] = useState({});
    const typingTimeout = useRef(null);
    const textareaRef = useRef(null);
    const candidates = useMemo(() => {
        const others = members.filter((m) => m.id !== currentUserId);
        if (!mentionToken)
            return [];
        const q = mentionToken.query.toLowerCase();
        const matches = others
            .filter((m) => m.displayName.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
            .slice(0, 6)
            .map((m) => ({ id: m.id, label: m.displayName }));
        const everyone = "everyone".includes(q) || q === ""
            ? [{ id: EVERYONE_ID, label: "everyone", isEveryone: true }]
            : [];
        return [...everyone, ...matches];
    }, [members, currentUserId, mentionToken]);
    const detectMention = (text, caret) => {
        // Walk back from caret to find an unescaped @ on the current word boundary.
        let i = caret - 1;
        while (i >= 0) {
            const ch = text[i];
            if (ch === "@") {
                const before = i === 0 ? " " : text[i - 1];
                if (/\s/.test(before) || i === 0) {
                    return { start: i, end: caret, query: text.slice(i + 1, caret) };
                }
                return null;
            }
            if (/\s/.test(ch))
                return null;
            i -= 1;
        }
        return null;
    };
    const handleChange = (e) => {
        const next = e.target.value;
        setValue(next);
        const caret = e.target.selectionStart ?? next.length;
        const token = detectMention(next, caret);
        setMentionToken(token);
        setPickerIndex(0);
        if (!typingTimeout.current) {
            void onTyping();
        }
        if (typingTimeout.current)
            clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            typingTimeout.current = null;
        }, 2000);
    };
    const applyMention = (candidate) => {
        if (!mentionToken)
            return;
        const before = value.slice(0, mentionToken.start);
        const after = value.slice(mentionToken.end);
        const inserted = `@${candidate.label} `;
        const nextValue = `${before}${inserted}${after}`;
        setValue(nextValue);
        setMentionToken(null);
        setResolvedMentions((prev) => ({ ...prev, [`@${candidate.label}`]: candidate.id }));
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (el) {
                const caret = before.length + inserted.length;
                el.focus();
                el.setSelectionRange(caret, caret);
            }
        });
    };
    const handleKeyDown = (e) => {
        if (mentionToken && candidates.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setPickerIndex((i) => (i + 1) % candidates.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setPickerIndex((i) => (i - 1 + candidates.length) % candidates.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyMention(candidates[pickerIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setMentionToken(null);
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    const handleSend = () => {
        const content = value.trim();
        if (!content)
            return;
        // Resolve mentions present in final content.
        const mentions = [];
        let mentionEveryone = false;
        const usedTokens = new Set();
        for (const [token, id] of Object.entries(resolvedMentions)) {
            if (content.includes(token)) {
                usedTokens.add(token);
                if (id === EVERYONE_ID) {
                    mentionEveryone = true;
                }
                else if (!mentions.includes(id)) {
                    mentions.push(id);
                }
            }
        }
        // Fallback: any @everyone literal triggers everyone mention even without picker.
        if (/(^|\s)@everyone\b/i.test(content))
            mentionEveryone = true;
        void onSend(content, {
            mentions,
            mentionEveryone,
            priority: emergency ? "urgent" : undefined,
            replyToMessageId: replyingTo?.messageId
        });
        setValue("");
        setResolvedMentions({});
        setMentionToken(null);
        setEmergency(false);
        if (onCancelReply)
            onCancelReply();
    };
    return (_jsxs("div", { className: "composer", children: [replyingTo && (_jsxs("div", { className: "composer__reply-banner", children: [_jsx("div", { className: "composer__reply-bar" }), _jsxs("div", { className: "composer__reply-body", children: [_jsxs("div", { className: "composer__reply-label", children: ["Replying to ", _jsx("strong", { children: replyingTo.senderName })] }), _jsx("div", { className: "composer__reply-preview", children: replyingTo.content.length > 120 ? `${replyingTo.content.slice(0, 120)}…` : replyingTo.content })] }), _jsx("button", { type: "button", className: "composer__reply-cancel", onClick: onCancelReply, title: "Cancel reply", children: "\u2715" })] })), _jsxs("div", { className: "composer__toolbar", children: [_jsx("button", { className: "composer__tool-btn", title: "Format", children: _jsx("span", { children: "A" }) }), _jsx("button", { className: "composer__tool-btn", title: "Attach", children: "\uD83D\uDCCE" }), _jsx("button", { className: "composer__tool-btn", title: "Emoji", children: "\uD83D\uDE0A" }), _jsx("button", { className: `composer__tool-btn ${emergency ? "composer__tool-btn--emergency-on" : ""}`, title: emergency ? "Emergency on — message will alert recipients" : "Mark as emergency", onClick: () => setEmergency((v) => !v), children: "\uD83D\uDEA8" })] }), mentionToken && candidates.length > 0 && (_jsx("div", { className: "composer__mention-picker", role: "listbox", children: candidates.map((c, idx) => (_jsxs("button", { role: "option", "aria-selected": idx === pickerIndex, className: `composer__mention-option ${idx === pickerIndex ? "active" : ""}`, onMouseDown: (e) => {
                        e.preventDefault();
                        applyMention(c);
                    }, children: [_jsx("span", { className: "composer__mention-avatar", children: c.isEveryone ? "@" : c.label.charAt(0).toUpperCase() }), _jsx("span", { className: "composer__mention-label", children: c.isEveryone ? "everyone" : c.label }), c.isEveryone && (_jsx("span", { className: "composer__mention-hint", children: "Notify everyone in this chat" }))] }, c.id))) })), _jsxs("div", { className: `composer__input-row ${emergency ? "composer__input-row--emergency" : ""}`, children: [_jsx("textarea", { ref: textareaRef, className: "composer__textarea", placeholder: emergency ? "Emergency message — alerts will fire on send" : "Type a new message... (use @ to mention)", value: value, onChange: handleChange, onKeyDown: handleKeyDown, rows: 1 }), _jsx("button", { className: "composer__send-btn", onClick: handleSend, disabled: !value.trim(), title: "Send", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 20 20", fill: "none", children: _jsx("path", { d: "M3 10L17 3L13 10L17 17L3 10Z", fill: "currentColor" }) }) })] })] }));
}
