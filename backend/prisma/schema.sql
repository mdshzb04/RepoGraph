-- RepoGraph — Neon PostgreSQL bootstrap
-- Run once on a fresh Neon database (or via `npx prisma db push`).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Prisma manages tables via migrations/db push.
-- Vector similarity helper for hybrid search (optional direct SQL use):

CREATE OR REPLACE FUNCTION match_file_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  target_repo_id uuid
)
RETURNS TABLE (
  chunk_key text,
  path text,
  content text,
  start_line int,
  end_line int,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fc.chunk_key,
    fc.path,
    fc.content,
    fc.start_line,
    fc.end_line,
    1 - (fc.embedding <=> query_embedding) AS similarity
  FROM file_chunks fc
  WHERE fc.repository_id = target_repo_id
    AND fc.embedding IS NOT NULL
    AND 1 - (fc.embedding <=> query_embedding) > match_threshold
  ORDER BY fc.embedding <=> query_embedding
  LIMIT match_count;
$$;
