import * as officeParser from "officeparser";
import pdf from "pdf-parse";

export async function extractTextFromBuffer(
  fileName: string,
  arrayBuffer: ArrayBuffer,
): Promise<string> {
  const lowerName = fileName.toLowerCase();
  const buffer = Buffer.from(arrayBuffer);

  if (lowerName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (lowerName.endsWith(".pdf")) {
    const result = await pdf(buffer);
    return result.text;
  }

  if (lowerName.endsWith(".pptx")) {
    const ast = await officeParser.parseOffice(buffer);
    return ast.toText();
  }

  throw new Error("Unsupported file type. Allowed: .txt, .pdf, .pptx");
}

export async function extractTextFromFile(file: File): Promise<string> {
  return extractTextFromBuffer(file.name, await file.arrayBuffer());
}
