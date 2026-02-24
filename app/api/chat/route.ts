import OpenAI from "openai";
import { NextResponse } from "next/server";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
}

export async function POST(req: Request) {
  try {
    const { documentText, message } = await req.json();

    if (!documentText || !message) {
      return NextResponse.json(
        { error: "Missing required fields: documentText, message" },
        { status: 400 }
      );
    }

    const system =
      'Answer ONLY using the provided document. If not found, reply exactly: "I could not find that in the document." Do not guess.';

    const prompt = `DOCUMENT:\n${documentText}\n\nQUESTION:\n${message}`;

    const client = getClient();
    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    return NextResponse.json({
      answer: resp.choices?.[0]?.message?.content ?? "",
    });
  } catch (e: any) {
    console.error("Error handling /api/chat POST request:", e);
    if (e instanceof Error && e.message.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        { error: "Server is missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
