/**
 * Chat API Route
 *
 * Responsibilities:
 * 1. Receive user message + chat history + uploaded files
 * 2. Extract readable text from supported files
 * 3. Maintain document context across messages
 * 4. Apply a CONTEXT WINDOW (limit history + document size)
 * 5. Send request to the LLM
 * 6. Persist chat messages and files to Supabase
 */

import OpenAI from "openai";
import { NextResponse } from "next/server";
import * as officeParser from "officeparser";
import pdf from "pdf-parse";
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
 * Supabase Storage bucket
 */
const STORAGE_BUCKET = "whiteboard-files";

/**
 * Initialize OpenAI client
 */
function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing environment variable: OPENAI_API_KEY");
  }

  return new OpenAI({ apiKey });

  /**
   * To test with GROK instead:
   *
   * return new OpenAI({
   *   apiKey,
   *   baseURL: "https://api.x.ai/v1"
   * });
   */
}

/**
 * Sanitize file names before storing them
 */
function sanitizeStorageFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Extract text from uploaded files
 */
async function extractTextFromFile(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".txt")) {
    return await file.text();
  }

  if (lowerName.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdf(buffer);
    return result.text;
  }

  if (lowerName.endsWith(".pptx")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ast = await officeParser.parseOffice(buffer);
    return ast.toText();
  }

  throw new Error("Unsupported file type. Allowed: .txt, .pdf, .pptx");
}

/**
 * Main API handler
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    /**
     * Extract form fields
     */
    const rawMessage = formData.get("message");
    const rawHistory = formData.get("history");
    const rawPersistedDoc = formData.get("persistedDocumentText");
    const rawSessionId = formData.get("sessionId");

    const message =
      typeof rawMessage === "string" ? rawMessage.trim() : undefined;

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

    if (typeof rawHistory === "string" && rawHistory.length > 0) {
      try {
        const parsed = JSON.parse(rawHistory);

        if (Array.isArray(parsed)) {
          history = parsed
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
      } catch {
        // Ignore malformed history
      }
    }

    /**
     * Retrieve existing document context
     */
    let combinedDocumentText =
      typeof rawPersistedDoc === "string" ? rawPersistedDoc : "";

    /**
     * Existing session ID (if provided)
     */
    let sessionId =
      typeof rawSessionId === "string" && rawSessionId.length > 0
        ? rawSessionId
        : null;

    /**
     * Handle uploaded files
     */
    const uploadedFiles = formData
      .getAll("files")
      .filter((v): v is File => v instanceof File);

    if (uploadedFiles.length > 0) {
      const parts: string[] = [];

      for (const file of uploadedFiles) {
        const text = await extractTextFromFile(file);

        if (text.trim()) {
          parts.push(`# ${file.name}\n${text}`);
        }
      }

      const newDocText = parts.join("\n\n");

      if (newDocText) {
        combinedDocumentText = combinedDocumentText
          ? `${combinedDocumentText}\n\n${newDocText}`
          : newDocText;
      }
    }

    if (!combinedDocumentText) {
      return NextResponse.json(
        {
          error:
            "No readable content found in uploaded documents. Please upload a .txt, .pdf, or .pptx file containing text.",
        },
        { status: 400 },
      );
    }

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
          .insert({
            title: "Whiteboard Chat Session",
          })
          .select("id")
          .single();

        if (error) throw error;

        if (!data) {
          throw new Error("Failed to create session");
        }

        sessionId = data.id as string;
      }

      await supabase.from("whiteboard_messages").insert([
        {
          session_id: sessionId,
          role: "user",
          content: message,
        },
      ]);

      /**
       * Store uploaded files in Supabase Storage
       */
      if (uploadedFiles.length > 0 && sessionId) {
        for (const file of uploadedFiles) {
          const path = `${sessionId}/${crypto.randomUUID()}-${sanitizeStorageFileName(
            file.name,
          )}`;

          const buffer = Buffer.from(await file.arrayBuffer());

          await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
            contentType: file.type || "application/octet-stream",
          });
        }
      }
    } catch (err) {
      console.error("Supabase persistence error:", err);
    }

    /**
     * Send request to LLM
     */
    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",

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
      documentText: combinedDocumentText,
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
          e instanceof Error && e.message ? e.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
