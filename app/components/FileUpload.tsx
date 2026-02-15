"use client";

import { useState } from "react";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
}

export default function FileUpload({ onFilesChange }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

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

    const allowedTypes = ["application/pdf", "text/plain"];

    for (const file of fileArray) {
      if (!allowedTypes.includes(file.type)) {
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
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h2>Upload Files (1–5)</h2>

      <input type="file" multiple accept=".pdf,.txt" onChange={handleChange} />

      {error && <p style={{ color: "red" }}>{error}</p>}

      {selectedFiles.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Selected Files:</h4>
          <ul>
            {selectedFiles.map((file, index) => (
              <li key={index} style={{ marginBottom: "0.5rem" }}>
                {file.name}{" "}
                <button
                  onClick={() => removeFile(index)}
                  style={{
                    marginLeft: "10px",
                    backgroundColor: "#ff4d4f",
                    color: "white",
                    border: "none",
                    padding: "3px 8px",
                    cursor: "pointer",
                  }}
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
