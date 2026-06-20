import type { CodeChunk } from "./knowledge";

export { retrieveChunks, retrieveChunksScored, retrieveHybrid } from "./retrieval";
export type { HybridRetrievalResult, RetrievalMode } from "./retrieval";
export { retrieveChunksKeyword } from "./retrieval/keyword-retriever";

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

export function buildContextBlock(chunks: CodeChunk[]): string {
  if (!chunks.length) return "No matching code chunks.";
  return chunks
    .map(
      (c) =>
        `### ${c.path} (L${c.startLine}-${c.endLine})\n\`\`\`\n${c.content}\n\`\`\``
    )
    .join("\n\n");
}
