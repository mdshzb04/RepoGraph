import { randomUUID } from "crypto";
import type { CodeChunk } from "../knowledge";
import { prisma } from "./client";

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function replaceRepoChunks(
  repoId: string,
  chunks: CodeChunk[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.fileChunk.deleteMany({ where: { repoId } });

    for (const chunk of chunks) {
      const id = randomUUID();
      if (chunk.embedding?.length) {
        await tx.$executeRawUnsafe(
          `INSERT INTO file_chunks (id, repository_id, chunk_key, path, content, start_line, end_line, embedding)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::vector)`,
          id,
          repoId,
          chunk.id,
          chunk.path,
          chunk.content,
          chunk.startLine,
          chunk.endLine,
          vectorLiteral(chunk.embedding)
        );
      } else {
        await tx.fileChunk.create({
          data: {
            id,
            repoId,
            chunkKey: chunk.id,
            path: chunk.path,
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
          },
        });
      }
    }
  });
}

export async function loadRepoChunks(repoId: string): Promise<CodeChunk[]> {
  const rows = await prisma.$queryRaw<
    {
      chunk_key: string;
      path: string;
      content: string;
      start_line: number;
      end_line: number;
      embedding_text: string | null;
    }[]
  >`
    SELECT chunk_key, path, content, start_line, end_line, embedding::text AS embedding_text
    FROM file_chunks
    WHERE repository_id = ${repoId}::uuid
    ORDER BY path, start_line
  `;

  return rows.map((row) => {
    const chunk: CodeChunk = {
      id: row.chunk_key,
      path: row.path,
      content: row.content,
      startLine: row.start_line,
      endLine: row.end_line,
    };
    if (row.embedding_text) {
      const parsed = parseVectorText(row.embedding_text);
      if (parsed.length) chunk.embedding = parsed;
    }
    return chunk;
  });
}

function parseVectorText(text: string): number[] {
  const inner = text.replace(/^\[/, "").replace(/\]$/, "");
  if (!inner.trim()) return [];
  return inner.split(",").map((v) => Number.parseFloat(v.trim()));
}

export async function vectorSearchChunks(
  repoId: string,
  queryEmbedding: number[],
  limit: number
): Promise<{ chunk: CodeChunk; score: number }[]> {
  const vec = vectorLiteral(queryEmbedding);
  const rows = await prisma.$queryRawUnsafe<
    {
      chunk_key: string;
      path: string;
      content: string;
      start_line: number;
      end_line: number;
      score: number;
    }[]
  >(
    `SELECT
      chunk_key,
      path,
      content,
      start_line,
      end_line,
      1 - (embedding <=> $1::vector) AS score
    FROM file_chunks
    WHERE repository_id = $2::uuid
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $3`,
    vec,
    repoId,
    limit
  );

  return rows.map((row) => ({
    chunk: {
      id: row.chunk_key,
      path: row.path,
      content: row.content,
      startLine: row.start_line,
      endLine: row.end_line,
    },
    score: row.score,
  }));
}
