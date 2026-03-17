"use client";

import { useState, useEffect, type KeyboardEvent } from "react";
import FileUpload from "./FileUpload";
import type { UploadedFile } from "../types";

interface ChatBarProps {
  onSendMessage: (message: string, uploadedFiles: UploadedFile[]) => void | Promise<void>;
  isSending: boolean;
  sessionId: string | null;
}

const MAX_MESSAGE_LENGTH = 500;

export default function ChatBar({ onSendMessage, isSending, sessionId }: ChatBarProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFilePopupOpen, setIsFilePopupOpen] = useState(false);

  // Load persisted files from Supabase whenever the session becomes known
  useEffect(() => {
    if (!sessionId) return;

    fetch(`/api/chat/files?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data: { files?: UploadedFile[] }) => {
        if (Array.isArray(data.files) && data.files.length > 0) {
          setUploadedFiles(data.files);
        }
      })
      .catch(() => {});
  }, [sessionId]);

  async function handleAddFiles(newFiles: File[]) {
    // Ignore files already present (matched by name)
    const toUpload = newFiles.filter(
      (f) => !uploadedFiles.some((u) => u.fileName === f.name),
    );

    if (toUpload.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const results = await Promise.all(
        toUpload.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/chat/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(
              (errData as { error?: string }).error ||
                `Failed to upload ${file.name}`,
            );
          }

          const data = (await res.json()) as {
            storagePath: string;
            fileName: string;
            text: string;
          };

          return { ...data, size: file.size } satisfies UploadedFile;
        }),
      );

      setUploadedFiles((prev) => [...prev, ...results]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemoveFile(storagePath: string) {
    // Optimistically remove from UI
    setUploadedFiles((prev) => prev.filter((f) => f.storagePath !== storagePath));

    // Delete from storage + DB
    await fetch("/api/chat/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath }),
    }).catch(() => {});
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

    setError(null);
    await onSendMessage(trimmed, uploadedFiles);
    setMessage("");
    // Files are intentionally kept — they persist until manually removed
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && !isUploading) {
        void handleSend();
      }
    }
  }

  return (
    <div className="chat-bar">
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
          onClick={() => void handleSend()}
          disabled={isSending || isUploading || message.trim().length === 0}
          className="chat-bar-send"
        >
          {isSending ? "Sending..." : "Send"}
        </button>

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
      </div>

      {isFilePopupOpen && (
        <div className="chat-bar-file-popup">
          <p className="chat-bar-file-popup-title">Attach files</p>
          <p className="chat-bar-file-popup-subtitle">
            Upload up to 5 files (.pdf, .txt, .docx or .pptx)
          </p>
          <FileUpload
            uploadedFiles={uploadedFiles}
            onAddFiles={(files) => void handleAddFiles(files)}
            onRemoveFile={(path) => void handleRemoveFile(path)}
            isUploading={isUploading}
          />
        </div>
      )}

      <div className="chat-bar-meta">
        <p>Press Enter to send, Shift+Enter for a new line.</p>
        <p>
          {isUploading
            ? "Uploading files..."
            : `${uploadedFiles.length} file(s) attached`}{" "}
          | {message.trim().length}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>

      {error && <p className="chat-bar-error">{error}</p>}
    </div>
  );
}
