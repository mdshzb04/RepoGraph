import type { Prisma } from "@prisma/client";
import type { RepoKnowledge } from "../knowledge";
import type { RepoAiInsights } from "../ai/types";
import type { ArchitectureAnalysis } from "../architecture-analyzer";
import type { ExcalidrawScene } from "../excalidraw-scene";
import type { HealthScore } from "../health-score";
import type { ObservabilitySnapshot } from "../observability";
import type { FileStat } from "../knowledge";
import type { ManifestMap } from "../repo-scanner";

type RepoRow = {
  id: string;
  fullName: string;
  defaultBranch: string;
  indexedAt: Date;
  status: string;
  error: string | null;
  fileCount: number;
  chunkCount: number;
  summary: string;
  architectureMermaid: string;
  embeddingsReady: boolean;
  vectorDbHealth: string | null;
  indexingDurationMs: number | null;
  indexedBySub: string | null;
  indexedByEmail: string | null;
  languages: Prisma.JsonValue;
  activityLog: Prisma.JsonValue;
  folderTree: Prisma.JsonValue;
  allPaths: Prisma.JsonValue;
  manifests: Prisma.JsonValue;
  architecture: Prisma.JsonValue;
  excalidrawScene: Prisma.JsonValue;
  healthScore: Prisma.JsonValue;
  observability: Prisma.JsonValue;
  aiInsights: Prisma.JsonValue;
  files: Prisma.JsonValue;
};

function jsonArray<T>(value: Prisma.JsonValue | null | undefined): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

function jsonObject<T>(value: Prisma.JsonValue | null | undefined): T | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : undefined;
}

export function rowToRepoKnowledge(row: RepoRow, chunks: RepoKnowledge["chunks"]): RepoKnowledge {
  return {
    id: row.id,
    fullName: row.fullName,
    defaultBranch: row.defaultBranch,
    indexedAt: row.indexedAt.toISOString(),
    status: row.status as RepoKnowledge["status"],
    error: row.error ?? undefined,
    fileCount: row.fileCount,
    chunkCount: row.chunkCount,
    summary: row.summary,
    architectureMermaid: row.architectureMermaid,
    chunks,
    files: jsonArray<FileStat>(row.files),
    languages: jsonObject<Record<string, number>>(row.languages),
    embeddingsReady: row.embeddingsReady,
    vectorDbHealth: (row.vectorDbHealth as RepoKnowledge["vectorDbHealth"]) ?? undefined,
    activityLog: jsonArray<string>(row.activityLog),
    folderTree: jsonArray<string>(row.folderTree),
    allPaths: jsonArray<string>(row.allPaths),
    manifests: jsonObject<ManifestMap>(row.manifests),
    architecture: jsonObject<ArchitectureAnalysis>(row.architecture),
    excalidrawScene: jsonObject<ExcalidrawScene>(row.excalidrawScene),
    healthScore: jsonObject<HealthScore>(row.healthScore),
    observability: jsonObject<ObservabilitySnapshot>(row.observability),
    aiInsights: jsonObject<RepoAiInsights>(row.aiInsights),
    indexingDurationMs: row.indexingDurationMs ?? undefined,
    indexedBySub: row.indexedBySub ?? undefined,
    indexedByEmail: row.indexedByEmail ?? undefined,
  };
}

export function repoKnowledgeToRowData(
  knowledge: RepoKnowledge
): Prisma.RepositoryUncheckedCreateInput {
  return {
    id: knowledge.id,
    fullName: knowledge.fullName,
    defaultBranch: knowledge.defaultBranch,
    indexedAt: new Date(knowledge.indexedAt),
    status: knowledge.status,
    error: knowledge.error ?? null,
    fileCount: knowledge.fileCount,
    chunkCount: knowledge.chunkCount,
    summary: knowledge.summary,
    architectureMermaid: knowledge.architectureMermaid,
    embeddingsReady: knowledge.embeddingsReady ?? false,
    vectorDbHealth: knowledge.vectorDbHealth ?? null,
    indexingDurationMs: knowledge.indexingDurationMs ?? null,
    indexedBySub: knowledge.indexedBySub ?? null,
    indexedByEmail: knowledge.indexedByEmail ?? null,
    languages: (knowledge.languages ?? undefined) as Prisma.InputJsonValue | undefined,
    activityLog: (knowledge.activityLog ?? undefined) as Prisma.InputJsonValue | undefined,
    folderTree: (knowledge.folderTree ?? undefined) as Prisma.InputJsonValue | undefined,
    allPaths: (knowledge.allPaths ?? undefined) as Prisma.InputJsonValue | undefined,
    manifests: (knowledge.manifests ?? undefined) as Prisma.InputJsonValue | undefined,
    architecture: (knowledge.architecture ?? undefined) as Prisma.InputJsonValue | undefined,
    excalidrawScene: (knowledge.excalidrawScene ?? undefined) as Prisma.InputJsonValue | undefined,
    healthScore: (knowledge.healthScore ?? undefined) as Prisma.InputJsonValue | undefined,
    observability: (knowledge.observability ?? undefined) as Prisma.InputJsonValue | undefined,
    aiInsights: (knowledge.aiInsights ?? undefined) as Prisma.InputJsonValue | undefined,
    files: (knowledge.files ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}
