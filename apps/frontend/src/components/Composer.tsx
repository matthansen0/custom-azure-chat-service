import { useRef, useState } from "react";

interface ComposerProps {
  onSend: (content: string) => Promise<void>;
  onTyping: () => Promise<void>;
}

export function Composer({ onSend, onTyping }: ComposerProps) {
  const [value, setValue] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (!typingTimeout.current) {
      void onTyping();
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      typingTimeout.current = null;
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!value.trim()) return;
    void onSend(value.trim());
    setValue("");
  };

  return (
    <div className="composer">
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
      </div>
      <div className="composer__input-row">
        <textarea
          className="composer__textarea"
          placeholder="Type a new message..."
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
