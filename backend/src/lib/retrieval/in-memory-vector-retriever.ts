import { embedQuery, cosineSimilarity } from "../ai/embeddings";
import { openAIProvider } from "../ai/openai-provider";
import type { CodeChunk } from "../knowledge";
import type { ScoredChunk, VectorRetriever } from "./types";

/**
 * Scans embedded chunks in repo JSON and ranks by cosine similarity.
 * Swap this adapter for pgvector/Pinecone without changing hybrid-retriever.
 */
export const inMemoryVectorRetriever: VectorRetriever = {
  isAvailable(chunks, _repoId?) {
    return (
      openAIProvider.isConfigured() &&
      chunks.some((c) => c.embedding?.length)
    );
  },

  async search(chunks, query, limit, repoId?) {
    if (!query.trim() || !this.isAvailable(chunks, repoId)) return null;

    try {
      const qEmb = await embedQuery(query);
      return chunks
        .filter((c) => c.embedding?.length)
        .map((chunk) => {
          const score = cosineSimilarity(qEmb, chunk.embedding!);
          return { chunk, score, vectorScore: score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (err) {
      console.warn("[retrieval] vector search failed:", err);
      return null;
    }
  },
};
