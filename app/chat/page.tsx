"use client";

import { useEffect, useState } from "react";
import ChatBar, { type ChatUploadItem } from "./components/ChatBar";
import ChatHistory, { type ChatMessage } from "./components/ChatHistory";
import "./chat.css";

const SESSION_KEY = "whiteboard-session-id";
const MAX_CONTEXT_MESSAGES = 12;
const MAX_CONTEXT_CHARACTERS = 12_000;

function buildContextWindow(messages: ChatMessage[]) {
  const selected: Array<{ role: "user" | "assistant"; content: string }> = [];
  let totalChars = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const nextChars = totalChars + msg.content.length;

    if (selected.length >= MAX_CONTEXT_MESSAGES || nextChars > MAX_CONTEXT_CHARACTERS) {
      break;
    }

    selected.unshift({
      role: msg.role,
      content: msg.content,
    });
    totalChars = nextChars;
  }

  return selected;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [persistedDocText, setPersistedDocText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<ChatUploadItem[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);

    if (stored) {
      setSessionId(stored);

      fetch(`/api/session/messages?sessionId=${encodeURIComponent(stored)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(
              data.messages.map((m: { id: string; role: string; content: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
              })),
            );
          }
        })
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    } else {
      setHistoryLoading(false);
    }
  }, []);

  async function handleNewMessage(message: string, files: File[]) {
    setIsSending(true);

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        attachments: files.map((file) => ({
          name: file.name,
          size: file.size,
        })),
      },
    ]);

    try {
      const history = buildContextWindow(messages);
      const formData = new FormData();
      formData.append("message", message);
      formData.append("history", JSON.stringify(history));
      formData.append("persistedDocumentText", "");
      if (sessionId) {
        formData.append("sessionId", sessionId);
      }
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${res.status}`);
      }

      const data = await res.json();

      if (typeof data.documentText === "string") {
        setPersistedDocText(data.documentText);
      }
      if (typeof data.sessionId === "string" && data.sessionId.length > 0) {
        setSessionId(data.sessionId);
        window.localStorage.setItem(SESSION_KEY, data.sessionId);
      }
      if (typeof data.supabaseWarning === "string" && data.supabaseWarning) {
        setSupabaseWarning(data.supabaseWarning);
      } else {
        setSupabaseWarning(null);
      }
 
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer ?? "(no answer)",
          suggestedFollowUps: Array.isArray(data.suggestedFollowUps)
            ? data.suggestedFollowUps.filter((item: unknown) => typeof item === "string")
            : [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            err instanceof Error
              ? `Error: ${err.message}`
              : "Error: something went wrong.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSuggestionClick(text: string) {
    void handleNewMessage(text, []);
  }

  function handleClearHistory() {
    setMessages([]);
    setPersistedDocText("");
    setSupabaseWarning(null);
    setSessionId(null);
    setUploadedFiles([]);
    window.localStorage.removeItem(SESSION_KEY);
  }

  return (
    <main className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-brand">
          <div className="chat-sidebar-brand-badge">AI Active</div>
          <h1>Whiteboard</h1>
          <p>AI File System</p>
        </div>

        <nav className="chat-sidebar-nav">
          <a className="chat-sidebar-link" href="/">Home</a>
          <a className="chat-sidebar-link chat-sidebar-link-active" href="/chat">
            Chat about files
          </a>
        </nav>
      </aside>

      <section className="chat-main">
        <header className="chat-main-header">
          <p className="chat-main-chip">Classified</p>
          <div>
            <h2 className="chat-main-title">Chat about files</h2>
            <p className="chat-main-subtitle">
              Upload PDF, PPTX, or TXT files and ask grounded questions from your documents.
            </p>
          </div>
        </header>

        {!persistedDocText && (
          <div className="chat-hint-banner">
            Upload files, tick the ones you want to use, then ask your question.
          </div>
        )}

        {persistedDocText && (
          <div className="chat-status-row">
            <span className="chat-status-pill">
              Active file context ready for the next question
            </span>
          </div>
        )}

        {supabaseWarning && (
          <p className="chat-main-warning" role="alert">
            Chat saved locally only. Supabase warning: {supabaseWarning}
          </p>
        )}

        <div className="chat-stage">
          <ChatHistory
            messages={messages}
            onClearHistory={handleClearHistory}
            onSuggestionClick={handleSuggestionClick}
            isLoading={historyLoading}
            isThinking={isSending}
            thinkingFileCount={0}
          />
          <ChatBar
            onSendMessage={handleNewMessage}
            isSending={isSending}
            uploadedFiles={uploadedFiles}
            onUploadedFilesChange={setUploadedFiles}
          />
        </div>
      </section>
    </main>
  );
}
