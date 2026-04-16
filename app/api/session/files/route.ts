import { NextResponse } from "next/server";
import {
  buildSearchText,
  buildSummaryExcerpt,
  generateTags,
  isMissingMetadataColumnsError,
  sanitizeStorageFileName,
} from "@/lib/file-metadata";
import {
  buildSemanticChunks,
  createEmbeddings,
  isMissingChunksTableError,
} from "@/lib/file-semantic";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { extractTextFromFile } from "@/lib/file-text";

export const runtime = "nodejs";
const STORAGE_BUCKET = "whiteboard-files";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof maybeError.message === "string" ? maybeError.message : "",
      typeof maybeError.details === "string" ? maybeError.details : "",
      typeof maybeError.hint === "string" ? maybeError.hint : "",
      typeof maybeError.code === "string" ? `code: ${maybeError.code}` : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return "Internal server error";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId || sessionId.trim().length === 0) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whiteboard_files")
      .select("id, file_name, byte_size, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase files fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const files = (data ?? []).map((file) => ({
      id: file.id,
      fileName: file.file_name ?? "Untitled file",
      size: Number(file.byte_size ?? 0),
      isSelected: true,
      isPersisted: true,
    }));

    return NextResponse.json({ files });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Supabase is not configured")
    ) {
      return NextResponse.json({ files: [] });
    }

    console.error("GET /api/session/files error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const rawSessionId = formData.get("sessionId");

    const uploadedFiles = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one file." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    let sessionId =
      typeof rawSessionId === "string" && rawSessionId.trim().length > 0
        ? rawSessionId.trim()
        : null;

    if (!sessionId) {
      const { data, error } = await supabase
        .from("whiteboard_sessions")
        .insert({
          title: "Whiteboard Chat Session",
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      sessionId = data.id as string;
    }

    const savedFiles = [];

    for (const file of uploadedFiles) {
      const extractedText = await extractTextFromFile(file);
      const generatedTags = generateTags(file.name, extractedText);
      const summaryExcerpt = buildSummaryExcerpt(extractedText);
      const searchText = buildSearchText(extractedText);
      const path = `${sessionId}/${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      let insertResult = await supabase
        .from("whiteboard_files")
        .insert({
          session_id: sessionId,
          file_name: file.name,
          storage_path: path,
          content_type: file.type || null,
          byte_size: file.size,
          tags: generatedTags,
          summary_excerpt: summaryExcerpt,
          search_text: searchText,
        })
        .select("id, file_name, byte_size")
        .single();

      if (
        insertResult.error &&
        isMissingMetadataColumnsError(insertResult.error)
      ) {
        insertResult = await supabase
          .from("whiteboard_files")
          .insert({
            session_id: sessionId,
            file_name: file.name,
            storage_path: path,
            content_type: file.type || null,
            byte_size: file.size,
          })
          .select("id, file_name, byte_size")
          .single();
      }

      if (insertResult.error) {
        throw insertResult.error;
      }

      try {
        const semanticChunks = buildSemanticChunks(extractedText);
        if (semanticChunks.length > 0) {
          const embeddings = await createEmbeddings(semanticChunks);
          const chunkRows = semanticChunks.map((chunkText, index) => ({
            file_id: insertResult.data.id,
            session_id: sessionId,
            chunk_index: index,
            chunk_text: chunkText,
            embedding: embeddings[index],
          }));

          const { error: chunkInsertError } = await supabase
            .from("whiteboard_file_chunks")
            .insert(chunkRows);

          if (chunkInsertError && !isMissingChunksTableError(chunkInsertError)) {
            throw chunkInsertError;
          }
        }
      } catch (chunkError) {
        if (!isMissingChunksTableError(chunkError)) {
          console.error("Semantic chunk persistence error:", chunkError);
        }
      }

      savedFiles.push({
        id: insertResult.data.id,
        fileName: insertResult.data.file_name ?? file.name,
        size: Number(insertResult.data.byte_size ?? file.size),
        isSelected: true,
        isPersisted: true,
      });
    }

    return NextResponse.json({ sessionId, files: savedFiles });
  } catch (error) {
    console.error("POST /api/session/files error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const fileId = typeof body?.fileId === "string" ? body.fileId.trim() : "";

    if (!sessionId || !fileId) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId and fileId" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: targetFile, error: targetError } = await supabase
      .from("whiteboard_files")
      .select("id, storage_path")
      .eq("id", fileId)
      .eq("session_id", sessionId)
      .single();

    if (targetError || !targetFile) {
      return NextResponse.json(
        { error: "File not found in this session." },
        { status: 404 },
      );
    }

    const { error: chunksDeleteError } = await supabase
      .from("whiteboard_file_chunks")
      .delete()
      .eq("file_id", fileId)
      .eq("session_id", sessionId);

    if (chunksDeleteError && !isMissingChunksTableError(chunksDeleteError)) {
      throw chunksDeleteError;
    }

    const { error: rowDeleteError } = await supabase
      .from("whiteboard_files")
      .delete()
      .eq("id", fileId)
      .eq("session_id", sessionId);

    if (rowDeleteError) {
      throw rowDeleteError;
    }

    const storagePath =
      typeof targetFile.storage_path === "string"
        ? targetFile.storage_path
        : null;

    if (storagePath) {
      const { error: storageDeleteError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);

      if (storageDeleteError) {
        console.error("Storage file delete warning:", storageDeleteError);
      }
    }

    const { data: remainingFiles, error: fetchError } = await supabase
      .from("whiteboard_files")
      .select("id, file_name, byte_size, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    const files = (remainingFiles ?? []).map((file) => ({
      id: file.id,
      fileName: file.file_name ?? "Untitled file",
      size: Number(file.byte_size ?? 0),
      isSelected: true,
      isPersisted: true,
    }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("DELETE /api/session/files error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
