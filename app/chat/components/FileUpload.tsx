"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  onPinFile?: (file: File) => void;
  selectedFiles?: File[];
  hideFileList?: boolean;
  maxFilesPerPick?: number;
}

export default function FileUpload({
  onFilesChange,
  onPinFile,
  selectedFiles: controlledFiles,
  hideFileList = false,
  maxFilesPerPick = 5,
}: FileUploadProps) {
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedFiles = controlledFiles ?? internalFiles;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);

    if (fileArray.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    if (fileArray.length > maxFilesPerPick) {
      setError(`You can upload a maximum of ${maxFilesPerPick} files at once.`);
      return;
    }

    for (const file of fileArray) {
      const lower = file.name.toLowerCase();
      const allowedExtension =
        lower.endsWith(".pdf") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".pptx");
      if (!allowedExtension) {
        setError("Only PDF, PPTX, and TXT files are allowed.");
        return;
      }
    }

    if (selectedFiles.length + fileArray.length > maxFilesPerPick) {
      setError(`You can upload a maximum of ${maxFilesPerPick} files at once.`);
      return;
    }

    const merged = [...selectedFiles, ...fileArray];
    setError(null);
    if (controlledFiles === undefined) {
      setInternalFiles(merged);
    }
    onFilesChange(merged);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removeFile(indexToRemove: number) {
    const updatedFiles = selectedFiles.filter(
      (_, index) => index !== indexToRemove,
    );

    if (controlledFiles === undefined) {
      setInternalFiles(updatedFiles);
    }
    onFilesChange(updatedFiles);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function pinFile(file: File) {
    if (!onPinFile) {
      return;
    }
    const index = selectedFiles.indexOf(file);
    if (index >= 0) {
      removeFile(index);
    }
    onPinFile(file);
  }

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.pptx,.txt"
        onChange={handleChange}
        className="file-upload-input"
      />

      {error && <p className="file-upload-error">{error}</p>}

      {!hideFileList && selectedFiles.length > 0 && (
        <div className="file-upload-list-wrap">
          <p className="file-upload-list-title">Selected files</p>
          <ul className="file-upload-list">
            {selectedFiles.map((file, index) => (
              <li key={index} className="file-upload-item">
                <span className="file-upload-name">{file.name}</span>
                <div className="file-upload-actions">
                  {onPinFile && (
                    <button
                      type="button"
                      onClick={() => pinFile(file)}
                      className="file-upload-pin"
                      title="Pin file across messages"
                    >
                      Pin
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="file-upload-remove"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
