"use client";

import { useState } from "react";
import ChatBar from "./components/ChatBar";
import ChatHistory, { type ChatMessage } from "./components/ChatHistory";
import "./chat.css";

//we are inside app/chat/page.tsx so we go up one level and into components
export default function ChatPage() {
  //stores all messages sent by the user
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [persistedDocText, setPersistedDocText] = useState(""); //uploaded document text persists across the session

  //called when ChatBar sends a new message
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
      const formData = new FormData();
      formData.append("message", message);
      formData.append("history", JSON.stringify(history));
      formData.append("persistedDocumentText", persistedDocText);
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

  //clears history
  function handleClearHistory() {
    setMessages([]);
    setPersistedDocText("");
  }

  return (
    <main className="chat-page">
      <header className="chat-page-header">
        <h1 className="chat-page-title">
          Whiteboard Chat
        </h1>
        <p className="chat-page-subtitle">
          Ask questions and review your recent prompts below.
        </p>
      </header>

      <ChatBar onSendMessage={handleNewMessage} isSending={isSending} />
      <ChatHistory messages={messages} onClearHistory={handleClearHistory} />
    </main>
  );
}
