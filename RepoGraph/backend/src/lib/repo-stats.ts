import type { CodeChunk, FileStat } from "./knowledge";

const LANG_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".md": "Markdown",
  ".json": "JSON",
};

/** Not programming languages — excluded from dominant-language stats. */
const EXCLUDED_FROM_LANGUAGE_BREAKDOWN = new Set(["JSON"]);

export function detectLanguage(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return LANG_MAP[ext] ?? "Other";
}

export function buildFileStats(chunks: CodeChunk[], indexedAt: string): FileStat[] {
  const map = new Map<string, { count: number }>();
  for (const c of chunks) {
    const cur = map.get(c.path) ?? { count: 0 };
    cur.count++;
    map.set(c.path, cur);
  }
  return [...map.entries()]
    .map(([path, { count }]) => ({
      path,
      chunkCount: count,
      language: detectLanguage(path),
      embedded: true,
      processedAt: indexedAt,
    }))
    .sort((a, b) => b.chunkCount - a.chunkCount);
}

export function languageBreakdown(files: FileStat[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of files) {
    if (EXCLUDED_FROM_LANGUAGE_BREAKDOWN.has(f.language)) continue;
    out[f.language] = (out[f.language] ?? 0) + 1;
  }
  return out;
}
