"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
        background:
          "radial-gradient(900px 420px at 20% -8%, rgba(48,116,232,0.38), transparent 45%), radial-gradient(900px 420px at 100% 0%, rgba(39,148,142,0.25), transparent 42%), linear-gradient(160deg, #07112d 0%, #091937 45%, #081528 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: 24,
          padding: "2rem 1.5rem",
          textAlign: "center",
          background: "rgba(8, 24, 58, 0.75)",
          border: "1px solid rgba(107, 142, 204, 0.35)",
          boxShadow: "0 20px 55px rgba(2, 8, 23, 0.5)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#9bc0ff",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.72rem",
            fontWeight: 700,
          }}
        >
          Whiteboard
        </p>
        <h1 style={{ margin: "0.6rem 0 0", fontSize: "2.4rem", lineHeight: 1.15 }}>
          Chat with your files
        </h1>
        <p
          style={{
            margin: "0.9rem auto 0",
            maxWidth: 540,
            color: "#c9ddff",
            lineHeight: 1.6,
          }}
        >
          Upload PDF, PPTX, or TXT documents and ask grounded questions with
          session history and context-window aware chat.
        </p>

        <Link
          href="/chat"
          style={{
            display: "inline-block",
            marginTop: "1.25rem",
            padding: "0.7rem 1.1rem",
            borderRadius: 12,
            background: "linear-gradient(135deg, #3f8eff, #2d65d9)",
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open chat
        </Link>
      </section>
    </main>
  );
}
