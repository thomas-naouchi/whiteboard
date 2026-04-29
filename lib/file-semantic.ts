import OpenAI from "openai";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;
const MAX_CHUNKS_PER_FILE = 12;
const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEmbeddingClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: OPENAI_API_KEY");
  }

  return new OpenAI({ apiKey });
}

export function buildSemanticChunks(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length && chunks.length < MAX_CHUNKS_PER_FILE) {
    const sliceEnd = Math.min(normalized.length, cursor + CHUNK_SIZE);
    let end = sliceEnd;

    if (sliceEnd < normalized.length) {
      const breakpoint = normalized.lastIndexOf(" ", sliceEnd);
      if (breakpoint > cursor + 300) {
        end = breakpoint;
      }
    }

    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
  }

  return chunks;
}

export async function createEmbeddings(texts: string[]) {
  if (texts.length === 0) {
    return [];
  }

  const client = getEmbeddingClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function isMissingChunksTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const err = error as { code?: string; message?: string; details?: string };
  const code = String(err.code ?? "");
  const text = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    text.includes("whiteboard_file_chunks") ||
    text.includes("chunk_text") ||
    text.includes("embedding")
  );
}

export function toNumericEmbedding(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const embedding = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item));

  return embedding.length > 0 ? embedding : null;
}
