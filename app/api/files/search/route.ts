import { NextResponse } from "next/server";
import { extractTextFromBuffer } from "@/lib/file-text";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const MAX_RESULTS = 6;
const EXCERPT_RADIUS = 120;
const STORAGE_BUCKET = "whiteboard-files";
const SEARCH_TEXT_LIMIT = 24_000;

type WhiteboardFileRow = {
  id: string;
  file_name: string;
  storage_path?: string | null;
  tags?: string[] | null;
  summary_excerpt?: string | null;
  search_text?: string | null;
  created_at?: string | null;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitQuery(query: string) {
  return normalizeWhitespace(query)
    .toLowerCase()
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function scoreRow(
  row: WhiteboardFileRow,
  query: string,
  queryTokens: string[],
) {
  const fileName = row.file_name.toLowerCase();
  const summary = (row.summary_excerpt ?? "").toLowerCase();
  const searchText = (row.search_text ?? "").toLowerCase();
  const tags = (row.tags ?? []).map((tag) => tag.toLowerCase());
  const normalizedQuery = query.toLowerCase();

  let score = 0;

  if (fileName.includes(normalizedQuery)) score += 30;
  if (summary.includes(normalizedQuery)) score += 45;
  if (searchText.includes(normalizedQuery)) score += 65;
  if (tags.some((tag) => tag.includes(normalizedQuery))) score += 25;

  for (const token of queryTokens) {
    if (fileName.includes(token)) score += 8;
    if (summary.includes(token)) score += 10;
    if (searchText.includes(token)) score += 12;
    if (tags.some((tag) => tag.includes(token))) score += 6;
  }

  return score;
}

function buildExcerpt(
  row: WhiteboardFileRow,
  query: string,
  queryTokens: string[],
) {
  const normalizedQuery = query.toLowerCase();
  const source = normalizeWhitespace(
    row.search_text ?? row.summary_excerpt ?? "",
  );

  if (!source) {
    return "No text preview available for this file yet.";
  }

  const lowered = source.toLowerCase();
  let matchIndex = lowered.indexOf(normalizedQuery);

  if (matchIndex < 0) {
    for (const token of queryTokens) {
      matchIndex = lowered.indexOf(token);
      if (matchIndex >= 0) break;
    }
  }

  if (matchIndex < 0) {
    return source.slice(0, EXCERPT_RADIUS * 2).trim();
  }

  const start = Math.max(0, matchIndex - EXCERPT_RADIUS);
  const end = Math.min(
    source.length,
    matchIndex + normalizedQuery.length + EXCERPT_RADIUS,
  );
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";

  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

function inferFileType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".pptx")) return "PPTX";
  if (lower.endsWith(".txt")) return "TXT";
  return "FILE";
}

function confidenceLabel(score: number) {
  if (score >= 95) return "Strong match";
  if (score >= 45) return "Possible match";
  return "Related";
}

function isMissingMetadataColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const err = error as { code?: string; message?: string; details?: string };
  const code = String(err.code ?? "");
  const text = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();

  return (
    code === "42703" ||
    code === "PGRST204" ||
    text.includes("search_text") ||
    text.includes("summary_excerpt") ||
    text.includes("tags")
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Failed to search files";
}

async function hydrateSearchText(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  row: WhiteboardFileRow,
) {
  const existingText = normalizeWhitespace(row.search_text ?? "");
  if (existingText) {
    return existingText;
  }

  if (!row.storage_path) {
    return null;
  }

  try {
    const download = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(row.storage_path);

    if (download.error) {
      console.error("Error downloading stored file:", download.error);
      return null;
    }

    const extracted = await extractTextFromBuffer(
      row.file_name,
      await download.data.arrayBuffer(),
    );

    return normalizeWhitespace(extracted).slice(0, SEARCH_TEXT_LIMIT);
  } catch (error) {
    console.error("Error extracting stored file text:", error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const query =
      typeof body?.query === "string" ? normalizeWhitespace(body.query) : "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required field: sessionId" },
        { status: 400 },
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: "Missing required field: query" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const queryBuilder = supabase
      .from("whiteboard_files")
      .select(
        "id, file_name, storage_path, tags, summary_excerpt, search_text, created_at",
      )
      .eq("session_id", sessionId);

    let { data, error } = await queryBuilder.order("created_at", {
      ascending: false,
    });

    if (error && isMissingMetadataColumnError(error)) {
      const fallbackWithPartialMetadata = await supabase
        .from("whiteboard_files")
        .select("id, file_name, storage_path, tags, summary_excerpt, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      data = (fallbackWithPartialMetadata.data ?? []).map((row) => ({
        ...row,
        search_text: null,
      }));
      error = fallbackWithPartialMetadata.error;
    }

    if (error && isMissingMetadataColumnError(error)) {
      const fallbackBasic = await supabase
        .from("whiteboard_files")
        .select("id, file_name, storage_path, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      data = (fallbackBasic.data ?? []).map((row) => ({
        ...row,
        tags: [],
        summary_excerpt: null,
        search_text: null,
      }));
      error = fallbackBasic.error;
    }

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as WhiteboardFileRow[];
    const queryTokens = splitQuery(query);
    const hydratedRows = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        search_text: await hydrateSearchText(supabase, row),
      })),
    );

    const results = hydratedRows
      .map((row) => {
        const score = scoreRow(row, query, queryTokens);
        return {
          id: row.id,
          fileName: row.file_name,
          fileType: inferFileType(row.file_name),
          confidence: confidenceLabel(score),
          matchedText: buildExcerpt(row, query, queryTokens),
          summary:
            row.summary_excerpt ??
            "Stored in this session and available to search.",
          pageLabel: row.search_text ? "Stored excerpt" : "Stored summary",
          score,
        };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(({ score, ...result }) => result);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error searching files:", error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
