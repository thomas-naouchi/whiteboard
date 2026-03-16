/**
 * File Parse API Route
 *
 * Parses uploaded files and returns their text content.
 * Supported formats: .pdf, .docx, .pptx
 *
 * Uses:
 *  - pdf-parse  for PDF files
 *  - officeparser for DOCX and PPTX files (avoids writing temp files to disk)
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { parseOffice } from "officeparser";

export async function POST(req: Request) {
    try {
          const formData = await req.formData();
          const file = formData.get("file") as File | null;

      if (!file) {
              return NextResponse.json(
                { error: "No file uploaded" },
                { status: 400 },
                      );
      }

      const fileName = file.name.toLowerCase();
          const buffer = Buffer.from(await file.arrayBuffer());

      if (fileName.endsWith(".pdf")) {
              const data = await pdf(buffer);
              return NextResponse.json({ text: data.text });
      }

      if (fileName.endsWith(".docx") || fileName.endsWith(".pptx")) {
              // officeparser v6+ returns an AST; call .toText() for plain text
            const ast = await parseOffice(buffer);
              return NextResponse.json({ text: ast.toText() });
      }

      return NextResponse.json(
        { error: "Unsupported file type. Allowed: .pdf, .docx, .pptx" },
        { status: 400 },
            );
    } catch (error) {
          console.error("File parsing error:", error);
          return NextResponse.json(
            { error: "Failed to parse file" },
            { status: 500 },
                );
    }
}
