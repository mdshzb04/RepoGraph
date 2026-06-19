import type { CodeChunk } from "./knowledge";
import { embedQuery, cosineSimilarity } from "./ai/embeddings";
import { openAIProvider } from "./ai/openai-provider";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

export function chunkFiles(
  files: { path: string; content: string }[]
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  for (const file of files) {
    const lines = file.content.split("\n");
    let buffer = "";
    let startLine = 1;
    let lineNo = 1;

    const flush = (endLine: number) => {
      const text = buffer.trim();
      if (text.length < 40) return;
      chunks.push({
        id: `${file.path}:${startLine}-${endLine}`,
        path: file.path,
        content: text.slice(0, CHUNK_SIZE),
        startLine,
        endLine,
      });
    };

    for (const line of lines) {
      buffer += `${line}\n`;
      if (buffer.length >= CHUNK_SIZE) {
        flush(lineNo);
        const tail = buffer.slice(-CHUNK_OVERLAP);
        buffer = tail;
        startLine = Math.max(1, lineNo - 5);
      }
      lineNo++;
    }
    if (buffer.trim()) flush(lineNo);
  }
  return chunks;
}

/** Keyword retrieval — fallback when embeddings are unavailable. */
export function retrieveChunksKeyword(
  chunks: CodeChunk[],
  query: string,
  limit = 6
): CodeChunk[] {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  if (!terms.length) return chunks.slice(0, limit);

  const scored = chunks.map((chunk) => {
    const hay = `${chunk.path}\n${chunk.content}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (hay.includes(term)) score += 1;
      if (chunk.path.toLowerCase().includes(term)) score += 2;
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.chunk);
}

/** Vector search when embeddings exist; otherwise keyword fallback. */
export async function retrieveChunks(
  chunks: CodeChunk[],
  query: string,
  limit = 6
): Promise<CodeChunk[]> {
  const hasVectors = chunks.some((c) => c.embedding?.length);
  if (hasVectors && openAIProvider.isConfigured() && query.trim()) {
    try {
      const qEmb = await embedQuery(query);
      return chunks
        .filter((c) => c.embedding?.length)
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(qEmb, chunk.embedding!),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.chunk);
    } catch {
      /* keyword fallback */
    }
  }
  return retrieveChunksKeyword(chunks, query, limit);
}

export async function retrieveChunksScored(
  chunks: CodeChunk[],
  query: string,
  limit = 8
): Promise<{ chunk: CodeChunk; score: number }[]> {
  const hasVectors = chunks.some((c) => c.embedding?.length);
  if (hasVectors && openAIProvider.isConfigured() && query.trim()) {
    try {
      const qEmb = await embedQuery(query);
      return chunks
        .filter((c) => c.embedding?.length)
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(qEmb, chunk.embedding!),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch {
      /* keyword fallback */
    }
  }

  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  if (!terms.length) {
    return chunks.slice(0, limit).map((chunk) => ({ chunk, score: 0 }));
  }

  return chunks
    .map((chunk) => {
      const hay = `${chunk.path}\n${chunk.content}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (hay.includes(term)) score += 1;
        if (chunk.path.toLowerCase().includes(term)) score += 2;
      }
      return { chunk, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildContextBlock(chunks: CodeChunk[]): string {
  if (!chunks.length) return "No matching code chunks.";
  return chunks
    .map(
      (c) =>
        `### ${c.path} (L${c.startLine}-${c.endLine})\n\`\`\`\n${c.content}\n\`\`\``
    )
    .join("\n\n");
}
