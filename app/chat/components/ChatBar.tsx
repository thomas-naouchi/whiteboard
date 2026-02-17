"use client";

import { useState, type KeyboardEvent } from "react";

interface ChatBarProps {
  onSendMessage: (message: string) => void;
 
}

export default function ChatBar({ onSendMessage }: ChatBarProps) {
  //message what the user is typing in the input
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSend() {
    //Remove spaces from the beginning/end so "  " becomes empty
    const trimmed = message.trim();

    //prevent sending empty message
    if (!trimmed) {
      setError("Please type a question before sending.");
      return; //it stops here and do not send
    }

    //prevent sending very long messages
    if (trimmed.length > 500) {
      setError("Message too long (max 500 characters).");
      return; //it stop here do not  send
    }

    //if validation passes
    setError(null); 
    onSendMessage(trimmed); 
    setMessage(""); //clear the input box after sending
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    //if the user presses Enter we send the message
    if (e.key === "Enter") {
      e.preventDefault(); //prevents default behavior example form submit/newline
      handleSend(); 
    }
  }

  return (
    //container for the whole chat input area
    <div style={{ marginTop: "1rem" }}>
      <h2>Ask a Question</h2>

      
      <div style={{ display: "flex", gap: "10px", marginTop: "0.5rem" }}>

        <input
          type="text"
          value={message}//controlled input it is value always comes from state
          onChange={(e) => setMessage(e.target.value)}//update state whenever user types
          onKeyDown={handleKeyDown}
        

          placeholder="Type your question here..."
          style={{
            flex: 1, 
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            outline: "none",
          }}
        />

        <button
          onClick={handleSend}//when clicked it sends the current input message

          style={{
            backgroundColor: "black",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>

      {error && (
        <p style={{ color: "white", marginTop: "0.5rem" }}>
          {error}
          
        </p>
      )}
    </div>
  );
}
