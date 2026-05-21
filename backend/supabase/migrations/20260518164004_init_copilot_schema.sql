-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_username TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repositories
CREATE TABLE IF NOT EXISTS public.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  github_id BIGINT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  clone_url TEXT NOT NULL,
  indexing_status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repository Files
CREATE TABLE IF NOT EXISTS public.repository_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  sha TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (repository_id, path)
);

-- Vector Store for File Chunks
CREATE TABLE IF NOT EXISTS public.file_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.repository_files(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  embedding vector(1536) -- OpenAI small embedding length
);

-- Create an index for vector similarity search to speed up retrieval
CREATE INDEX ON public.file_chunks USING hnsw (embedding vector_cosine_ops);

-- Chat Sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PR Reviews
CREATE TABLE IF NOT EXISTS public.pr_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE,
  pr_number INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING',
  review_comments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (repository_id, pr_number)
);

-- Create a function for similarity search (RAG)
CREATE OR REPLACE FUNCTION match_file_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  repo_id uuid
)
RETURNS TABLE (
  id uuid,
  file_id uuid,
  content text,
  start_line int,
  end_line int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.file_id,
    fc.content,
    fc.start_line,
    fc.end_line,
    1 - (fc.embedding <=> query_embedding) AS similarity
  FROM file_chunks fc
  JOIN repository_files rf ON fc.file_id = rf.id
  WHERE rf.repository_id = repo_id
    AND 1 - (fc.embedding <=> query_embedding) > match_threshold
  ORDER BY fc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
