"use client";

import { useEffect, useState } from "react";
import ChatBar from "./components/ChatBar";
import ChatHistory, { type ChatMessage } from "./components/ChatHistory";
import "./chat.css";

// Converts uploaded text files into a single document string
async function filesToDocumentText(files: File[]) {
  const txtFiles = files.filter((f) => f.name.toLowerCase().endsWith(".txt"));

  const parts = await Promise.all(
    txtFiles.map(async (f) => `# ${f.name}\n${await f.text()}`),
  );

  return parts.join("\n\n");
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [persistedDocText, setPersistedDocText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  /**
   * Load previous session history if one exists
   */
  useEffect(() => {
    const stored = window.localStorage.getItem("whiteboard-session-id");

    if (stored) {
      setSessionId(stored);

      fetch(`/api/session/messages?sessionId=${encodeURIComponent(stored)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(
              data.messages.map(
                (m: { id: string; role: string; content: string }) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: m.content,
                }),
              ),
            );
          }
        })
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    } else {
      setHistoryLoading(false);
    }
  }, []);

  /**
   * Send new message
   */
  async function handleNewMessage(message: string, files: File[]) {
    setIsSending(true);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    /**
     * Immediately show user message
     */
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
      /**
       * Convert .txt files to document text
       */
      const newDocText = await filesToDocumentText(files);

      const combinedDocText = newDocText
        ? persistedDocText
          ? `${persistedDocText}\n\n${newDocText}`
          : newDocText
        : persistedDocText;

      if (newDocText) {
        setPersistedDocText(combinedDocText);
      }

      /**
       * Build FormData for API
       */
      const formData = new FormData();

      formData.append("message", message);
      formData.append("history", JSON.stringify(history));
      formData.append("persistedDocumentText", combinedDocText);

      if (sessionId) {
        formData.append("sessionId", sessionId);
      }

      for (const file of files) {
        formData.append("files", file);
      }

      /**
       * Send request to backend
       */
      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${res.status}`);
      }

      const data = await res.json();

      /**
       * Update document context
       */
      if (typeof data.documentText === "string") {
        setPersistedDocText(data.documentText);
      }

      /**
       * Save session id
       */
      if (typeof data.sessionId === "string" && data.sessionId.length > 0) {
        setSessionId(data.sessionId);
        window.localStorage.setItem("whiteboard-session-id", data.sessionId);
      }

      /**
       * Handle Supabase warning
       */
      if (typeof data.supabaseWarning === "string" && data.supabaseWarning) {
        setSupabaseWarning(data.supabaseWarning);
      } else {
        setSupabaseWarning(null);
      }

      /**
       * Add assistant response
       */
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer ?? "(no answer)",
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

  /**
   * Clear chat history and session
   */
  function handleClearHistory() {
    setMessages([]);
    setPersistedDocText("");
    setSupabaseWarning(null);
    setSessionId(null);

    window.localStorage.removeItem("whiteboard-session-id");
  }

  return (
    <main className="chat-page">
      <header className="chat-page-header">
        <h1 className="chat-page-title">Whiteboard Chat</h1>

        <p className="chat-page-subtitle">
          Ask questions and review your recent prompts below.
        </p>
      </header>

      {supabaseWarning && (
        <p className="chat-page-supabase-warning" role="alert">
          Chat saved locally only. Supabase: {supabaseWarning}
        </p>
      )}

      <ChatBar onSendMessage={handleNewMessage} isSending={isSending} />

      <ChatHistory
        messages={messages}
        onClearHistory={handleClearHistory}
        isLoading={historyLoading}
      />
    </main>
  );
}
