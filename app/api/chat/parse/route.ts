/**
 * File Parse API Route
 *
 * Parses a file and returns its text content. Accepts two input modes:
 *
 * 1. multipart/form-data with a "file" field (direct upload)
 * 2. JSON body { storagePath: string } — downloads the file from Supabase
 *    Storage and parses it (used when re-parsing files loaded from the DB)
 *
 * Supported formats: .txt, .pdf, .docx, .pptx
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import pdf from "pdf-parse";
import { parseOffice } from "officeparser";

const BUCKET = "whiteboard-files";

async function parseBuffer(fileName: string, buffer: Buffer): Promise<string | null> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (lower.endsWith(".pdf")) {
    const data = await pdf(buffer);
    return data.text;
  }

  if (lower.endsWith(".docx") || lower.endsWith(".pptx")) {
    const ast = await parseOffice(buffer);
    return ast.toText();
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // --- Mode 1: re-parse a file already in Supabase Storage ---
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { storagePath?: string };

      if (!body.storagePath) {
        return NextResponse.json(
          { error: "Missing storagePath" },
          { status: 400 },
        );
      }

      const supabase = getSupabaseServerClient();
      const { data: blob, error } = await supabase.storage
        .from(BUCKET)
        .download(body.storagePath);

      if (error || !blob) {
        return NextResponse.json(
          { error: "Failed to download file from storage" },
          { status: 500 },
        );
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      const fileName = body.storagePath.split("/").pop() ?? "";
      // Strip the UUID prefix from the stored path (format: uploads/<uuid>-<originalName>)
      const originalName = fileName.replace(/^[0-9a-f-]{36}-/, "");
      const text = await parseBuffer(originalName || fileName, buffer);

      if (text === null) {
        return NextResponse.json(
          { error: "Unsupported file type" },
          { status: 400 },
        );
      }

      return NextResponse.json({ text });
    }

    // --- Mode 2: direct file upload via multipart/form-data ---
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseBuffer(file.name, buffer);

    if (text === null) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: .pdf, .txt, .docx, .pptx" },
        { status: 400 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("File parsing error:", error);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
