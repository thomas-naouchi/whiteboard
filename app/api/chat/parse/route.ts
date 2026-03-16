/**
 * File Parse API Route
 *
 * Parses an uploaded file and returns its plain text.
 * Optionally uploads the raw file to Supabase Storage when a sessionId is provided.
 *
 * Supported formats: .txt, .pdf, .docx, .pptx
 *
 * Request  : multipart/form-data
 *   - file      : File  (required)
 *   - sessionId : string (optional) — stored to Supabase Storage + whiteboard_files table
 *
 * Response : JSON
 *   - text        : string        — extracted plain text
 *   - storagePath : string | null — Supabase Storage path, or null if not persisted
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { parseOffice } from "officeparser";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STORAGE_BUCKET = "whiteboard-files";

/** Replace characters that Supabase Storage rejects in object keys */
function sanitizeFileName(name: string): string {
      return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
      try {
              const formData = await req.formData();
              const file = formData.get("file") as File | null;
              const rawSessionId = formData.get("sessionId");
              const sessionId =
                        typeof rawSessionId === "string" && rawSessionId.trim().length > 0
                  ? rawSessionId.trim()
                          : null;

        if (!file) {
                  return NextResponse.json(
                      { error: "No file uploaded" },
                      { status: 400 },
                            );
        }

        const fileName = file.name.toLowerCase();
              const buffer = Buffer.from(await file.arrayBuffer());

        // ── 1. Extract text ──────────────────────────────────────────────────────
        let text = "";

        if (fileName.endsWith(".txt")) {
                  text = buffer.toString("utf-8");
        } else if (fileName.endsWith(".pdf")) {
                  const data = await pdf(buffer);
                  text = data.text;
        } else if (fileName.endsWith(".docx") || fileName.endsWith(".pptx")) {
                  // officeparser v6+ returns an AST; .toText() yields plain text
                const ast = await parseOffice(buffer);
                  text = ast.toText();
        } else {
                  return NextResponse.json(
                      { error: "Unsupported file type. Allowed: .txt, .pdf, .docx, .pptx" },
                      { status: 400 },
                            );
        }

        // ── 2. Upload raw file to Supabase Storage (when sessionId is available) ─
        let storagePath: string | null = null;

        if (sessionId) {
                  try {
                              const supabase = getSupabaseServerClient();
                              const safeName = sanitizeFileName(file.name);
                              const path = `${sessionId}/${crypto.randomUUID()}-${safeName}`;

                    const { error: uploadError } = await supabase.storage
                                .from(STORAGE_BUCKET)
                                .upload(path, buffer, {
                                                contentType: file.type || "application/octet-stream",
                                });

                    if (uploadError) {
                                  console.error("Supabase Storage upload error:", uploadError);
                    } else {
                                  storagePath = path;

                                // Record the file in the whiteboard_files table
                                const { error: dbError } = await supabase
                                    .from("whiteboard_files")
                                    .insert({
                                                      session_id: sessionId,
                                                      file_name: file.name,
                                                      storage_path: path,
                                                      content_type: file.type || "application/octet-stream",
                                                      byte_size: file.size,
                                    });

                                if (dbError) {
                                                console.error("Supabase whiteboard_files insert error:", dbError);
                                }
                    }
                  } catch (err) {
                              // Never let storage errors break the text extraction response
                    console.error("Supabase file persistence error:", err);
                  }
        }

        return NextResponse.json({ text, storagePath });
      } catch (error) {
              console.error("File parsing error:", error);
              return NextResponse.json(
                  { error: "Failed to parse file" },
                  { status: 500 },
                      );
      }
}
