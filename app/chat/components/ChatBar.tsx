"use client";

import { useState, type KeyboardEvent } from "react";

interface ChatBarProps {
  onSendMessage: (message: string) => void | Promise<void>;
  isSending: boolean;
}

const MAX_MESSAGE_LENGTH = 500;

export default function ChatBar({ onSendMessage, isSending }: ChatBarProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = message.trim();

    if (!trimmed) {
      setError("Please type a question before sending.");
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    setError(null);
    await onSendMessage(trimmed);
    setMessage("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending) {
        void handleSend();
      }
    }
  }

  return (
    <div className="chat-bar">
      <label htmlFor="chat-message-input" className="chat-bar-label">
        Ask a question
      </label>

      <div className="chat-bar-row">
        <textarea
          id="chat-message-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question here..."
          rows={3}
          disabled={isSending}
          className="chat-bar-textarea"
        />

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isSending || message.trim().length === 0}
          className="chat-bar-send"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>

      <div className="chat-bar-meta">
        <p>
          Press Enter to send, Shift+Enter for a new line.
        </p>
        <p>
          {message.trim().length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>

      {error && (
        <p className="chat-bar-error">{error}</p>
      )}
    </div>
  );
}
