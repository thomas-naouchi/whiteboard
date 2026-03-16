/**
 * Chat API Route
 *
 * Responsibilities:
 * 1. Receive user message + chat history + document text (JSON body)
 * 2. Apply a CONTEXT WINDOW (limit history + document size)
 * 3. Send request to the LLM
 * 4. Persist chat messages to Supabase
 */
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * Context window limits
 *
 * Prevents the request from exceeding LLM token limits.
 */
const MAX_HISTORY_MESSAGES = 6;
const MAX_DOCUMENT_CHARS = 15000;

/**
 * Initialize OpenAI client
 */
function getClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
          throw new Error("Missing environment variable: OPENAI_API_KEY");
    }
    return new OpenAI({ apiKey });
}

/**
 * Main API handler
 *
 * Expects a JSON body:
 * {
 *   message: string;
 *   history: Array<{ role: "user" | "assistant"; content: string }>;
 *   documentText: string;
 *   sessionId?: string | null;
 * }
 */
export async function POST(req: Request) {
    try {
          const body = await req.json();

      const message: string | undefined =
              typeof body.message === "string" ? body.message.trim() : undefined;

      if (!message) {
              return NextResponse.json(
                { error: "Missing required field: message" },
                { status: 400 },
                      );
      }

      /**
           * Parse chat history
           */
      let history: Array<{ role: "user" | "assistant"; content: string }> = [];
          if (Array.isArray(body.history)) {
                  history = body.history
                    .filter(
                                (h: any) =>
                                              h &&
                                              typeof h.content === "string" &&
                                              (h.role === "user" || h.role === "assistant"),
                              )
                    .map((h: any) => ({
                                role: h.role as "user" | "assistant",
                                content: h.content as string,
                    }));
          }

      /**
           * Retrieve document context
           */
      const combinedDocumentText: string =
              typeof body.documentText === "string" ? body.documentText : "";

      if (!combinedDocumentText.trim()) {
              return NextResponse.json(
                {
                            error:
                                          "No document text provided. Please upload a file first.",
                },
                { status: 400 },
                      );
      }

      /**
           * Existing session ID (if provided)
           */
      let sessionId: string | null =
              typeof body.sessionId === "string" && body.sessionId.length > 0
              ? body.sessionId
                : null;

      /**
           * ===============================
           * CONTEXT WINDOW IMPLEMENTATION
           * ===============================
           */

      /**
           * Trim chat history
           */
      const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);

      /**
           * Trim document size
           */
      const trimmedDocument =
              combinedDocumentText.length > MAX_DOCUMENT_CHARS
              ? combinedDocumentText.slice(-MAX_DOCUMENT_CHARS)
                : combinedDocumentText;

      /**
           * System instruction
           */
      const system =
              'Answer ONLY using the provided document. If not found, reply exactly: "I could not find that in the document." Do not guess.';

      /**
           * Build prompt
           */
      const prompt = `
      DOCUMENT:
      ${trimmedDocument}

      QUESTION:
      ${message}
      `;

      /**
           * Initialize LLM
           */
      const client = getClient();

      /**
           * Persist user message to Supabase
           */
      try {
              const supabase = getSupabaseServerClient();

            if (!sessionId) {
                      const { data, error } = await supabase
                        .from("whiteboard_sessions")
                        .insert({ title: "Whiteboard Chat Session" })
                        .select("id")
                        .single();

                if (error) throw error;
                      if (!data) throw new Error("Failed to create session");

                sessionId = data.id as string;
            }

            await supabase.from("whiteboard_messages").insert([
              {
                          session_id: sessionId,
                          role: "user",
                          content: message,
              },
                    ]);
      } catch (err) {
              console.error("Supabase persistence error:", err);
      }

      /**
           * Send request to LLM
           */
      const resp = await client.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: system },
                        ...trimmedHistory.map((h) => ({
                                    role: h.role,
                                    content: h.content,
                        })),
                { role: "user", content: prompt },
                      ],
              temperature: 0,
              max_tokens: 500,
      });

      const answer = resp.choices?.[0]?.message?.content ?? "";

      /**
           * Save assistant response
           */
      if (sessionId) {
              try {
                        const supabase = getSupabaseServerClient();
                        await supabase.from("whiteboard_messages").insert([
                          {
                                        session_id: sessionId,
                                        role: "assistant",
                                        content: answer,
                          },
                                  ]);
              } catch (err) {
                        console.error("Supabase assistant persistence error:", err);
              }
      }

      /**
           * Return response
           */
      return NextResponse.json({
              answer,
              sessionId,
      });
    } catch (e: any) {
          console.error("Error handling /api/chat POST request:", e);

      if (e instanceof Error && e.message.includes("OPENAI_API_KEY")) {
              return NextResponse.json(
                { error: "Server is missing OPENAI_API_KEY" },
                { status: 500 },
                      );
      }

      return NextResponse.json(
        {
                  error:
                              e instanceof Error && e.message
                      ? e.message
                                : "Internal server error",
        },
        { status: 500 },
            );
    }
}
