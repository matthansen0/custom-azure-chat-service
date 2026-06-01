import { useEffect } from "react";
import type { EmergencyAlert } from "../hooks/useChat.js";

interface EmergencyOverlayProps {
  alert: EmergencyAlert;
  senderName: string;
  onDismiss: () => void;
  onGoToRoom: () => void;
}

export function EmergencyOverlay({ alert, senderName, onDismiss, onGoToRoom }: EmergencyOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  return (
    <div className="emergency-overlay" role="alertdialog" aria-modal="true" aria-label="Emergency alert">
      <div className="emergency-overlay__box">
        <div className="emergency-overlay__siren">🚨</div>
        <h1 className="emergency-overlay__title">EMERGENCY</h1>
        <div className="emergency-overlay__meta">
          <span className="emergency-overlay__from">From {senderName}</span>
          <span className="emergency-overlay__room">in {alert.roomName}</span>
        </div>
        <p className="emergency-overlay__content">{alert.content}</p>
        <div className="emergency-overlay__actions">
          <button className="emergency-overlay__btn emergency-overlay__btn--primary" onClick={onGoToRoom}>
            Open conversation
          </button>
          <button className="emergency-overlay__btn" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
