"use client";

import { useEffect, useState } from "react";
import ChatBar from "./components/ChatBar";
import ChatHistory, { type ChatMessage } from "./components/ChatHistory";
import "./chat.css";

const SESSION_STORAGE_KEY = "whiteboard-session-id";

/**
 * Parse uploaded files into plain text by calling the /api/chat/parse endpoint.
 * TXT files are read directly in the browser; PDF/DOCX/PPTX are sent to the server.
 */
async function filesToDocumentText(files: File[]): Promise<string> {
    const parts = await Promise.all(
          files.map(async (file) => {
                  const lower = file.name.toLowerCase();

                          // TXT files: read directly in the browser
                          if (lower.endsWith(".txt")) {
                                    return `# ${file.name}\n${await file.text()}`;
                          }

                          // PDF, DOCX, PPTX: send to the server-side parse API
                          if (
                                    lower.endsWith(".pdf") ||
                                    lower.endsWith(".docx") ||
                                    lower.endsWith(".pptx")
                                  ) {
                                    const formData = new FormData();
                                    formData.append("file", file);

                    const res = await fetch("/api/chat/parse", {
                                method: "POST",
                                body: formData,
                    });

                    if (!res.ok) {
                                const errData = await res.json().catch(() => ({}));
                                throw new Error(
                                              (errData as { error?: string }).error ||
                                                `Failed to parse ${file.name}`,
                                            );
                    }

                    const data = (await res.json()) as { text: string };
                                    return `# ${file.name}\n${data.text}`;
                          }

                          return "";
          }),
        );

  return parts.filter(Boolean).join("\n\n");
}

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
     * Send a new message to the chat API
     */
  async function handleNewMessage(message: string, files: File[]) {
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
                  attachments: files.map((f) => ({ name: f.name, size: f.size })),
        },
            ]);

      try {
              // Parse uploaded files to text (client-side for TXT, server-side for others)
          const newDocText = files.length > 0 ? await filesToDocumentText(files) : "";

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

          // Call the chat API with JSON body
          const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                                message,
                                history,
                                documentText: combinedDocText,
                                sessionId,
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
                      <h1 className="chat-page-title">Whiteboard Chat</h1>h1>
                      <p className="chat-page-subtitle">
                                Ask questions and review your recent prompts below.
                      </p>p>
              </header>header>
        
              <ChatBar onSendMessage={handleNewMessage} isSending={isSending} />
        
              <ChatHistory
                        messages={messages}
                        onClearHistory={handleClearHistory}
                        isLoading={historyLoading}
                      />
        </main>main>
      );
}</main>
