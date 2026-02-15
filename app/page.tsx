"use client";

import { useState } from "react";
import FileUpload from "./components/FileUpload";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Whiteboard</h1>

      <FileUpload onFilesChange={setFiles} />

      <div style={{ marginTop: "2rem" }}>
        <strong>Total selected files:</strong> {files.length}
      </div>
    </div>
  );
}
