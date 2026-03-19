# File Tagging (Backend)

## What is implemented

When a user uploads a file through `POST /api/chat`, the backend now:

1. Extracts file text (`.txt`, `.pdf`, `.pptx`).
2. Generates tags from:
   - File name tokens (higher weight).
   - Document text tokens (frequency-based).
   - File type tag (`pdf`, `presentation`, `text`).
3. Stores tags in `whiteboard_files.tags` and a short preview in `whiteboard_files.summary_excerpt`.

The API also returns generated tags in the response:

```json
{
  "generatedFileTags": [
    { "fileName": "Biology_Chapter_12.pdf", "tags": ["biology", "chapter", "mitochondria", "pdf"] }
  ]
}
```

## Migration required

Run `supabase-schema-files.sql` to add:

- `whiteboard_files.tags text[]`
- `whiteboard_files.summary_excerpt text`
- GIN index for tags lookup

## Backward compatibility

If your DB has not been migrated yet, uploads still work:

- The backend attempts to insert `tags` and `summary_excerpt`.
- If those columns do not exist, it falls back to legacy insert fields.

## Query by tags

```sql
SELECT id, file_name, tags, summary_excerpt, created_at
FROM public.whiteboard_files
WHERE tags && ARRAY['biology', 'mitochondria']
ORDER BY created_at DESC;
```
