"use client";

import { useRef, useState } from "react";
import type { UploadedFile } from "../types";

interface FileUploadProps {
  uploadedFiles: UploadedFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (storagePath: string) => void;
  isUploading?: boolean;
}

export default function FileUpload({
  uploadedFiles,
  onAddFiles,
  onRemoveFile,
  isUploading = false,
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);

    if (fileArray.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    const newTotal = uploadedFiles.length + fileArray.length;
    if (newTotal > 5) {
      setError(`You can have a maximum of 5 files (currently ${uploadedFiles.length} attached).`);
      return;
    }

    for (const file of fileArray) {
      const lower = file.name.toLowerCase();
      const allowed =
        lower.endsWith(".pdf") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".docx") ||
        lower.endsWith(".pptx");
      if (!allowed) {
        setError("Only PDF, TXT, DOCX and PPTX files are allowed.");
        return;
      }
    }

    setError(null);
    onAddFiles(fileArray);

    // Reset so the same file can be added again after removal
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.docx,.pptx"
        onChange={handleChange}
        className="file-upload-input"
        disabled={isUploading}
      />

      {error && <p className="file-upload-error">{error}</p>}

      {isUploading && (
        <p className="file-upload-uploading">Uploading to storage...</p>
      )}

      {uploadedFiles.length > 0 && (
        <div className="file-upload-list-wrap">
          <p className="file-upload-list-title">Attached files</p>
          <ul className="file-upload-list">
            {uploadedFiles.map((file) => (
              <li key={file.storagePath} className="file-upload-item">
                <span className="file-upload-name">{file.fileName}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.storagePath)}
                  className="file-upload-remove"
                  disabled={isUploading}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
