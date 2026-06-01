import { useMemo, useRef, useState } from "react";
import type { User } from "../types.js";

export interface SendOptions {
  mentions: string[];
  mentionEveryone: boolean;
  priority?: "low" | "normal" | "high" | "urgent";
  replyToMessageId?: string;
}

export interface ReplyTarget {
  messageId: string;
  senderName: string;
  content: string;
}

interface ComposerProps {
  onSend: (content: string, options: SendOptions) => Promise<void>;
  onTyping: () => Promise<void>;
  members: User[];
  currentUserId: string;
  replyingTo?: ReplyTarget | null;
  onCancelReply?: () => void;
}

interface MentionToken {
  start: number;
  end: number;
  query: string;
}

const EVERYONE_ID = "@everyone";

export function Composer({ onSend, onTyping, members, currentUserId, replyingTo, onCancelReply }: ComposerProps) {
  const [value, setValue] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [mentionToken, setMentionToken] = useState<MentionToken | null>(null);
  const [resolvedMentions, setResolvedMentions] = useState<Record<string, string>>({});
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const candidates = useMemo<Array<{ id: string; label: string; isEveryone?: boolean }>>(() => {
    const others = members.filter((m) => m.id !== currentUserId);
    if (!mentionToken) return [];
    const q = mentionToken.query.toLowerCase();
    const matches: Array<{ id: string; label: string; isEveryone?: boolean }> = others
      .filter((m) => m.displayName.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 6)
      .map((m) => ({ id: m.id, label: m.displayName }));
    const everyone: Array<{ id: string; label: string; isEveryone?: boolean }> =
      "everyone".includes(q) || q === ""
        ? [{ id: EVERYONE_ID, label: "everyone", isEveryone: true }]
        : [];
    return [...everyone, ...matches];
  }, [members, currentUserId, mentionToken]);

  const detectMention = (text: string, caret: number): MentionToken | null => {
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
      if (/\s/.test(ch)) return null;
      i -= 1;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    const caret = e.target.selectionStart ?? next.length;
    const token = detectMention(next, caret);
    setMentionToken(token);
    setPickerIndex(0);

    if (!typingTimeout.current) {
      void onTyping();
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      typingTimeout.current = null;
    }, 2000);
  };

  const applyMention = (candidate: { id: string; label: string; isEveryone?: boolean }) => {
    if (!mentionToken) return;
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (!content) return;

    // Resolve mentions present in final content.
    const mentions: string[] = [];
    let mentionEveryone = false;
    const usedTokens = new Set<string>();
    for (const [token, id] of Object.entries(resolvedMentions)) {
      if (content.includes(token)) {
        usedTokens.add(token);
        if (id === EVERYONE_ID) {
          mentionEveryone = true;
        } else if (!mentions.includes(id)) {
          mentions.push(id);
        }
      }
    }
    // Fallback: any @everyone literal triggers everyone mention even without picker.
    if (/(^|\s)@everyone\b/i.test(content)) mentionEveryone = true;

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
    if (onCancelReply) onCancelReply();
  };

  return (
    <div className="composer">
      {replyingTo && (
        <div className="composer__reply-banner">
          <div className="composer__reply-bar" />
          <div className="composer__reply-body">
            <div className="composer__reply-label">
              Replying to <strong>{replyingTo.senderName}</strong>
            </div>
            <div className="composer__reply-preview">
              {replyingTo.content.length > 120 ? `${replyingTo.content.slice(0, 120)}…` : replyingTo.content}
            </div>
          </div>
          <button
            type="button"
            className="composer__reply-cancel"
            onClick={onCancelReply}
            title="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}
      <div className="composer__toolbar">
        <button className="composer__tool-btn" title="Format">
          <span>A</span>
        </button>
        <button className="composer__tool-btn" title="Attach">
          📎
        </button>
        <button className="composer__tool-btn" title="Emoji">
          😊
        </button>
        <button
          className={`composer__tool-btn ${emergency ? "composer__tool-btn--emergency-on" : ""}`}
          title={emergency ? "Emergency on — message will alert recipients" : "Mark as emergency"}
          onClick={() => setEmergency((v) => !v)}
        >
          🚨
        </button>
      </div>
      {mentionToken && candidates.length > 0 && (
        <div className="composer__mention-picker" role="listbox">
          {candidates.map((c, idx) => (
            <button
              key={c.id}
              role="option"
              aria-selected={idx === pickerIndex}
              className={`composer__mention-option ${idx === pickerIndex ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                applyMention(c);
              }}
            >
              <span className="composer__mention-avatar">
                {c.isEveryone ? "@" : c.label.charAt(0).toUpperCase()}
              </span>
              <span className="composer__mention-label">
                {c.isEveryone ? "everyone" : c.label}
              </span>
              {c.isEveryone && (
                <span className="composer__mention-hint">Notify everyone in this chat</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className={`composer__input-row ${emergency ? "composer__input-row--emergency" : ""}`}>
        <textarea
          ref={textareaRef}
          className="composer__textarea"
          placeholder={emergency ? "Emergency message — alerts will fire on send" : "Type a new message... (use @ to mention)"}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="composer__send-btn"
          onClick={handleSend}
          disabled={!value.trim()}
          title="Send"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 10L17 3L13 10L17 17L3 10Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
