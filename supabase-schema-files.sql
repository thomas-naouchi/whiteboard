-- Run this in Supabase SQL Editor to add file storage support.
-- 1. Create the whiteboard_files table (tracks uploaded files per session)
CREATE TABLE IF NOT EXISTS public.whiteboard_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  content_type text,
  byte_size bigint,
  created_at timestamptz DEFAULT now()
);

-- 2. Create a Storage bucket named "whiteboard-files" in Supabase Dashboard:
--    Storage → New bucket → Name: whiteboard-files, Private (or Public if you want direct links).
--    No SQL needed for the bucket; create it in the Storage UI.
