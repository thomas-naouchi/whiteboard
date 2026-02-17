"use client";

interface ChatHistoryProps {
  messages: string[];
  onClearHistory: () => void;
}

export default function ChatHistory({
  messages,
  onClearHistory,
}: ChatHistoryProps) {
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
          No messages yet. Your chat history will appear here.
        </div>
      ) : (
        <div className="chat-history-list">
          {messages.map((msg, index) => (
            <article
              key={`${index}-${msg.slice(0, 10)}`}
              className="chat-history-item"
            >
              {msg}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
