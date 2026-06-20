import { createHash } from "crypto";
import type { RepoKnowledge } from "../knowledge";
import { buildDependencyGraph } from "../dependency-graph";
import { buildWorkflowDiagram, buildWorkflowMermaid } from "../workflow-diagram";
import { detectStack } from "../repo-scanner";

export type CondensedAnalysis = {
  repository: string;
  indexedAt: string;
  fileCount: number;
  chunkCount: number;
  summary: string;
  frameworks: string[];
  services: { label: string; type: string }[];
  apiRouteCount: number;
  apiRouteSamples: string[];
  dependencyClusters: { title: string; items: string[] }[];
  staticArchitectureMermaid: string;
  staticWorkflowMermaid: string;
  integrations: string[];
  runtime: string[];
};

function detectIntegrations(repo: RepoKnowledge): string[] {
  const text = `${repo.summary} ${(repo.allPaths ?? []).join(" ")} ${Object.keys(repo.manifests ?? {}).join(" ")}`.toLowerCase();
  const hits: string[] = [];
  if (/openai|@ai-sdk\/openai/i.test(text)) hits.push("OpenAI");
  if (/anthropic|claude|@ai-sdk\/anthropic/i.test(text)) hits.push("Anthropic Claude");
  if (/github/i.test(text)) hits.push("GitHub");
  if (/supabase/i.test(text)) hits.push("Supabase");
  if (/stripe/i.test(text)) hits.push("Stripe");
  if (/vercel/i.test(text)) hits.push("Vercel");
  if (/render/i.test(text)) hits.push("Render");
  if (/grafana|opentelemetry/i.test(text)) hits.push("Telemetry (OTel/Grafana)");
  return hits;
}

function detectRuntime(repo: RepoKnowledge): string[] {
  const stack = detectStack(repo.allPaths ?? repo.folderTree ?? [], repo.manifests ?? {});
  const runtime: string[] = [];
  if (stack.frameworks.some((f) => /next/i.test(f))) runtime.push("Next.js frontend");
  if (stack.runtime === "node") runtime.push("Node.js backend");
  if (stack.runtime === "python") runtime.push("Python services");
  if (stack.hasDocker) runtime.push("Docker");
  if (stack.hasCi) runtime.push("CI/CD");
  if (repo.embeddingsReady) runtime.push("Vector retrieval");
  return runtime;
}

export function buildCondensedAnalysis(repo: RepoKnowledge): CondensedAnalysis {
  const arch = repo.architecture;
  const workflow = buildWorkflowDiagram(repo);
  const depGraph = buildDependencyGraph(repo);

  const dependencyClusters = depGraph.clusters.map((c) => ({
    title: c.title,
    items: depGraph.nodes
      .filter((n) => n.cluster === c.id && !n.parentId)
      .map((n) => n.label),
  }));

  const stack = detectStack(repo.allPaths ?? repo.folderTree ?? [], repo.manifests ?? {});

  return {
    repository: repo.fullName,
    indexedAt: repo.indexedAt,
    fileCount: repo.fileCount,
    chunkCount: repo.chunkCount,
    summary: repo.summary.slice(0, 600),
    frameworks: stack.frameworks.slice(0, 8),
    services: (arch?.services ?? [])
      .slice(0, 12)
      .map((s) => ({ label: s.label, type: s.type })),
    apiRouteCount: arch?.apiRoutes?.length ?? 0,
    apiRouteSamples: (arch?.apiRoutes ?? [])
      .slice(0, 3)
      .map((r) => `${r.method} ${r.path}`),
    dependencyClusters,
    staticArchitectureMermaid: (repo.architectureMermaid ?? "").slice(0, 2000),
    staticWorkflowMermaid: buildWorkflowMermaid(repo, workflow).slice(0, 2000),
    integrations: detectIntegrations(repo),
    runtime: detectRuntime(repo),
  };
}

export function buildCondensedContextJson(repo: RepoKnowledge): string {
  return JSON.stringify(buildCondensedAnalysis(repo), null, 2);
}

export function computeArchitectureHash(repo: RepoKnowledge): string {
  const condensed = buildCondensedAnalysis(repo);
  const payload = JSON.stringify({
    indexedAt: repo.indexedAt,
    fileCount: repo.fileCount,
    services: condensed.services,
    apiRouteCount: condensed.apiRouteCount,
    frameworks: condensed.frameworks,
    staticArch: condensed.staticArchitectureMermaid.slice(0, 500),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
