"use client";

import { useState, type KeyboardEvent } from "react";
import FileUpload from "./FileUpload";

export interface ChatUploadItem {
  id: string;
  file?: File;
  fileName: string;
  size: number;
  isSelected: boolean;
  isPersisted?: boolean;
}

interface ChatBarProps {
  onSendMessage: (message: string, files: ChatUploadItem[]) => void | Promise<void>;
  onUploadFiles: (files: File[]) => void | Promise<void>;
  isSending: boolean;
  uploadedFiles: ChatUploadItem[];
  onUploadedFilesChange: (files: ChatUploadItem[]) => void;
}

const MAX_MESSAGE_LENGTH = 500;

export default function ChatBar({
  onSendMessage,
  onUploadFiles,
  isSending,
  uploadedFiles,
  onUploadedFilesChange,
}: ChatBarProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isFilePopupOpen, setIsFilePopupOpen] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);

  const selectedItems = uploadedFiles.filter((item) => item.isSelected);

  async function handleUploadedFilesChange(files: File[]) {
    await onUploadFiles(files);
  }

  function handleFileSelectionChange(id: string) {
    onUploadedFilesChange(
      uploadedFiles.map((item) =>
        item.id === id ? { ...item, isSelected: !item.isSelected } : item,
      ),
    );
  }

  function handleRemoveFile(id: string) {
    onUploadedFilesChange(uploadedFiles.filter((item) => item.id !== id));
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

    if (selectedItems.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    setError(null);
    await onSendMessage(trimmed, selectedItems);
    setMessage("");
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
      <section className="chat-file-container">
        <div className="chat-file-container-header">
          <div>
            <p className="chat-file-container-label">File container</p>
            <h3 className="chat-file-container-title">Uploaded files</h3>
          </div>
          <span className="chat-file-container-count">
            {selectedItems.length}/{uploadedFiles.length} selected
          </span>
        </div>

        {uploadedFiles.length === 0 ? (
          <div className="chat-file-container-empty">
            Upload files once, then tick the ones you want to chat about.
          </div>
        ) : (
          <ul className="chat-file-list">
            {uploadedFiles.map((item) => (
              <li key={item.id} className="chat-file-list-item">
                <label className="chat-file-checkbox-row">
                  <input
                    type="checkbox"
                    checked={item.isSelected}
                    onChange={() => handleFileSelectionChange(item.id)}
                    className="chat-file-checkbox"
                  />
                  <span className="chat-file-list-name">{item.fileName}</span>
                </label>

                <div className="chat-file-list-meta">
                  <span className="chat-file-list-size">
                    {Math.max(1, Math.round(item.size / 1024))} KB
                  </span>
                  {item.isPersisted && (
                    <span className="chat-file-list-badge">Saved</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(item.id)}
                    className="chat-file-list-remove"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
            Upload up to 5 files (.pdf, .pptx, or .txt). Then tick the files you want to use for the next message.
          </p>
          <FileUpload
            key={uploaderKey}
            onFilesChange={handleUploadedFilesChange}
            selectedFiles={uploadedFiles
              .filter((item): item is ChatUploadItem & { file: File } => Boolean(item.file))
              .map((item) => item.file)}
            hideFileList
          />
        </div>
      )}

      <div className="chat-bar-meta">
        <p>
          Press Enter to send, Shift+Enter for a new line.
        </p>
        <p>
          {selectedItems.length} file(s) selected | {message.trim().length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>

      {error && <p className="chat-bar-error">{error}</p>}
    </div>
  );
}
