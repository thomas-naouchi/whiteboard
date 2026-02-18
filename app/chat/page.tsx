"use client";

import { useState } from "react";
import ChatBar from "./components/ChatBar";
import ChatHistory, { type ChatMessage } from "./components/ChatHistory";
import "./chat.css";

//filters text files only (pdf parsing must be handled later)
//transforms text files into one long string
async function filesToDocumentText(files: File[]) {
  const txtFiles = files.filter((f) => f.name.toLowerCase().endsWith(".txt"));

  const parts = await Promise.all(
    txtFiles.map(async (f) => `# ${f.name}\n${await f.text()}`),
  );
  return parts.join("\n\n");
}

//we are inside app/chat/page.tsx so we go up one level and into components
export default function ChatPage() {
  //stores all messages sent by the user
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [persistedDocText, setPersistedDocText] = useState(""); //uploaded document text persist along the session

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

  //clears history
  function handleClearHistory() {
    setMessages([]);
    setPersistedDocText("");
  }

  return (
    <main className="chat-page">
      <header className="chat-page-header">
        <h1 className="chat-page-title">Whiteboard Chat</h1>
        <p className="chat-page-subtitle">
          Ask questions and review your recent prompts below.
        </p>
      </header>

      <ChatBar onSendMessage={handleNewMessage} isSending={isSending} />
      <ChatHistory messages={messages} onClearHistory={handleClearHistory} />
    </main>
  );
}
