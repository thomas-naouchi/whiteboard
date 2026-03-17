"use client";

import { useEffect, useState } from "react";
import ChatBar from "./components/ChatBar";
import ChatHistory, { type ChatMessage } from "./components/ChatHistory";
import type { UploadedFile } from "./types";
import "./chat.css";

const SESSION_STORAGE_KEY = "whiteboard-session-id";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [persistedDocText, setPersistedDocText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  /**
   * On mount: restore previous session from localStorage
   */
  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      setSessionId(stored);
      fetch(`/api/session/messages?sessionId=${encodeURIComponent(stored)}`)
        .then((res) => res.json())
        .then((data: { messages?: Array<{ id: string; role: string; content: string }> }) => {
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(
              data.messages.map((m) => ({
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

  /**
   * Send a new message to the chat API.
   * Files are already uploaded to Supabase Storage at this point;
   * their parsed text is available in uploadedFiles[].text.
   */
  async function handleNewMessage(message: string, uploadedFiles: UploadedFile[]) {
    setIsSending(true);

    // Snapshot history before optimistic update
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    // Optimistically add user message to UI
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        attachments: uploadedFiles.map((f) => ({ name: f.fileName, size: f.size })),
      },
    ]);

    try {
      // Files loaded from the DB have text = "". Re-parse them from storage now.
      const filesWithText = await Promise.all(
        uploadedFiles.map(async (f) => {
          if (f.text !== "") return f;
          const res = await fetch("/api/chat/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storagePath: f.storagePath }),
          });
          if (!res.ok) return f;
          const data = (await res.json()) as { text: string };
          return { ...f, text: data.text };
        }),
      );

      // Build document text from already-parsed uploaded files
      const newDocText =
        filesWithText.length > 0
          ? filesWithText
              .map((f) => `# ${f.fileName}\n${f.text}`)
              .join("\n\n")
          : "";

      // Merge with previously accumulated document text
      const combinedDocText = newDocText
        ? persistedDocText
          ? `${persistedDocText}\n\n${newDocText}`
          : newDocText
        : persistedDocText;

      // Persist new document text for subsequent messages
      if (newDocText) {
        setPersistedDocText(combinedDocText);
      }

      // Call the chat API
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          documentText: combinedDocText,
          sessionId,
          uploadedFiles: uploadedFiles.map((f) => ({
            fileName: f.fileName,
            storagePath: f.storagePath,
            size: f.size,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error ||
            `Request failed: ${res.status}`,
        );
      }

      const data = (await res.json()) as {
        answer: string;
        sessionId?: string;
      };

      // Store the session ID in localStorage so history survives page reloads
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        window.localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
      }

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
    setSessionId(null);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return (
    <main className="chat-page">
      <header className="chat-page-header">
        <h1 className="chat-page-title">Whiteboard Chat</h1>
        <p className="chat-page-subtitle">
          Ask questions and review your recent prompts below.
        </p>
      </header>

      <ChatBar onSendMessage={handleNewMessage} isSending={isSending} sessionId={sessionId} />

      <ChatHistory
        messages={messages}
        onClearHistory={handleClearHistory}
        isLoading={historyLoading}
      />
    </main>
  );
}
