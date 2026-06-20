import type { CodeChunk } from "../knowledge";
import { createVectorRetriever } from "./pgvector-retriever";
import { keywordRetriever } from "./keyword-retriever";
import { fuseRankedLists, RRF_CANDIDATE_MULTIPLIER } from "./rrf";
import type {
  HybridRetrievalResult,
  KeywordRetriever,
  RetrievalMode,
  VectorRetriever,
} from "./types";

export type HybridRetrieverDeps = {
  vector: VectorRetriever;
  keyword: KeywordRetriever;
};

function defaultDeps(repoId?: string): HybridRetrieverDeps {
  return {
    vector: createVectorRetriever(repoId),
    keyword: keywordRetriever,
  };
}

function candidateLimit(limit: number): number {
  return Math.min(Math.max(limit * RRF_CANDIDATE_MULTIPLIER, limit + 4), 48);
}

/**
 * True hybrid retrieval: vector + keyword in parallel, fused with RRF.
 * Falls back to keyword-only when embeddings are unavailable or vector search fails.
 */
export async function retrieveHybrid(
  chunks: CodeChunk[],
  query: string,
  limit = 8,
  repoId?: string,
  deps: HybridRetrieverDeps = defaultDeps(repoId)
): Promise<HybridRetrievalResult> {
  const q = query.trim();
  if (!q || !chunks.length) {
    return {
      results: [],
      mode: "keyword",
      limit,
      vectorCandidates: 0,
      keywordCandidates: 0,
    };
  }

  const pool = candidateLimit(limit);
  const vectorAvailable = deps.vector.isAvailable(chunks, repoId);

  const [keywordHits, vectorHits] = await Promise.all([
    Promise.resolve(deps.keyword.search(chunks, q, pool)),
    vectorAvailable
      ? deps.vector.search(chunks, q, pool, repoId)
      : Promise.resolve(null),
  ]);

  if (vectorHits === null) {
    return {
      results: keywordHits.slice(0, limit),
      mode: "keyword",
      limit,
      vectorCandidates: 0,
      keywordCandidates: keywordHits.length,
    };
  }

  const mode: RetrievalMode = "hybrid";
  const results = fuseRankedLists(vectorHits, keywordHits, limit);

  return {
    results,
    mode,
    limit,
    vectorCandidates: vectorHits.length,
    keywordCandidates: keywordHits.length,
  };
}

export async function retrieveChunks(
  chunks: CodeChunk[],
  query: string,
  limit = 6,
  repoId?: string
): Promise<CodeChunk[]> {
  const { results } = await retrieveHybrid(chunks, query, limit, repoId);
  return results.map((r) => r.chunk);
}

export async function retrieveChunksScored(
  chunks: CodeChunk[],
  query: string,
  limit = 8,
  repoId?: string
): Promise<{ chunk: CodeChunk; score: number }[]> {
  const { results } = await retrieveHybrid(chunks, query, limit, repoId);
  return results.map(({ chunk, score }) => ({ chunk, score }));
}

export type { HybridRetrievalResult, RetrievalMode };
