"use client";

import { useState } from "react";
import ChatBar from "./components/ChatBar";
import ChatHistory from "./components/ChatHistory";

//we are inside app/chat/page.tsx so we go up one level and into components
export default function ChatPage() {
  //stores all messages sent by the user
  const [messages, setMessages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  //called when ChatBar sends a new message
  async function handleNewMessage(message: string) {
    setIsSending(true);
    //add the new message to the existing messages array
    setMessages((prev) => [...prev, message]);
    setIsSending(false);
  }

  //clearshistory
  function handleClearHistory() {
    setMessages([]);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Whiteboard Chat
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ask questions and review your recent prompts below.
        </p>
      </header>

      <ChatBar onSendMessage={handleNewMessage} isSending={isSending} />
      <ChatHistory messages={messages} onClearHistory={handleClearHistory} />
    </main>
  );
}
