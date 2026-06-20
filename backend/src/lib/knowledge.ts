import { randomUUID } from "crypto";
import type { ArchitectureAnalysis } from "./architecture-analyzer";
import type { ExcalidrawScene } from "./excalidraw-scene";
import type { HealthScore } from "./health-score";
import type { ObservabilitySnapshot } from "./observability";
import type { RepoAiInsights } from "./ai/types";
import type { ManifestMap } from "./repo-scanner";
import type { RepoAccessContext } from "./repo-access";
import { canAccessRepo } from "./repo-access";
import { prisma } from "./db/client";
import { loadRepoChunks, replaceRepoChunks } from "./db/chunk-store";
import { repoKnowledgeToRowData, rowToRepoKnowledge } from "./db/repo-mapper";

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
  excalidrawScenes?: { system?: ExcalidrawScene };
  healthScore?: HealthScore;
  observability?: ObservabilitySnapshot;
  aiInsights?: RepoAiInsights;
  indexingDurationMs?: number;
  indexedBySub?: string;
  indexedByEmail?: string;
};

export async function saveRepo(knowledge: RepoKnowledge): Promise<void> {
  const data = repoKnowledgeToRowData(knowledge);
  await prisma.repository.upsert({
    where: { id: knowledge.id },
    create: data,
    update: data,
  });
  await replaceRepoChunks(knowledge.id, knowledge.chunks);
}

export async function getRepo(id: string): Promise<RepoKnowledge | null> {
  const row = await prisma.repository.findUnique({ where: { id } });
  if (!row) return null;
  const chunks = await loadRepoChunks(id);
  return rowToRepoKnowledge(row, chunks);
}

export async function listRepos(): Promise<RepoKnowledge[]> {
  const rows = await prisma.repository.findMany({
    orderBy: { indexedAt: "desc" },
  });
  const repos: RepoKnowledge[] = [];
  for (const row of rows) {
    const chunks = await loadRepoChunks(row.id);
    repos.push(rowToRepoKnowledge(row, chunks));
  }
  return repos;
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
