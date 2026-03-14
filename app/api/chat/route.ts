import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { documentText, message, history = [] } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 },
      );
    }

    // System rule that would normally guide the LLM
    const system =
      'Answer ONLY using the provided document. If not found, reply exactly: "I could not find that in the document."';

    // Limit how much chat history we keep
    const MAX_HISTORY = 6;
    const contextWindow = history.slice(-MAX_HISTORY);

    // Construct prompt like the real LLM would receive
    const prompt = `DOCUMENT:\n${documentText ?? ""}\n\nQUESTION:\n${message}`;

    /*
      MOCK LLM RESPONSE
      This simulates what an LLM might do so the whole system works
      without using OpenAI credits.
    */

    let answer = "";

    if (!documentText || documentText.length === 0) {
      answer = "No document has been uploaded yet.";
    } else if (documentText.toLowerCase().includes(message.toLowerCase())) {
      answer = `I found something related in the document.\n\nPreview:\n${documentText.slice(
        0,
        300,
      )}...`;
    } else {
      answer = `Mock response.

Your question:
"${message}"

The document was successfully parsed and contains ${documentText.length} characters.

Document preview:
${documentText.slice(0, 200)}...

(LLM disabled — using mock response for development)`;
    }

    return NextResponse.json({
      answer,
      debug: {
        contextMessages: contextWindow.length,
        documentLength: documentText?.length ?? 0,
      },
    });
  } catch (e: any) {
    console.error("Chat API error:", e);

    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
