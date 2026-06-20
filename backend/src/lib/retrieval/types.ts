import type { CodeChunk } from "../knowledge";

export type RetrievalMode = "hybrid" | "vector" | "keyword";

export type ScoredChunk = {
  chunk: CodeChunk;
  /** Fused relevance score exposed to API consumers. */
  score: number;
  rrfScore?: number;
  vectorScore?: number;
  keywordScore?: number;
  vectorRank?: number;
  keywordRank?: number;
};

export type HybridRetrievalResult = {
  results: ScoredChunk[];
  mode: RetrievalMode;
  limit: number;
  vectorCandidates: number;
  keywordCandidates: number;
};

/** Pluggable vector backend (Neon pgvector or in-memory fallback). */
export type VectorRetriever = {
  isAvailable: (chunks: CodeChunk[], repoId?: string) => boolean;
  search: (
    chunks: CodeChunk[],
    query: string,
    limit: number,
    repoId?: string
  ) => Promise<ScoredChunk[] | null>;
};

export type KeywordRetriever = {
  search: (chunks: CodeChunk[], query: string, limit: number) => ScoredChunk[];
};
