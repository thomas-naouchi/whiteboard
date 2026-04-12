-- Run this in Supabase SQL Editor to add file storage support.
-- 1. Create the whiteboard_files table (tracks uploaded files per session)
CREATE TABLE IF NOT EXISTS public.whiteboard_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  content_type text,
  byte_size bigint,
  tags text[] NOT NULL DEFAULT '{}',
  summary_excerpt text,
  search_text text,
  created_at timestamptz DEFAULT now()
);

-- 1b. If table already exists, add tagging columns safely:
ALTER TABLE public.whiteboard_files
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.whiteboard_files
  ADD COLUMN IF NOT EXISTS summary_excerpt text;

ALTER TABLE public.whiteboard_files
  ADD COLUMN IF NOT EXISTS search_text text;

-- 1c. Optional index to speed up tag-based lookup:
CREATE INDEX IF NOT EXISTS whiteboard_files_tags_gin
  ON public.whiteboard_files USING gin (tags);

-- 1d. Create chunk table for semantic retrieval and future content-based sorting:
CREATE TABLE IF NOT EXISTS public.whiteboard_file_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.whiteboard_files(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  embedding jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whiteboard_file_chunks_session_idx
  ON public.whiteboard_file_chunks (session_id);

CREATE INDEX IF NOT EXISTS whiteboard_file_chunks_file_idx
  ON public.whiteboard_file_chunks (file_id);

-- 2. Create a Storage bucket named "whiteboard-files" in Supabase Dashboard:
--    Storage → New bucket → Name: whiteboard-files, Private (or Public if you want direct links).
--    No SQL needed for the bucket; create it in the Storage UI.

-- 3. Example lookup query:
-- SELECT id, file_name, tags, summary_excerpt, search_text, created_at
-- FROM public.whiteboard_files
-- WHERE tags && ARRAY['biology', 'mitochondria']
-- ORDER BY created_at DESC;
