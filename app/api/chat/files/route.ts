/**
 * Chat Files API Route
 *
 * GET  /api/chat/files?sessionId=xxx
 *   Returns all files uploaded for a session from whiteboard_files.
 *
 * DELETE /api/chat/files
 *   Body: { storagePath: string }
 *   Removes the file from Supabase Storage and the whiteboard_files table.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const BUCKET = "whiteboard-files";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("whiteboard_files")
      .select("id, file_name, storage_path, byte_size")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const files = (data ?? []).map((row) => ({
      id: row.id as string,
      fileName: row.file_name as string,
      storagePath: row.storage_path as string,
      text: "",       // text is not stored; will be re-parsed on demand
      size: (row.byte_size as number) ?? 0,
    }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("GET /api/chat/files error:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { storagePath?: string };
    const { storagePath } = body;

    if (!storagePath) {
      return NextResponse.json(
        { error: "Missing storagePath" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    // Remove from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Remove from whiteboard_files table (match by storage path)
    const { error: dbError } = await supabase
      .from("whiteboard_files")
      .delete()
      .eq("storage_path", storagePath);

    if (dbError) {
      console.error("DB delete error:", dbError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/chat/files error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
