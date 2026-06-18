import type { ArchitectureAnalysis } from "./architecture-analyzer";
import type { RepoKnowledge } from "./knowledge";
import { detectStack } from "./repo-scanner";

export type DepNode = {
  id: string;
  label: string;
  cluster: string;
  icon: string;
  meta?: string;
};

export type DepEdge = {
  from: string;
  to: string;
  kind?: string;
  animated?: boolean;
};

export type DependencyGraph = {
  clusters: { id: string; title: string }[];
  nodes: DepNode[];
  edges: DepEdge[];
};

const CLUSTER_TITLES: Record<string, string> = {
  presentation: "Presentation",
  api: "API & services",
  ai: "AI & workers",
  data: "Data & storage",
  platform: "Platform",
};

function repoText(repo: RepoKnowledge): string {
  const paths = (repo.allPaths ?? repo.folderTree ?? []).join(" ");
  return `${repo.summary} ${repo.architectureMermaid} ${paths}`.toLowerCase();
}

function clusterFor(label: string, type?: string): string {
  const l = label.toLowerCase();
  if (/user|client|frontend|next\.js|ui/i.test(l) || type === "frontend") return "presentation";
  if (/openai|pinecone|embed|llm|rag|anthropic|worker|inngest|queue/i.test(l) || type === "worker")
    return "ai";
  if (/database|postgres|repo|storage|supabase|prisma|data layer/i.test(l) || type === "database")
    return "data";
  if (/otel|grafana|ci\/cd|docker|container runtime/i.test(l) || type === "infra") return "platform";
  return "api";
}

function iconFor(cluster: string, label: string): string {
  const l = label.toLowerCase();
  if (cluster === "presentation") return /user/i.test(l) ? "user" : "monitor";
  if (cluster === "ai") return /worker|queue|inngest/i.test(l) ? "workflow" : "sparkles";
  if (cluster === "data") return "database";
  if (cluster === "platform") return /ci/i.test(l) ? "git-branch" : "activity";
  if (/route|endpoint|get |post /i.test(l)) return "route";
  return "server";
}

function parseMermaid(mermaid: string): {
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string }[];
} {
  const nodes: { id: string; label: string }[] = [];
  const edges: { from: string; to: string }[] = [];
  const nodeRe = /(\w+)\s*\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = nodeRe.exec(mermaid))) {
    nodes.push({ id: m[1], label: m[2].replace(/"/g, "").trim() });
  }
  const edgeRe = /(\w+)\s*-->\|?[^|]*\|?\s*(\w+)/g;
  while ((m = edgeRe.exec(mermaid))) {
    edges.push({ from: m[1], to: m[2] });
  }
  const simple = /(\w+)\s*-->\s*(\w+)/g;
  while ((m = simple.exec(mermaid))) {
    const from = m[1];
    const to = m[2];
    if (!edges.some((e) => e.from === from && e.to === to)) edges.push({ from, to });
  }
  return { nodes, edges };
}

function labelToId(label: string, arch: ArchitectureAnalysis | null): string | null {
  const l = label.toLowerCase();
  const svc = arch?.services.find(
    (s) =>
      s.label.toLowerCase() === l ||
      l.includes(s.label.toLowerCase()) ||
      s.label.toLowerCase().includes(l)
  );
  if (svc) return svc.id;
  if (/user/i.test(label)) return "user";
  if (/frontend/i.test(label)) return "frontend";
  if (/api/i.test(label)) return "api";
  if (/database|data/i.test(label)) return "database";
  if (/ai|openai|pinecone/i.test(label)) return "ai-openai";
  return `m-${label.toLowerCase().replace(/\W+/g, "-").slice(0, 16)}`;
}

export function buildDependencyGraph(repo: RepoKnowledge): DependencyGraph {
  const arch = repo.architecture ?? null;
  const text = repoText(repo);
  const stack = detectStack(repo.allPaths ?? repo.folderTree ?? [], repo.manifests ?? {});
  const nodes: DepNode[] = [];
  const edges: DepEdge[] = [];
  const seen = new Set<string>();

  const add = (id: string, label: string, meta?: string, type?: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const cluster = clusterFor(label, type);
    nodes.push({ id, label, cluster, icon: iconFor(cluster, label), meta });
  };

  for (const svc of arch?.services ?? []) {
    add(svc.id, svc.label, svc.paths[0], svc.type);
  }

  if (/openai|@ai-sdk/i.test(text) && !seen.has("ai-openai")) {
    add("ai-openai", "OpenAI", "detected in repo");
  }
  if (/pinecone/i.test(text) && !seen.has("ai-pinecone")) {
    add("ai-pinecone", "Pinecone", "vector store");
  }

  const m = parseMermaid(repo.architectureMermaid ?? "");
  const mermaidIdMap = new Map<string, string>();
  for (const n of m.nodes) {
    const id = labelToId(n.label, arch) ?? `m-${n.id}`;
    mermaidIdMap.set(n.id, id);
    if (!seen.has(id)) add(id, n.label);
  }
  for (const e of m.edges) {
    const from = mermaidIdMap.get(e.from) ?? e.from;
    const to = mermaidIdMap.get(e.to) ?? e.to;
    if (seen.has(from) && seen.has(to)) {
      edges.push({ from, to, kind: "flow", animated: true });
    }
  }

  for (const r of (arch?.apiRoutes ?? []).slice(0, 6)) {
    const id = `route-${r.path.replace(/\W+/g, "-").slice(0, 18)}`;
    add(id, `${r.method} ${r.path}`, r.file);
    if (seen.has("api")) edges.push({ from: "api", to: id, kind: "http", animated: true });
  }

  for (const d of arch?.dependencies ?? []) {
    if (seen.has(d.from) && seen.has(d.to)) {
      edges.push({ from: d.from, to: d.to, kind: d.kind, animated: true });
    }
  }

  if (stack.hasCi) add("ci", "CI/CD", ".github/workflows");
  if (/opentelemetry|@opentelemetry/i.test(text)) add("otel", "OpenTelemetry");

  const used = new Set(nodes.map((n) => n.cluster));
  const clusters = Object.keys(CLUSTER_TITLES)
    .filter((id) => used.has(id))
    .map((id) => ({ id, title: CLUSTER_TITLES[id] }));

  const uniq = [...new Map(edges.map((e) => [`${e.from}-${e.to}`, e])).values()].filter(
    (e) => seen.has(e.from) && seen.has(e.to)
  );

  return { clusters, nodes, edges: uniq };
}
