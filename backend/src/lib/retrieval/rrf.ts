import type { CodeChunk } from "../knowledge";
import type { ScoredChunk } from "./types";

export const RRF_K = 60;
export const RRF_CANDIDATE_MULTIPLIER = 4;

/**
 * Reciprocal Rank Fusion — merges ranked lists without normalizing raw scores.
 * score(d) = Σ 1 / (k + rank_i(d))
 */
export function fuseRankedLists(
  vectorHits: ScoredChunk[],
  keywordHits: ScoredChunk[],
  limit: number,
  k = RRF_K
): ScoredChunk[] {
  const fused = new Map<string, ScoredChunk>();

  const absorb = (hits: ScoredChunk[], kind: "vector" | "keyword") => {
    hits.forEach((hit, index) => {
      const rank = index + 1;
      const contribution = 1 / (k + rank);
      const id = hit.chunk.id;
      const prev = fused.get(id);

      if (prev) {
        prev.score += contribution;
        prev.rrfScore = prev.score;
        if (kind === "vector") {
          prev.vectorScore = hit.vectorScore ?? hit.score;
          prev.vectorRank = rank;
        } else {
          prev.keywordScore = hit.keywordScore ?? hit.score;
          prev.keywordRank = rank;
        }
      } else {
        fused.set(id, {
          chunk: hit.chunk,
          score: contribution,
          rrfScore: contribution,
          vectorScore: kind === "vector" ? (hit.vectorScore ?? hit.score) : undefined,
          keywordScore: kind === "keyword" ? (hit.keywordScore ?? hit.score) : undefined,
          vectorRank: kind === "vector" ? rank : undefined,
          keywordRank: kind === "keyword" ? rank : undefined,
        });
      }
    });
  };

  absorb(vectorHits, "vector");
  absorb(keywordHits, "keyword");

  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
