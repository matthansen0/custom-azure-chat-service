import { useState } from "react";
import type { Room } from "../types.js";

interface NewChatDialogProps {
  currentUserId: string;
  onClose: () => void;
  onCreate: (name: string, type: Room["type"], participantIds: string[]) => Promise<void>;
}

const availableUsers = [
  { id: "u1", name: "Alex" },
  { id: "u2", name: "Jordan" },
  { id: "u3", name: "Sam" }
];

export function NewChatDialog({ currentUserId, onClose, onCreate }: NewChatDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Room["type"]>("group");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const otherUsers = availableUsers.filter((u) => u.id !== currentUserId);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.length === 0 || isCreating) return;
    setIsCreating(true);
    try {
      const allParticipants = Array.from(new Set([currentUserId, ...selectedIds]));
      await onCreate(name, type, allParticipants);
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <h3>New Chat</h3>
          <button className="dialog__close" onClick={onClose}>✕</button>
        </div>
        <div className="dialog__body">
          <label className="dialog__label">
            Chat name
            <input
              className="dialog__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name..."
              autoFocus
            />
          </label>

          <label className="dialog__label">
            Type
            <select className="dialog__select" value={type} onChange={(e) => setType(e.target.value as Room["type"])}>
              <option value="group">Group</option>
              <option value="direct">Direct Message</option>
              <option value="announcement">Announcement</option>
            </select>
          </label>

          <div className="dialog__label">
            Add people
            <div className="dialog__user-list">
              {otherUsers.map((u) => (
                <label key={u.id} className="dialog__user-option">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                  />
                  <span>{u.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="dialog__footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => void handleCreate()}
            disabled={!name.trim() || selectedIds.length === 0 || isCreating}
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
