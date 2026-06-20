import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function connectDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required. Set your Neon PostgreSQL connection string.");
  }
  await prisma.$connect();
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await prisma.$executeRawUnsafe(`
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
  `);
}
