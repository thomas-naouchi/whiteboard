import OpenAI from "openai";
import { NextResponse } from "next/server";
import * as officeParser from "officeparser";
import pdf from "pdf-parse";

export const runtime = "nodejs";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
}

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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const rawMessage = formData.get("message");
    const rawHistory = formData.get("history");
    const rawPersistedDoc = formData.get("persistedDocumentText");

    const message =
      typeof rawMessage === "string" ? rawMessage.trim() : undefined;

    if (!message) {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 },
      );
    }

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
        // ignore malformed history
      }
    }

    let combinedDocumentText =
      typeof rawPersistedDoc === "string" ? rawPersistedDoc : "";

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

    const system =
      'Answer ONLY using the provided document. If not found, reply exactly: "I could not find that in the document." Do not guess.';

    const prompt = `DOCUMENT:\n${combinedDocumentText}\n\nQUESTION:\n${message}`;

    const client = getClient();
    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system" as const, content: system },
        ...history.map((h) => ({
          role: h.role,
          content: h.content,
        })),
        { role: "user" as const, content: prompt },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    return NextResponse.json({
      answer: resp.choices?.[0]?.message?.content ?? "",
      documentText: combinedDocumentText,
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
