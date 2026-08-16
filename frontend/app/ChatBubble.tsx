"use client";

import { useEffect, useState } from "react";
import ChatWidget from "./ChatWidget";

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        className="chat-fab"
        onClick={onOpen}
        aria-label="Open The Deccan Sentinel chat"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
      >
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4.4 3.3A1 1 0 0 1 3 19.5V5a1 1 0 0 1 1-1Z"
          />
        </svg>
      </button>

      {open && (
        <div
          className="chat-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            className="chat-modal"
            role="dialog"
            aria-modal="true"
            aria-label="The Deccan Sentinel chat"
          >
            <div className="chat-modal-head">
              <strong>Ask the Sentinel</strong>
              <button
                className="chat-modal-close"
                onClick={onClose}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
            <ChatWidget />
          </div>
        </div>
      )}
    </>
  );
}
