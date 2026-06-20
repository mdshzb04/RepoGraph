import { embedQuery } from "../ai/embeddings";
import { openAIProvider } from "../ai/openai-provider";
import { vectorSearchChunks } from "../db/chunk-store";
import { isDatabaseConfigured } from "../db/client";
import type { CodeChunk } from "../knowledge";
import type { ScoredChunk, VectorRetriever } from "./types";
import { inMemoryVectorRetriever } from "./in-memory-vector-retriever";

export const pgVectorRetriever: VectorRetriever = {
  isAvailable(_chunks, repoId?: string) {
    return (
      isDatabaseConfigured() &&
      Boolean(repoId) &&
      openAIProvider.isConfigured()
    );
  },

  async search(chunks, query, limit, repoId?: string) {
    if (!query.trim() || !repoId || !this.isAvailable(chunks, repoId)) {
      return null;
    }
    try {
      const qEmb = await embedQuery(query);
      const hits = await vectorSearchChunks(repoId, qEmb, limit);
      if (!hits.length) return [];
      return hits.map(({ chunk, score }) => ({
        chunk,
        score,
        vectorScore: score,
      }));
    } catch (err) {
      console.warn("[retrieval] pgvector search failed:", err);
      return null;
    }
  },
};

export function createVectorRetriever(repoId?: string): VectorRetriever {
  const backend = process.env.VECTOR_RETRIEVER?.trim()?.toLowerCase() ?? "auto";

  if (
    (backend === "auto" || backend === "pgvector") &&
    isDatabaseConfigured() &&
    repoId
  ) {
    return {
      isAvailable: (chunks) => pgVectorRetriever.isAvailable(chunks, repoId),
      search: (chunks, query, limit) =>
        pgVectorRetriever.search(chunks, query, limit, repoId),
    };
  }

  if (backend === "memory") {
    return inMemoryVectorRetriever;
  }

  return inMemoryVectorRetriever;
}
