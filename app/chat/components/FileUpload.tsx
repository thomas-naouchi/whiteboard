"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
}

export default function FileUpload({ onFilesChange }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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

    if (fileArray.length > 5) {
      setError("You can upload a maximum of 5 files.");
      return;
    }

    for (const file of fileArray) {
      const lower = file.name.toLowerCase();
      const allowedExtension = lower.endsWith(".pdf") || lower.endsWith(".txt");
      if (!allowedExtension) {
        setError("Only PDF and TXT files are allowed.");
        return;
      }
    }

    setError(null);
    setSelectedFiles(fileArray);
    onFilesChange(fileArray);
  }

  function removeFile(indexToRemove: number) {
    const updatedFiles = selectedFiles.filter(
      (_, index) => index !== indexToRemove,
    );

    setSelectedFiles(updatedFiles);
    onFilesChange(updatedFiles);
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
        accept=".pdf,.txt"
        onChange={handleChange}
        className="file-upload-input"
      />

      {error && <p className="file-upload-error">{error}</p>}

      {selectedFiles.length > 0 && (
        <div className="file-upload-list-wrap">
          <p className="file-upload-list-title">Selected files</p>
          <ul className="file-upload-list">
            {selectedFiles.map((file, index) => (
              <li key={index} className="file-upload-item">
                <span className="file-upload-name">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="file-upload-remove"
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
