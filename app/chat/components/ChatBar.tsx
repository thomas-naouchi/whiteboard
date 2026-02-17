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
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <label
        htmlFor="chat-message-input"
        className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Ask a question
      </label>

      <div className="flex items-end gap-3">
        <textarea
          id="chat-message-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question here..."
          rows={3}
          disabled={isSending}
          className="min-h-[92px] flex-1 resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-700"
        />

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isSending || message.trim().length === 0}
          className="h-[42px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <p className="text-zinc-500 dark:text-zinc-400">
          Press Enter to send, Shift+Enter for a new line.
        </p>
        <p className="text-zinc-500 dark:text-zinc-400">
          {message.trim().length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
