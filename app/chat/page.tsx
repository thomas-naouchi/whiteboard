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

  //called when ChatBar sends a new message
  async function handleNewMessage(message: string, files: File[]) {
    setIsSending(true);
    //add the new message to the existing messages array
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
    setIsSending(false);
  }

  //clearshistory
  function handleClearHistory() {
    setMessages([]);
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
