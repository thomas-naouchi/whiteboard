"use client";

import { useEffect, useState } from "react";
import ChatBar from "./components/ChatBar";
import ChatHistory, { type ChatMessage } from "./components/ChatHistory";
import "./chat.css";


//transforms text files into one long string
async function filesToDocumentText(files: File[]) {
  const parts = await Promise.all(
    files.map(async (file) => {
      // TXT files
      if (file.name.toLowerCase().endsWith(".txt")) {
        return `# ${file.name}\n${await file.text()}`;
      }

      // PDF and PPTX files → send to parser API
      if (file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".pptx") ||
  file.name.toLowerCase().endsWith(".docx")) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/chat/parse", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to parse ${file.name}`);
        }

        const data = await res.json();

        return `# ${file.name}\n${data.text}`;
      }

      return "";
    }),
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
      const newDocText = await filesToDocumentText(files);
      //combines old text files with new files (if found)
      const combinedDocText = newDocText
        ? persistedDocText
          ? `${persistedDocText}\n\n${newDocText}`
          : newDocText
        : persistedDocText;

      // update persisted storage only if new text was uploaded
      if (newDocText) setPersistedDocText(combinedDocText);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          documentText: combinedDocText,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${res.status}`);
      }

      const data = await res.json();

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
