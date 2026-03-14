export const runtime = "nodejs";

import { NextResponse } from "next/server";

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

  if (fileName.endsWith(".pptx")) {
    return NextResponse.json(
      {error: "PPTX parsing is not implemented yet." },
      { status: 501 }
    );
  } 

  return NextResponse.json(
    { error: "Unsupported file type." },
    { status: 400 }
  );

  } catch (error) {
    console.error("PDF parsing error:", error);

    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
