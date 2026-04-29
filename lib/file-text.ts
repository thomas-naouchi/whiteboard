import * as officeParser from "officeparser";
import pdf from "pdf-parse";

function sanitizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
}

export async function extractTextFromBuffer(
  fileName: string,
  arrayBuffer: ArrayBuffer,
): Promise<string> {
  const lowerName = fileName.toLowerCase();
  const buffer = Buffer.from(arrayBuffer);

  if (lowerName.endsWith(".txt")) {
    return sanitizeExtractedText(buffer.toString("utf-8"));
  }

  if (lowerName.endsWith(".pdf")) {
    const result = await pdf(buffer);
    return sanitizeExtractedText(result.text);
  }

  if (lowerName.endsWith(".pptx")) {
    const ast = await officeParser.parseOffice(buffer);
    return sanitizeExtractedText(ast.toText());
  }

  throw new Error("Unsupported file type. Allowed: .txt, .pdf, .pptx");
}

export async function extractTextFromFile(file: File): Promise<string> {
  return extractTextFromBuffer(file.name, await file.arrayBuffer());
}
