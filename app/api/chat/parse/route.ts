export const runtime = "nodejs";

import { NextResponse } from "next/server";

const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");
const parsePptx = require("pptx-text-parser");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const fileName = file.name.toLowerCase();

    const buffer = Buffer.from(await file.arrayBuffer());

  if (fileName.endsWith(".pdf")) {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);

    return NextResponse.json({
      text: data.text,
    });
  }

  if (fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });

      return NextResponse.json({
        text: result.value,
      });
    }

  if (fileName.endsWith(".pptx")) {
    const tempPath = path.join(process.cwd(), "temp.pptx");

    fs.writeFileSync(tempPath, buffer);

    const text = await parsePptx(tempPath);

    fs.unlinkSync(tempPath); // delete temp file

    return NextResponse.json({
      text,
    });
  }

  return NextResponse.json(
    { error: "Unsupported file type." },
    { status: 400 }
  );

  } catch (error) {
    console.error("File parsing error:", error);

    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
