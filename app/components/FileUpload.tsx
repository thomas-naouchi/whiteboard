"use client";

import { useState, useRef } from "react";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
}

export default function FileUpload({ onFilesChange }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); //notify parent component of file changes
  const [error, setError] = useState<string | null>(null); //error state for validation messages
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    //handle file input changes and perform validation
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files); //convert FileList to array for easier manipulation

    if (fileArray.length === 0) {
      //validate that at least one file is selected
      setError("Please select at least one file.");
      return;
    }

    if (fileArray.length > 5) {
      //validate that no more than 5 files are selected
      setError("You can upload a maximum of 5 files.");
      return;
    }

    const allowedTypes = ["application/pdf", "text/plain"]; //define allowed MIME types for validation

    for (const file of fileArray) {
      //validate that each file is of an allowed type
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
    //remove a file from the selected files list and update state
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
    //render file input and display selected files with remove option
    <div style={{ marginTop: "1rem" }}>
      <h2>Upload Files (1–5)</h2>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt"
        onChange={handleChange}
      />

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
