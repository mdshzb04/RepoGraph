import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type CodeChunk = {
  id: string;
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  /** OpenAI embedding vector (text-embedding-3-small, 1536 dims). */
  embedding?: number[];
};

export type FileStat = {
  path: string;
  chunkCount: number;
  language: string;
  embedded: boolean;
  processedAt: string;
};

import type { ArchitectureAnalysis } from "./architecture-analyzer";
import type { ExcalidrawScene } from "./excalidraw-scene";
import type { HealthScore } from "./health-score";
import type { ObservabilitySnapshot } from "./observability";
import type { RepoAiInsights } from "./ai/types";
import type { ManifestMap } from "./repo-scanner";
import type { RepoAccessContext } from "./repo-access";
import { canAccessRepo } from "./repo-access";

export type VectorDbHealth = "healthy" | "degraded" | "offline";

export type RepoKnowledge = {
  id: string;
  fullName: string;
  defaultBranch: string;
  indexedAt: string;
  status: "indexing" | "ready" | "error";
  error?: string;
  fileCount: number;
  chunkCount: number;
  summary: string;
  architectureMermaid: string;
  chunks: CodeChunk[];
  files?: FileStat[];
  languages?: Record<string, number>;
  embeddingsReady?: boolean;
  vectorDbHealth?: VectorDbHealth;
  activityLog?: string[];
  folderTree?: string[];
  allPaths?: string[];
  manifests?: ManifestMap;
  architecture?: ArchitectureAnalysis;
  excalidrawScene?: ExcalidrawScene;
  /** @deprecated use excalidrawScene */
  excalidrawScenes?: { system?: ExcalidrawScene };
  healthScore?: HealthScore;
  observability?: ObservabilitySnapshot;
  /** Claude-generated architecture, workflow, and dependency analysis. */
  aiInsights?: RepoAiInsights;
  indexingDurationMs?: number;
  /** Set when indexed via authenticated BFF — used for per-user isolation. */
  indexedBySub?: string;
  indexedByEmail?: string;
};

const DATA_DIR = path.join(process.cwd(), "data", "repos");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function repoPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function saveRepo(knowledge: RepoKnowledge): Promise<void> {
  await ensureDir();
  await fs.writeFile(repoPath(knowledge.id), JSON.stringify(knowledge, null, 2));
}

export async function getRepo(id: string): Promise<RepoKnowledge | null> {
  try {
    const raw = await fs.readFile(repoPath(id), "utf8");
    return JSON.parse(raw) as RepoKnowledge;
  } catch {
    return null;
  }
}

export async function listRepos(): Promise<RepoKnowledge[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const repos: RepoKnowledge[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    repos.push(JSON.parse(raw) as RepoKnowledge);
  }
  return repos.sort(
    (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
  );
}

export async function listReposForUser(
  ctx: RepoAccessContext
): Promise<RepoKnowledge[]> {
  const all = await listRepos();
  return all
    .filter((r) => canAccessRepo(r, ctx))
    .sort(
      (a, b) =>
        new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    );
}

export function createRepoId(): string {
  return randomUUID();
}
