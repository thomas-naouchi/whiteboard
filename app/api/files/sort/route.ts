import { NextResponse } from "next/server";
import {
  buildSortingPlan,
  resolveSortingIntent,
  SORTABLE_FILE_LIMIT,
  type SortScope,
  type SortableFileRecord,
} from "@/lib/file-sorting";
import { isMissingMetadataColumnsError } from "@/lib/file-metadata";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type WhiteboardFileRow = {
  id: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  byte_size: number | null;
  created_at: string | null;
  tags: string[] | null;
  summary_excerpt: string | null;
  search_text: string | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "Internal server error";
}

async function fetchSessionFiles(params: {
  sessionId: string;
  scope: SortScope;
  selectedFileIds: string[];
}) {
  const supabase = getSupabaseServerClient();
  const applyScope = <T extends { in: Function }>(query: T) =>
    params.scope === "selected"
      ? (query.in("id", params.selectedFileIds) as T)
      : query;

  let { data, error } = await applyScope(
    supabase
      .from("whiteboard_files")
      .select(
        "id, file_name, storage_path, content_type, byte_size, created_at, tags, summary_excerpt, search_text",
      )
      .eq("session_id", params.sessionId)
      .order("created_at", { ascending: false }),
  );

  if (error && isMissingMetadataColumnsError(error)) {
    const fallbackResult = await applyScope(
      supabase
        .from("whiteboard_files")
        .select("id, file_name, storage_path, content_type, byte_size, created_at")
        .eq("session_id", params.sessionId)
        .order("created_at", { ascending: false }),
    );

    data = (fallbackResult.data ?? []).map((row) => ({
      ...row,
      tags: null,
      summary_excerpt: null,
      search_text: null,
    })) as WhiteboardFileRow[];
    error = fallbackResult.error;
  }

  if (error) {
    throw error;
  }

  return ((data ?? []) as WhiteboardFileRow[]).map(
    (row): SortableFileRecord => ({
      id: row.id,
      fileName: row.file_name,
      storagePath: row.storage_path,
      contentType: row.content_type,
      byteSize: Number(row.byte_size ?? 0),
      createdAt: row.created_at,
      tags: Array.isArray(row.tags) ? row.tags : [],
      summaryExcerpt: row.summary_excerpt,
      searchText: row.search_text,
    }),
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: unknown;
      scope?: unknown;
      selectedFileIds?: unknown;
      instruction?: unknown;
    };

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const scope: SortScope = body.scope === "selected" ? "selected" : "session";
    const selectedFileIds = Array.isArray(body.selectedFileIds)
      ? body.selectedFileIds.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];
    const instruction =
      typeof body.instruction === "string" ? body.instruction : "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId for sorting." },
        { status: 400 },
      );
    }

    if (scope === "selected" && selectedFileIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one file before starting a selected-file sort." },
        { status: 400 },
      );
    }

    const files = await fetchSessionFiles({
      sessionId,
      scope,
      selectedFileIds,
    });

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files were available to sort in this scope." },
        { status: 400 },
      );
    }

    if (files.length > SORTABLE_FILE_LIMIT) {
      return NextResponse.json(
        {
          error: `Sorting is limited to ${SORTABLE_FILE_LIMIT} files at a time for now. Narrow the scope and try again.`,
        },
        { status: 400 },
      );
    }

    const resolvedIntent = await resolveSortingIntent(instruction);
    const plan = buildSortingPlan({
      files,
      scope,
      instruction,
      resolvedIntent,
    });

    return NextResponse.json({
      plan,
    });
  } catch (error) {
    console.error("POST /api/files/sort error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
