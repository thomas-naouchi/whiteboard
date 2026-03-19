"use client";

import { useState, type KeyboardEvent } from "react";
import FileUpload from "./FileUpload";

interface ChatBarProps {
  onSendMessage: (message: string, files: File[]) => void | Promise<void>;
  isSending: boolean;
  hasLoadedDocument?: boolean;
}

const MAX_MESSAGE_LENGTH = 500;

export default function ChatBar({
  onSendMessage,
  isSending,
  hasLoadedDocument = false,
}: ChatBarProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<File[]>([]);
  const [isFilePopupOpen, setIsFilePopupOpen] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);

  const filesForSend = [...pinnedFiles, ...selectedFiles];

  function handlePinFile(file: File) {
    setSelectedFiles((prev) => prev.filter((f) => f !== file));
    setPinnedFiles((prev) => [...prev, file]);
  }

  function handleUnpinFile(file: File) {
    setPinnedFiles((prev) => prev.filter((f) => f !== file));
  }

  async function handleSend() {
    const trimmed = message.trim();

    if (!trimmed) {
      setError("Please type a question before sending.");
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    if (!hasLoadedDocument && filesForSend.length === 0) {
      setError("Attach at least one file before sending your first message.");
      return;
    }

    setError(null);
    await onSendMessage(trimmed, filesForSend);
    setMessage("");
    setSelectedFiles([]);
    setIsFilePopupOpen(false);
    setUploaderKey((prev) => prev + 1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending) {
        void handleSend();
      }
    }
  }

  return (
    <div className="chat-bar">
      {pinnedFiles.length > 0 && (
        <div className="chat-bar-pinned">
          <p className="chat-bar-pinned-label">Pinned files</p>
          <div className="chat-bar-pinned-list">
            {pinnedFiles.map((file, index) => (
              <span key={`${file.name}-${index}`} className="chat-bar-pinned-item">
                <span className="chat-bar-pinned-item-name">{file.name}</span>
                <button
                  type="button"
                  onClick={() => handleUnpinFile(file)}
                  className="chat-bar-pinned-remove"
                  aria-label={`Unpin ${file.name}`}
                  title="Unpin file"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <label htmlFor="chat-message-input" className="chat-bar-label">
        Ask a question
      </label>

      <div className="chat-bar-row">
        <textarea
          id="chat-message-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question here..."
          rows={3}
          disabled={isSending}
          className="chat-bar-textarea"
        />

        <button
          type="button"
          onClick={() => setIsFilePopupOpen((prev) => !prev)}
          disabled={isSending}
          className="chat-bar-attach"
          aria-label="Attach files"
          title="Attach files"
        >
          +
        </button>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isSending || message.trim().length === 0}
          className="chat-bar-send"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>

      {isFilePopupOpen && (
        <div className="chat-bar-file-popup">
          <p className="chat-bar-file-popup-title">Attach files</p>
          <p className="chat-bar-file-popup-subtitle">
            Upload up to 5 files (.pdf, .pptx, or .txt). Pin to keep across messages.
          </p>
          <FileUpload key={uploaderKey} onFilesChange={setSelectedFiles} onPinFile={handlePinFile} selectedFiles={selectedFiles} />
        </div>
      )}

      <div className="chat-bar-meta">
        <p>
          Press Enter to send, Shift+Enter for a new line.
        </p>
        <p>
          {filesForSend.length} file(s) ready | {message.trim().length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>

      {error && <p className="chat-bar-error">{error}</p>}
    </div>
  );
}
