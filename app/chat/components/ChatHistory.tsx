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
    <section className="mt-6 rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-4 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            History
          </h2>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {messages.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          disabled={!hasMessages}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Clear Chat
        </button>
      </div>

      {!hasMessages ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white/70 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          No messages yet. Your chat history will appear here.
        </div>
      ) : (
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {messages.map((msg, index) => (
            <article
              key={`${index}-${msg.slice(0, 10)}`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {msg}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
