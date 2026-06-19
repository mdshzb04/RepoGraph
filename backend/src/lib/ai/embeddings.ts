import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { getAIConfig, requireOpenAIKey } from "./config";
import type { CodeChunk } from "../knowledge";

const EMBED_BATCH = 32;
const MAX_EMBED_CHARS = 8000;

function embeddingModel() {
  requireOpenAIKey();
  const { embeddingModel: modelId } = getAIConfig();
  return openai.embedding(modelId);
}

function embedInput(chunk: CodeChunk): string {
  return `${chunk.path}\n${chunk.content}`.slice(0, MAX_EMBED_CHARS);
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: text.slice(0, MAX_EMBED_CHARS),
  });
  return embedding;
}

export async function embedChunks(chunks: CodeChunk[]): Promise<CodeChunk[]> {
  if (!chunks.length) return chunks;
  requireOpenAIKey();

  const result: CodeChunk[] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      values: batch.map(embedInput),
    });
    for (let j = 0; j < batch.length; j++) {
      result.push({ ...batch[j]!, embedding: embeddings[j] });
    }
  }
  return result;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}
