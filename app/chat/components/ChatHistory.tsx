"use client";

import { useCallback, useState } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{
    name: string;
    size: number;
  }>;
  suggestedFollowUps?: string[];
}

interface ChatHistoryProps {
  messages: ChatMessage[];
  onClearHistory: () => void;
  onSuggestionClick?: (text: string) => void;
  isLoading?: boolean;
  isThinking?: boolean;
  thinkingFileCount?: number;
}

export default function ChatHistory({
  messages,
  onClearHistory,
  onSuggestionClick,
  isLoading = false,
  isThinking = false,
  thinkingFileCount = 0,
}: ChatHistoryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      setCopiedId(null);
    }
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <section className="chat-history">
      <div className="chat-history-header">
        <div className="chat-history-header-left">
          <h2 className="chat-history-title">
            History
          </h2>
          <span className="chat-history-count">
            {messages.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          disabled={!hasMessages}
          className="chat-history-clear"
        >
          Clear Chat
        </button>
      </div>

      {!hasMessages ? (
        <div className="chat-history-empty">
          {isLoading
            ? "Loading history..."
            : "No messages yet. Upload a file and ask your first question."}
        </div>
      ) : (
        <div className="chat-history-list">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-history-row ${
                msg.role === "user"
                  ? "chat-history-row-user"
                  : "chat-history-row-assistant"
              }`}
            >
              <article
                className={`chat-history-item ${
                  msg.role === "user"
                    ? "chat-history-item-user"
                    : "chat-history-item-assistant"
                }`}
              >
                <div className="chat-history-item-content">
                  <p className="chat-history-message">{msg.content}</p>
                  {msg.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => void handleCopy(msg)}
                      className="chat-history-copy"
                      title={copiedId === msg.id ? "Copied" : "Copy response"}
                    >
                      {copiedId === msg.id ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <ul className="chat-history-attachments">
                    {msg.attachments.map((file, index) => (
                      <li key={`${msg.id}-file-${index}`}>
                        {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                      </li>
                    ))}
                  </ul>
                )}
                {msg.role === "assistant" &&
                  msg.suggestedFollowUps &&
                  msg.suggestedFollowUps.length > 0 && (
                    <div className="chat-history-suggestions">
                      {msg.suggestedFollowUps.map((suggestion) => (
                        <button
                          key={`${msg.id}-${suggestion}`}
                          type="button"
                          onClick={() => onSuggestionClick?.(suggestion)}
                          className="chat-history-suggestion"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
              </article>
            </div>
          ))}

          {isThinking && (
            <div className="chat-history-row chat-history-row-assistant">
              <article className="chat-history-item chat-history-item-assistant chat-history-item-thinking">
                <div className="chat-history-thinking-topline">
                  <span className="chat-history-thinking-badge">Whiteboard</span>
                  <span className="chat-history-thinking-caption">
                    {thinkingFileCount > 0
                      ? `Reading ${thinkingFileCount} selected file${thinkingFileCount === 1 ? "" : "s"}`
                      : "Reviewing the selected file context"}
                  </span>
                </div>

                <div className="chat-history-thinking-visual" aria-hidden="true">
                  <span className="chat-history-thinking-sheet chat-history-thinking-sheet-1" />
                  <span className="chat-history-thinking-sheet chat-history-thinking-sheet-2" />
                  <span className="chat-history-thinking-sheet chat-history-thinking-sheet-3" />
                </div>

                <div className="chat-history-thinking-copy">
                  <p>Understanding your files</p>
                  <div className="chat-history-thinking-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </article>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
