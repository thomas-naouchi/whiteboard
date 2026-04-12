import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildSearchText,
  buildSummaryExcerpt,
  generateTags,
  isMissingMetadataColumnsError,
  sanitizeStorageFileName,
} from "@/lib/file-metadata";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { extractTextFromFile } from "@/lib/file-text";

export const runtime = "nodejs";

type StoredSessionFile = {
  id: string;
  file_name: string;
  storage_path: string;
};

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
}

const STORAGE_BUCKET = "whiteboard-files";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const rawMessage = formData.get("message");
    const rawHistory = formData.get("history");
    const rawPersistedDoc = formData.get("persistedDocumentText");
    const rawSessionId = formData.get("sessionId");
    const rawSelectedFileIds = formData.get("selectedFileIds");

    const message =
      typeof rawMessage === "string" ? rawMessage.trim() : undefined;

    if (!message) {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 },
      );
    }

    let history: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (typeof rawHistory === "string" && rawHistory.length > 0) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          history = parsed
            .filter(
              (h: any) =>
                h &&
                typeof h.content === "string" &&
                (h.role === "user" || h.role === "assistant"),
            )
            .map((h: any) => ({
              role: h.role as "user" | "assistant",
              content: h.content as string,
            }));
        }
      } catch {
        // ignore malformed history
      }
    }

    let combinedDocumentText =
      typeof rawPersistedDoc === "string" ? rawPersistedDoc : "";

    let sessionId =
      typeof rawSessionId === "string" && rawSessionId.length > 0
        ? rawSessionId
        : null;

    let selectedFileIds: string[] = [];
    if (typeof rawSelectedFileIds === "string" && rawSelectedFileIds.length > 0) {
      try {
        const parsed = JSON.parse(rawSelectedFileIds);
        if (Array.isArray(parsed)) {
          selectedFileIds = parsed.filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          );
        }
      } catch {
        // ignore malformed selection payload
      }
    }

    const uploadedFiles = formData
      .getAll("files")
      .filter((v): v is File => v instanceof File);

    const processedUploads: Array<{
      file: File;
      extractedText: string;
      generatedTags: string[];
      summaryExcerpt: string | null;
      searchText: string | null;
    }> = [];

    if (uploadedFiles.length > 0) {
      const parts: string[] = [];
      for (const file of uploadedFiles) {
        const text = await extractTextFromFile(file);
        processedUploads.push({
          file,
          extractedText: text,
          generatedTags: generateTags(file.name, text),
          summaryExcerpt: buildSummaryExcerpt(text),
          searchText: buildSearchText(text),
        });

        if (text.trim()) {
          parts.push(`# ${file.name}\n${text}`);
        }
      }

      const newDocText = parts.join("\n\n");
      if (newDocText) {
        combinedDocumentText = combinedDocumentText
          ? `${combinedDocumentText}\n\n${newDocText}`
          : newDocText;
      }
    }

    if (selectedFileIds.length > 0 && sessionId) {
      try {
        const supabase = getSupabaseServerClient();
        const { data, error } = await supabase
          .from("whiteboard_files")
          .select("id, file_name, storage_path")
          .eq("session_id", sessionId)
          .in("id", selectedFileIds);

        if (error) {
          throw error;
        }

        const storedFiles = (data ?? []) as StoredSessionFile[];
        const parts: string[] = [];

        for (const file of storedFiles) {
          const download = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(file.storage_path);

          if (download.error) {
            throw download.error;
          }

          const extractedText = await extractTextFromFile(
            new File([await download.data.arrayBuffer()], file.file_name),
          );

          if (extractedText.trim()) {
            parts.push(`# ${file.file_name}\n${extractedText}`);
          }
        }

        const selectedDocText = parts.join("\n\n");
        if (selectedDocText) {
          combinedDocumentText = combinedDocumentText
            ? `${combinedDocumentText}\n\n${selectedDocText}`
            : selectedDocText;
        }
      } catch (error) {
        console.error("Stored file retrieval error:", error);
      }
    }

    if (!combinedDocumentText) {
      return NextResponse.json(
        {
          error:
            "No readable content found in uploaded documents. Please upload a .txt, .pdf, or .pptx file containing text.",
        },
        { status: 400 },
      );
    }

    const system =
      'Answer ONLY using the provided document. If not found, reply exactly: "I could not find that in the document." Do not guess.';

    const prompt = `DOCUMENT:\n${combinedDocumentText}\n\nQUESTION:\n${message}`;

    const client = getClient();

    // Persist to Supabase if configured
    let supabaseError: Error | null = null;
    try {
      const supabase = getSupabaseServerClient();

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

      const { error: msgError } = await supabase
        .from("whiteboard_messages")
        .insert([
          {
            session_id: sessionId,
            role: "user",
            content: message,
          },
        ]);

      if (msgError) {
        throw msgError;
      }

      // Store uploaded files in Storage and record in whiteboard_files
      if (processedUploads.length > 0 && sessionId) {
        for (const item of processedUploads) {
          const { file, generatedTags, summaryExcerpt, searchText } = item;
          const path = `${sessionId}/${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;
          const buffer = Buffer.from(await file.arrayBuffer());
          const { error: uploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, buffer, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });
          if (uploadErr) {
            throw uploadErr;
          }
          const { error: fileRowErr } = await supabase
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
            });

          if (fileRowErr && isMissingMetadataColumnsError(fileRowErr)) {
            const { error: fallbackErr } = await supabase
              .from("whiteboard_files")
              .insert({
                session_id: sessionId,
                file_name: file.name,
                storage_path: path,
                content_type: file.type || null,
                byte_size: file.size,
              });
            if (fallbackErr) {
              throw fallbackErr;
            }
            continue;
          }

          if (fileRowErr) {
            throw fileRowErr;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        supabaseError = err;
        console.error("Supabase persistence error:", err);
      }
    }

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system" as const, content: system },
        ...history.map((h) => ({
          role: h.role,
          content: h.content,
        })),
        { role: "user" as const, content: prompt },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    const answer = resp.choices?.[0]?.message?.content ?? "";

    // Persist assistant message if Supabase is available and sessionId exists
    if (sessionId) {
      try {
        const supabase = getSupabaseServerClient();
        const { error: msgError } = await supabase
          .from("whiteboard_messages")
          .insert([
            {
              session_id: sessionId,
              role: "assistant",
              content: answer,
            },
          ]);
        if (msgError) {
          throw msgError;
        }
      } catch (err) {
        console.error("Supabase assistant persistence error:", err);
      }
    }

    return NextResponse.json({
      answer: resp.choices?.[0]?.message?.content ?? "",
      documentText: combinedDocumentText,
      sessionId,
      generatedFileTags: processedUploads.map((item) => ({
        fileName: item.file.name,
        tags: item.generatedTags,
      })),
      supabaseWarning: supabaseError ? supabaseError.message : undefined,
    });
  } catch (e: any) {
    console.error("Error handling /api/chat POST request:", e);
    if (e instanceof Error && e.message.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        { error: "Server is missing OPENAI_API_KEY" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        error:
          e instanceof Error && e.message
            ? e.message
            : "Internal server error",
      },
      { status: 500 },
    );
  }
}
