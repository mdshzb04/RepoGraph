import type { CodeChunk } from "../knowledge";
import type { KeywordRetriever, ScoredChunk } from "./types";

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

function scoreChunk(chunk: CodeChunk, terms: string[]): number {
  if (!terms.length) return 0;
  const hay = `${chunk.path}\n${chunk.content}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (hay.includes(term)) score += 1;
    if (chunk.path.toLowerCase().includes(term)) score += 2;
  }
  return score;
}

export const keywordRetriever: KeywordRetriever = {
  search(chunks, query, limit): ScoredChunk[] {
    const terms = tokenize(query.trim());
    if (!terms.length) {
      return chunks.slice(0, limit).map((chunk) => ({ chunk, score: 0, keywordScore: 0 }));
    }

    const scored = chunks
      .map((chunk) => {
        const raw = scoreChunk(chunk, terms);
        return { chunk, score: raw, keywordScore: raw };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  },
};

/** @deprecated Use keywordRetriever.search via hybrid-retriever. */
export function retrieveChunksKeyword(
  chunks: CodeChunk[],
  query: string,
  limit = 6
): CodeChunk[] {
  return keywordRetriever.search(chunks, query, limit).map((s) => s.chunk);
}
