import type { ArchitectureAnalysis, ServiceNode } from "./architecture-analyzer";
import type { RepoKnowledge } from "./knowledge";
import { detectStack } from "./repo-scanner";

export type TopologyLayer = "client" | "api" | "ai" | "data" | "infra";

export type TopologyNode = {
  id: string;
  layer: TopologyLayer;
  label: string;
  sub?: string;
  icon: string;
  badges?: { label: string; tone: "ok" | "warn" | "neutral" }[];
};

export type TopologyEdge = {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
};

export type ArchitectureTopology = {
  layers: { id: TopologyLayer; title: string }[];
  nodes: TopologyNode[];
  edges: TopologyEdge[];
};

const LAYER_TITLES: Record<TopologyLayer, string> = {
  client: "Client",
  api: "API",
  ai: "AI / RAG",
  data: "Data",
  infra: "Infrastructure",
};

function repoText(repo: RepoKnowledge): string {
  const paths = (repo.allPaths ?? repo.folderTree ?? []).join(" ");
  const manifests = Object.keys(repo.manifests ?? {}).join(" ");
  return `${repo.summary} ${repo.architectureMermaid} ${paths} ${manifests}`.toLowerCase();
}

function layerForService(s: ServiceNode): TopologyLayer {
  if (s.type === "frontend") return "client";
  if (s.type === "database") return "data";
  if (s.type === "infra") return "infra";
  if (s.type === "worker") return "ai";
  return "api";
}

function iconForService(s: ServiceNode): string {
  if (s.type === "frontend") return "monitor";
  if (s.type === "database") return "database";
  if (s.type === "infra") return "cloud";
  if (s.type === "worker") return "workflow";
  return "server";
}

function detectAiNodes(text: string, arch: ArchitectureAnalysis | null): TopologyNode[] {
  const out: TopologyNode[] = [];
  if (/openai|gpt-|@ai-sdk/i.test(text)) {
    out.push({
      id: "ai-openai",
      layer: "ai",
      label: "OpenAI",
      sub: "LLM / embeddings",
      icon: "sparkles",
    });
  }
  if (/pinecone/i.test(text)) {
    out.push({
      id: "ai-pinecone",
      layer: "ai",
      label: "Pinecone",
      sub: "vector index",
      icon: "search",
    });
  }
  if (/anthropic|claude/i.test(text)) {
    out.push({
      id: "ai-claude",
      layer: "ai",
      label: "Anthropic",
      icon: "brain",
    });
  }
  if (/inngest|bull|celery|rq\b/i.test(text) && !arch?.services.some((s) => s.id === "workers")) {
    out.push({
      id: "ai-workers",
      layer: "ai",
      label: "Job queue",
      sub: "async workers",
      icon: "workflow",
    });
  }
  return out;
}

export function buildArchitectureTopology(repo: RepoKnowledge): ArchitectureTopology {
  const arch = repo.architecture ?? null;
  const text = repoText(repo);
  const stack = detectStack(repo.allPaths ?? repo.folderTree ?? [], repo.manifests ?? {});
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  const ids = new Set<string>();

  const add = (n: TopologyNode) => {
    if (ids.has(n.id)) return;
    ids.add(n.id);
    nodes.push(n);
  };

  for (const svc of arch?.services ?? []) {
    add({
      id: svc.id,
      layer: layerForService(svc),
      label: svc.label,
      sub: svc.paths[0],
      icon: iconForService(svc),
    });
  }

  for (const ai of detectAiNodes(text, arch)) add(ai);

  const hasFrontend = ids.has("frontend") || nodes.some((n) => n.layer === "client");
  if (hasFrontend) {
    add({ id: "user", layer: "client", label: "User", icon: "user" });
  }

  for (const r of (arch?.apiRoutes ?? []).slice(0, 6)) {
    const rid = `route-${r.path.replace(/\W+/g, "-").slice(0, 20)}`;
    add({
      id: rid,
      layer: "api",
      label: `${r.method} ${r.path}`,
      sub: r.file.split("/").pop(),
      icon: "route",
    });
    const apiId = ids.has("api") ? "api" : arch?.services.find((s) => s.type === "backend")?.id;
    if (apiId) edges.push({ from: apiId, to: rid, animated: true });
  }

  if (stack.hasCi || /\.github\/workflows/i.test(text)) {
    add({
      id: "ci",
      layer: "infra",
      label: "CI/CD",
      sub: "GitHub Actions",
      icon: "git-branch",
    });
  }
  if (/opentelemetry|@opentelemetry|grafana/i.test(text)) {
    add({
      id: "otel",
      layer: "infra",
      label: "Telemetry",
      sub: "OTel / metrics",
      icon: "activity",
    });
  }

  if (hasFrontend && ids.has("frontend")) {
    edges.push({ from: "user", to: "frontend", animated: true });
  }
  const apiId = ids.has("api")
    ? "api"
    : arch?.services.find((s) => s.type === "backend")?.id ?? null;
  const feId = ids.has("frontend") ? "frontend" : null;
  if (feId && apiId) edges.push({ from: feId, to: apiId, label: "HTTP", animated: true });

  for (const d of arch?.dependencies ?? []) {
    if (ids.has(d.from) && ids.has(d.to)) {
      edges.push({ from: d.from, to: d.to, label: d.kind, animated: d.kind === "api" });
    }
  }

  if (apiId) {
    for (const id of ["ai-openai", "ai-pinecone", "ai-claude", "ai-workers", "workers"]) {
      if (ids.has(id)) edges.push({ from: apiId, to: id, animated: true });
    }
    if (ids.has("database")) edges.push({ from: apiId, to: "database", label: "data" });
  }

  if (nodes.length === 0 && arch?.structure) {
    add({
      id: "app",
      layer: "api",
      label: arch.structure,
      icon: "server",
    });
  }

  const usedLayers = new Set(nodes.map((n) => n.layer));
  const layers = (["client", "api", "ai", "data", "infra"] as TopologyLayer[])
    .filter((id) => usedLayers.has(id))
    .map((id) => ({ id, title: LAYER_TITLES[id] }));

  const edgeKey = new Set<string>();
  const uniqEdges = edges.filter((e) => {
    const k = `${e.from}-${e.to}`;
    if (edgeKey.has(k) || !ids.has(e.from) || !ids.has(e.to)) return false;
    edgeKey.add(k);
    return true;
  });

  return { layers, nodes, edges: uniqEdges };
}
