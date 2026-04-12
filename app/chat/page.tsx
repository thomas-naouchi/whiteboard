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

    if (
      selected.length >= MAX_CONTEXT_MESSAGES ||
      nextChars > MAX_CONTEXT_CHARACTERS
    ) {
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

interface RetrievalResult {
  id: string;
  fileName: string;
  fileType: string;
  confidence: string;
  matchedText: string;
  summary: string;
  pageLabel: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim();

  if (!trimmed) {
    return text;
  }

  const safePattern = escapeRegExp(trimmed).replace(/\s+/g, "\\s+");
  const regex = new RegExp(`(${safePattern})`, "ig");
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={`${part}-${index}`} className="retrieval-highlight">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export default function ChatPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<"chat" | "finder">(
    "chat",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [persistedDocText, setPersistedDocText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<ChatUploadItem[]>([]);
  const [retrievalQuery, setRetrievalQuery] = useState(
    "quotation for mark zuckerberg",
  );
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>(
    [],
  );
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);
  const [retrievalInfo, setRetrievalInfo] = useState<string | null>(null);
  const [selectedFinderFileName, setSelectedFinderFileName] = useState<
    string | null
  >(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY);

    if (stored) {
      setSessionId(stored);

      Promise.all([
        fetch(`/api/session/messages?sessionId=${encodeURIComponent(stored)}`).then((res) =>
          res.json(),
        ),
        fetch(`/api/session/files?sessionId=${encodeURIComponent(stored)}`).then((res) =>
          res.json(),
        ),
      ])
        .then(([messageData, fileData]) => {
          if (Array.isArray(messageData.messages) && messageData.messages.length > 0) {
            setMessages(
              messageData.messages.map(
                (m: { id: string; role: string; content: string }) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: m.content,
                }),
              ),
            );
          }

          if (Array.isArray(fileData.files)) {
            setUploadedFiles(
              fileData.files.map(
                (file: {
                  id: string;
                  fileName: string;
                  size: number;
                  isSelected: boolean;
                  isPersisted: boolean;
                }) => ({
                  id: file.id,
                  fileName: file.fileName,
                  size: file.size,
                  isSelected: file.isSelected,
                  isPersisted: file.isPersisted,
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

  async function handleNewMessage(message: string, files: ChatUploadItem[]) {
    setIsSending(true);

    const selectedNewFiles = files
      .filter((item): item is ChatUploadItem & { file: File } => Boolean(item.file))
      .map((item) => item.file);
    const selectedPersistedFileIds = files
      .filter((item) => item.isPersisted)
      .map((item) => item.id);

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        attachments: files.map((file) => ({
          name: file.fileName,
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
      if (selectedPersistedFileIds.length > 0) {
        formData.append("selectedFileIds", JSON.stringify(selectedPersistedFileIds));
      }
      for (const file of selectedNewFiles) {
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
            ? data.suggestedFollowUps.filter(
                (item: unknown) => typeof item === "string",
              )
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
    setRetrievalResults([]);
    setActiveResultId(null);
    setRetrievalInfo(null);
    setRetrievalError(null);
    setSelectedFinderFileName(null);
    window.localStorage.removeItem(SESSION_KEY);
  }

  const activeResult =
    retrievalResults.find((result) => result.id === activeResultId) ??
    retrievalResults[0] ??
    null;

  async function handleFileSearch() {
    const trimmedQuery = retrievalQuery.trim();

    if (!trimmedQuery) {
      setRetrievalError(
        "Please describe the file or text you are trying to find.",
      );
      setRetrievalInfo(null);
      return;
    }

    if (!sessionId) {
      setRetrievalError(
        "Upload at least one file in chat first so Whiteboard has files to search.",
      );
      setRetrievalInfo(null);
      return;
    }

    setIsSearchingFiles(true);
    setRetrievalError(null);
    setRetrievalInfo(null);

    try {
      const response = await fetch("/api/files/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          query: trimmedQuery,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
      }

      const results = Array.isArray(data.results)
        ? (data.results as RetrievalResult[])
        : [];
      setRetrievalResults(results);
      setActiveResultId(results[0]?.id ?? null);

      if (results.length === 0) {
        setRetrievalInfo(
          "No matching file surfaced yet. Try a client name, quote fragment, document type, or topic.",
        );
      } else {
        setRetrievalInfo(
          `Found ${results.length} possible match${
            results.length === 1 ? "" : "es"
          } in this session.`,
        );
      }
    } catch (error) {
      setRetrievalError(
        error instanceof Error
          ? error.message
          : "Unable to search files right now.",
      );
      setRetrievalResults([]);
      setActiveResultId(null);
      setRetrievalInfo(null);
    } finally {
      setIsSearchingFiles(false);
    }
  }

  function handleFinderChatTransition() {
    if (!activeResult) return;
    setSelectedFinderFileName(activeResult.fileName);
    setActiveWorkspace("chat");
  }

  async function handleUploadFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const formData = new FormData();
    if (sessionId) {
      formData.append("sessionId", sessionId);
    }
    for (const file of files) {
      formData.append("files", file);
    }

    const response = await fetch("/api/session/files", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    if (typeof data.sessionId === "string" && data.sessionId.length > 0) {
      setSessionId(data.sessionId);
      window.localStorage.setItem(SESSION_KEY, data.sessionId);
    }

    if (Array.isArray(data.files)) {
      setUploadedFiles((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const next = data.files
          .filter(
            (file: { id: string }) =>
              typeof file.id === "string" && !existingIds.has(file.id),
          )
          .map(
            (file: {
              id: string;
              fileName: string;
              size: number;
              isSelected: boolean;
              isPersisted: boolean;
            }) => ({
              id: file.id,
              fileName: file.fileName,
              size: file.size,
              isSelected: file.isSelected,
              isPersisted: file.isPersisted,
            }),
          );

        return [...prev, ...next];
      });
    }
  }

  const selectedFileCount = uploadedFiles.filter(
    (item) => item.isSelected,
  ).length;

  return (
    <main className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-brand">
          <div className="chat-sidebar-brand-badge">AI Active</div>
          <h1>Whiteboard</h1>
          <p>AI File System</p>
        </div>

        <nav className="chat-sidebar-nav">
          <a className="chat-sidebar-link" href="/">
            Home
          </a>
          <button
            type="button"
            className={`chat-sidebar-link ${
              activeWorkspace === "chat" ? "chat-sidebar-link-active" : ""
            }`}
            onClick={() => setActiveWorkspace("chat")}
          >
            Chat about files
          </button>
          <button
            type="button"
            className={`chat-sidebar-link ${
              activeWorkspace === "finder" ? "chat-sidebar-link-active" : ""
            }`}
            onClick={() => setActiveWorkspace("finder")}
          >
            Find a file
          </button>
        </nav>
      </aside>

      <section className="chat-main">
        {activeWorkspace === "chat" ? (
          <>
            <header id="chat-workspace" className="chat-main-header">
              <p className="chat-main-chip">Classified</p>
              <div>
                <h2 className="chat-main-title">Chat about files</h2>
                <p className="chat-main-subtitle">
                  Upload PDF, PPTX, or TXT files and ask grounded questions from
                  your documents.
                </p>
              </div>
            </header>

            {!persistedDocText && (
              <div className="chat-hint-banner">
                Upload files, tick the ones you want to use, then ask your
                question.
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

            {selectedFinderFileName && (
              <div className="chat-finder-bridge">
                Ready to chat about <strong>{selectedFinderFileName}</strong>.
                Ask a question and Whiteboard will use the same session file
                context.
              </div>
            )}

            <div className="chat-stage">
              <ChatHistory
                messages={messages}
                onClearHistory={handleClearHistory}
                onSuggestionClick={handleSuggestionClick}
                isLoading={historyLoading}
                isThinking={isSending}
                thinkingFileCount={selectedFileCount}
              />
              <ChatBar
                onSendMessage={handleNewMessage}
                onUploadFiles={handleUploadFiles}
                isSending={isSending}
                uploadedFiles={uploadedFiles}
                onUploadedFilesChange={setUploadedFiles}
              />
            </div>
          </>
        ) : (
          <section id="file-finder" className="retrieval-panel">
            <div className="retrieval-panel-heading">
              <div>
                <p className="retrieval-panel-kicker">File Finder</p>
                <h3 className="retrieval-panel-title">
                  Find the exact file you meant.
                </h3>
              </div>
              <span className="retrieval-panel-badge">Live session search</span>
            </div>

            <p className="retrieval-panel-copy">
              Search by what you remember, then review the most likely file with
              the matching text highlighted in front of you.
            </p>

            <div className="retrieval-search-row">
              <label
                className="retrieval-search-label"
                htmlFor="retrieval-search-input"
              >
                I&apos;m looking for
              </label>
              <div className="retrieval-search-field">
                <input
                  id="retrieval-search-input"
                  className="retrieval-search-input"
                  value={retrievalQuery}
                  onChange={(event) => setRetrievalQuery(event.target.value)}
                  placeholder="quotation for mark zuckerberg"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleFileSearch();
                    }
                  }}
                />
                <button
                  type="button"
                  className="retrieval-search-button"
                  onClick={() => void handleFileSearch()}
                  disabled={isSearchingFiles}
                >
                  {isSearchingFiles ? "Searching..." : "Find file"}
                </button>
              </div>
            </div>

            {retrievalError && (
              <p className="retrieval-feedback retrieval-feedback-error" role="alert">
                {retrievalError}
              </p>
            )}

            {!retrievalError && retrievalInfo && (
              <p className="retrieval-feedback retrieval-feedback-info">
                {retrievalInfo}
              </p>
            )}

            <div className="retrieval-layout">
              <div className="retrieval-results">
                {retrievalResults.length === 0 ? (
                  <div className="retrieval-empty-state">
                    {sessionId
                      ? "Search this session to surface matching files and highlighted excerpts."
                      : "No searchable session yet. Upload files in chat first, then come back here."}
                  </div>
                ) : (
                  retrievalResults.map((result) => {
                    const isActive = result.id === activeResult?.id;

                    return (
                      <button
                        key={result.id}
                        type="button"
                        className={`retrieval-result-card ${
                          isActive ? "retrieval-result-card-active" : ""
                        }`}
                        onClick={() => setActiveResultId(result.id)}
                      >
                        <div className="retrieval-result-topline">
                          <span className="retrieval-result-type">
                            {result.fileType}
                          </span>
                          <span className="retrieval-result-confidence">
                            {result.confidence}
                          </span>
                        </div>
                        <h4 className="retrieval-result-name">
                          {result.fileName}
                        </h4>
                        <p className="retrieval-result-summary">
                          {result.summary}
                        </p>
                        <span className="retrieval-result-page">
                          {result.pageLabel}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {activeResult ? (
                <article className="retrieval-preview">
                  <div className="retrieval-preview-header">
                    <div>
                      <p className="retrieval-preview-label">
                        Highlighted match
                      </p>
                      <h4 className="retrieval-preview-title">
                        {activeResult.fileName}
                      </h4>
                    </div>
                    <span className="retrieval-preview-page">
                      {activeResult.pageLabel}
                    </span>
                  </div>

                  <p className="retrieval-preview-description">
                    Whiteboard found the strongest stored excerpt for this query
                    so you can validate the file before opening a deeper chat.
                  </p>

                  <div className="retrieval-preview-excerpt">
                    {highlightMatch(activeResult.matchedText, retrievalQuery)}
                  </div>

                  <div className="retrieval-preview-actions">
                    <button
                      type="button"
                      className="retrieval-preview-primary"
                      onClick={handleFinderChatTransition}
                    >
                      Chat about this file
                    </button>
                    <button
                      type="button"
                      className="retrieval-preview-secondary"
                      onClick={() => setActiveResultId(activeResult.id)}
                    >
                      Keep highlighted
                    </button>
                  </div>
                </article>
              ) : (
                <article className="retrieval-preview retrieval-preview-empty">
                  <p className="retrieval-preview-label">Highlighted match</p>
                  <h4 className="retrieval-preview-title">
                    No file selected yet
                  </h4>
                  <p className="retrieval-preview-description">
                    Search your uploaded session files to see the most likely
                    match and the excerpt that triggered it.
                  </p>
                </article>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
