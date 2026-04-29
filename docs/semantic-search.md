# Semantic Search Setup

This project supports semantic retrieval over uploaded file content using OpenAI embeddings.

## Required environment variables

Add these in `.env.local`:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Notes:
- `OPENAI_EMBEDDING_MODEL` is optional. The default is `text-embedding-3-small`.
- Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured correctly, since semantic chunks are stored in Supabase.

## Required database migration

Run [`supabase-schema-files.sql`](/Users/admin/Desktop/whiteboard/whiteboard/supabase-schema-files.sql) in Supabase SQL Editor.

This creates:
- `whiteboard_files` metadata columns (`tags`, `summary_excerpt`, `search_text`)
- `whiteboard_file_chunks` for chunk text + embedding storage

## Runtime behavior

- On upload, files are chunked and embeddings are generated, then saved to `whiteboard_file_chunks`.
- On search, semantic similarity is combined with lexical scoring.
- For legacy files that predate chunk storage, search now backfills chunks/embeddings from stored `search_text` automatically.

## Troubleshooting

- `Missing environment variable: OPENAI_API_KEY`
  - Set `OPENAI_API_KEY` and restart the dev server.
- Supabase hostname `ENOTFOUND`
  - Verify `SUPABASE_URL` matches an active project URL from Supabase dashboard.
- Missing chunks table/columns
  - Re-run `supabase-schema-files.sql`.
