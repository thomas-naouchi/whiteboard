const MAX_GENERATED_TAGS = 12;
const MAX_TAG_LENGTH = 32;
const EXCERPT_LENGTH = 280;
const SEARCH_TEXT_LIMIT = 24_000;

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "done",
  "during",
  "each",
  "either",
  "for",
  "from",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "me",
  "more",
  "most",
  "my",
  "no",
  "not",
  "now",
  "of",
  "on",
  "one",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "same",
  "she",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
]);

function normalizeTag(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();
}

function tokenize(raw: string) {
  const matches = raw.match(/[a-zA-Z][a-zA-Z0-9_-]{2,}/g) ?? [];
  return matches
    .map((value) => normalizeTag(value))
    .filter(
      (value) =>
        value.length >= 3 &&
        value.length <= MAX_TAG_LENGTH &&
        !STOP_WORDS.has(value),
    );
}

function fileTypeTag(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".pptx")) return "presentation";
  if (lower.endsWith(".txt")) return "text";
  return null;
}

export function generateTags(fileName: string, extractedText: string) {
  const score = new Map<string, number>();

  const baseName = fileName.replace(/\.[^.]+$/, "");
  for (const token of tokenize(baseName)) {
    score.set(token, (score.get(token) ?? 0) + 8);
  }

  const sampledText = extractedText.slice(0, 20_000);
  for (const token of tokenize(sampledText)) {
    score.set(token, (score.get(token) ?? 0) + 1);
  }

  const detectedType = fileTypeTag(fileName);
  if (detectedType) {
    score.set(detectedType, (score.get(detectedType) ?? 0) + 6);
  }

  return Array.from(score.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, MAX_GENERATED_TAGS);
}

export function buildSummaryExcerpt(extractedText: string) {
  const compact = extractedText
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return null;
  return compact.slice(0, EXCERPT_LENGTH);
}

export function buildSearchText(extractedText: string) {
  const compact = extractedText
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return null;
  return compact.slice(0, SEARCH_TEXT_LIMIT);
}

export function sanitizeStorageFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function isMissingMetadataColumnsError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const err = error as { code?: string; message?: string; details?: string };
  const code = String(err.code ?? "");
  const text = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();

  return (
    code === "42703" ||
    code === "PGRST204" ||
    text.includes("tags") ||
    text.includes("summary_excerpt") ||
    text.includes("search_text")
  );
}
