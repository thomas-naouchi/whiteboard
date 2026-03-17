/**
 * File Upload API Route
 *
 * Accepts a single file via multipart/form-data, uploads it to Supabase
 * Storage (bucket: whiteboard-files), parses its text content, and returns
 * the storage path and extracted text for use by the chat API.
 *
 * Supported formats: .txt, .pdf, .docx, .pptx
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import pdf from "pdf-parse";
import { parseOffice } from "officeparser";

const BUCKET = "whiteboard-files";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name;
    const lower = fileName.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse text content from the file
    let text = "";
    if (lower.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else if (lower.endsWith(".pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    } else if (lower.endsWith(".docx") || lower.endsWith(".pptx")) {
      const ast = await parseOffice(buffer);
      text = ast.toText();
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: .pdf, .txt, .docx, .pptx" },
        { status: 400 },
      );
    }

    // Upload to Supabase Storage
    const supabase = getSupabaseServerClient();
    const uuid = crypto.randomUUID();
    const storagePath = `uploads/${uuid}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 },
      );
    }

    return NextResponse.json({ storagePath, fileName, text });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 },
    );
  }
}
