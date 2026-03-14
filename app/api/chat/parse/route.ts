export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const pdfParse = (await import("pdf-parse")) as any;

    const data = await pdfParse(buffer);

    return NextResponse.json({
      text: data.text,
    });
  } catch (error) {
    console.error("PDF parsing error:", error);

    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
