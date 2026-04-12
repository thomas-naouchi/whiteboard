import JSZip from "jszip";
import { NextResponse } from "next/server";
import {
  buildSortingPlan,
  resolveSortingIntent,
  sanitizeSortPathSegment,
  SORTABLE_FILE_LIMIT,
  type SortScope,
  type SortableFileRecord,
} from "@/lib/file-sorting";
import { isMissingMetadataColumnsError } from "@/lib/file-metadata";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const STORAGE_BUCKET = "whiteboard-files";

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

async function fetchFiles(params: {
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

function uniqueFileName(
  seen: Map<string, number>,
  baseFolderPath: string,
  fileName: string,
) {
  const sanitizedName = sanitizeSortPathSegment(fileName);
  const key = `${baseFolderPath}/${sanitizedName}`;
  const count = seen.get(key) ?? 0;

  if (count === 0) {
    seen.set(key, 1);
    return sanitizedName;
  }

  seen.set(key, count + 1);

  const dotIndex = sanitizedName.lastIndexOf(".");
  if (dotIndex < 0) {
    return `${sanitizedName} (${count + 1})`;
  }

  const name = sanitizedName.slice(0, dotIndex);
  const extension = sanitizedName.slice(dotIndex);
  return `${name} (${count + 1})${extension}`;
}

export async function POST(req: Request) {
  try {
    const requestBody = (await req.json()) as {
      sessionId?: unknown;
      scope?: unknown;
      selectedFileIds?: unknown;
      instruction?: unknown;
    };

    const sessionId =
      typeof requestBody.sessionId === "string"
        ? requestBody.sessionId.trim()
        : "";
    const scope: SortScope =
      requestBody.scope === "selected" ? "selected" : "session";
    const selectedFileIds = Array.isArray(requestBody.selectedFileIds)
      ? requestBody.selectedFileIds.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];
    const instruction =
      typeof requestBody.instruction === "string"
        ? requestBody.instruction
        : "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId for export." },
        { status: 400 },
      );
    }

    if (scope === "selected" && selectedFileIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one file before exporting a selected-file sort." },
        { status: 400 },
      );
    }

    const files = await fetchFiles({
      sessionId,
      scope,
      selectedFileIds,
    });

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files were available to export in this scope." },
        { status: 400 },
      );
    }

    if (files.length > SORTABLE_FILE_LIMIT) {
      return NextResponse.json(
        {
          error: `Sorting export is limited to ${SORTABLE_FILE_LIMIT} files at a time for now.`,
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
    const fileMap = new Map(files.map((file) => [file.id, file]));
    const zip = new JSZip();
    const seenNames = new Map<string, number>();
    const supabase = getSupabaseServerClient();

    for (const view of plan.views) {
      for (const folder of view.folders) {
        const folderPath = `${plan.exportName}/${view.rootFolder}/${sanitizeSortPathSegment(folder.name)}`;

        for (const fileRef of folder.files) {
          const file = fileMap.get(fileRef.id);

          if (!file) {
            continue;
          }

          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(file.storagePath);

          if (error) {
            throw error;
          }

          const uniqueNameForFolder = uniqueFileName(
            seenNames,
            folderPath,
            file.fileName,
          );
          const buffer = Buffer.from(await data.arrayBuffer());
          zip.file(`${folderPath}/${uniqueNameForFolder}`, buffer);
        }
      }
    }

    zip.file(
      `${plan.exportName}/manifest.json`,
      JSON.stringify(plan, null, 2),
    );
    zip.file(
      `${plan.exportName}/README.txt`,
      [
        "Whiteboard sorting export",
        "",
        `Scope: ${plan.scopeLabel}`,
        `Files: ${plan.totalFiles}`,
        `Instruction: ${plan.instructions}`,
        "",
        "This package contains three parallel folder systems:",
        "- by-type",
        "- by-date",
        "- by-content",
      ].join("\n"),
    );

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const zipBody = new Uint8Array(buffer);

    return new NextResponse(zipBody, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${plan.exportName}.zip"`,
        "Content-Length": String(zipBody.byteLength),
      },
    });
  } catch (error) {
    console.error("POST /api/files/sort/export error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
