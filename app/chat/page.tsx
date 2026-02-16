"use client";

import { useState } from "react";
import ChatBar from "../components/ChatBar";

//we are inside app/chat/page.tsx so we go up one level and into components
export default function ChatPage() {
  //stores all messages sent by the user
  const [messages, setMessages] = useState<string[]>([]);

  //called when ChatBar sends a new message
  function handleNewMessage(message: string) 
  
  {//add the new message to the existing messages array
    
    setMessages((prev) => [...prev, message]);
  }

  //clearshistory
  function handleClearHistory() {
    setMessages([]);
  }

  return (
    //main container for the chat page
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>

      <h1>Whiteboard Chat</h1>

      
      <ChatBar onSendMessage={handleNewMessage} />

      <h3
        style={{
          marginTop: "2rem",
          textAlign: "center",
          fontSize: "22px",
          fontWeight: "bold",
        }}
      > History
      </h3>

      {messages.length > 0 && (
        <>
          
          <button
          //button to clear all chat history
            onClick={handleClearHistory}
            style={{
              marginTop: "1rem",
              backgroundColor: "#a6a6a6",
              color: "white",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Clear Chat
          </button>

        
          <div
          //chat history container 
            style={{
              marginTop: "2rem",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              backgroundColor: "#111",
              padding: "20px",
              borderRadius: "10px",
            }}
          >
           
            {messages.map((msg, index) => (
              <div
              //loop through messages and render each as a chat bubble 
                key={index}
                style={{
                  alignSelf: "flex-start", //align messages to the left
                  backgroundColor: "black", //bubble background color
                  color: "white", //text color
                  padding: "10px 14px",
                  borderRadius: "15px",
                  maxWidth: "70%", 
                  wordBreak: "break-word", 
                }}
              >
                {msg}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
