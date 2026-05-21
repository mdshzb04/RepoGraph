import type { ArchitectureAnalysis } from "./architecture-analyzer";
import type { ArchitectureTopology } from "./architecture-topology";
import type { RepoKnowledge } from "./knowledge";

export type WorkflowStep = {
  id: string;
  label: string;
  detail?: string;
  layer: "entry" | "app" | "service" | "data" | "external";
};

export type WorkflowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type WorkflowDiagram = {
  title: string;
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  source: "routes" | "services" | "mixed";
};

function repoText(repo: RepoKnowledge): string {
  return `${repo.summary} ${(repo.allPaths ?? []).join(" ")} ${Object.keys(repo.manifests ?? {}).join(" ")}`.toLowerCase();
}

function addStep(
  steps: WorkflowStep[],
  seen: Set<string>,
  step: WorkflowStep
): void {
  if (seen.has(step.id)) return;
  seen.add(step.id);
  steps.push(step);
}

export function buildWorkflowDiagram(repo: RepoKnowledge): WorkflowDiagram {
  const arch = repo.architecture ?? null;
  const text = repoText(repo);
  const steps: WorkflowStep[] = [];
  const edges: WorkflowEdge[] = [];
  const seen = new Set<string>();

  const fe = arch?.services.find((s) => s.type === "frontend");
  const api = arch?.services.find((s) => s.type === "backend" || s.type === "api");
  const db = arch?.services.find((s) => s.type === "database");
  const workers = arch?.services.find((s) => s.type === "worker");

  addStep(steps, seen, { id: "user", label: "Client", layer: "entry" });

  if (fe) {
    addStep(steps, seen, {
      id: fe.id,
      label: fe.label,
      detail: fe.paths[0],
      layer: "app",
    });
    edges.push({ from: "user", to: fe.id, label: "HTTP" });
  }

  if (api) {
    addStep(steps, seen, {
      id: api.id,
      label: api.label,
      detail: api.paths[0],
      layer: "service",
    });
    const entry = fe?.id ?? "user";
    edges.push({ from: entry, to: api.id, label: "API" });
  }

  const routes = (arch?.apiRoutes ?? []).slice(0, 8);
  for (const r of routes) {
    const id = `route-${r.method}-${r.path.replace(/\W+/g, "-").slice(0, 24)}`;
    addStep(steps, seen, {
      id,
      label: `${r.method} ${r.path}`,
      detail: r.file,
      layer: "service",
    });
    if (api) edges.push({ from: api.id, to: id, label: "handler" });
    else if (fe) edges.push({ from: fe.id, to: id });
    else edges.push({ from: "user", to: id });
  }

  if (db) {
    addStep(steps, seen, {
      id: db.id,
      label: db.label,
      detail: db.paths[0],
      layer: "data",
    });
    const routeFrom = routes[0]
      ? `route-${routes[0].method}-${routes[0].path.replace(/\W+/g, "-").slice(0, 24)}`
      : undefined;
    const from = api?.id ?? routeFrom ?? fe?.id;
    if (from && seen.has(from)) edges.push({ from, to: db.id, label: "query" });
  }

  if (/pinecone|vector|embed|rag|semantic/i.test(text)) {
    addStep(steps, seen, {
      id: "vector",
      label: /pinecone/i.test(text) ? "Pinecone" : "Vector index",
      detail: "retrieval",
      layer: "data",
    });
    const from = api?.id ?? fe?.id;
    if (from) edges.push({ from, to: "vector", label: "search" });
  }

  if (/openai|@ai-sdk|gpt-/i.test(text)) {
    addStep(steps, seen, {
      id: "llm",
      label: "OpenAI",
      detail: "completion / embeddings",
      layer: "external",
    });
    const from = api?.id ?? fe?.id;
    if (from) edges.push({ from, to: "llm", label: "inference" });
  }

  if (workers) {
    addStep(steps, seen, {
      id: workers.id,
      label: workers.label,
      detail: workers.paths[0],
      layer: "service",
    });
    if (api) edges.push({ from: api.id, to: workers.id, label: "enqueue" });
  }

  if (/opentelemetry|grafana|telemetry/i.test(text)) {
    addStep(steps, seen, {
      id: "telemetry",
      label: "Telemetry",
      detail: "OTel / metrics",
      layer: "external",
    });
    if (api) edges.push({ from: api.id, to: "telemetry", label: "export" });
  }

  for (const d of arch?.dependencies ?? []) {
    if (seen.has(d.from) && seen.has(d.to)) {
      edges.push({ from: d.from, to: d.to, label: d.kind });
    }
  }

  const source: WorkflowDiagram["source"] =
    routes.length > 0 ? "routes" : arch?.services.length ? "services" : "mixed";

  return {
    title: `${repo.fullName} — request lifecycle`,
    steps,
    edges: [...new Map(edges.map((e) => [`${e.from}-${e.to}`, e])).values()].filter(
      (e) => seen.has(e.from) && seen.has(e.to)
    ),
    source,
  };
}

export function buildWorkflowMermaid(repo: RepoKnowledge, wf: WorkflowDiagram): string {
  const lines = ["flowchart LR"];
  for (const s of wf.steps) {
    const safe = s.label.replace(/"/g, "'");
    lines.push(`  ${s.id}["${safe}"]`);
  }
  for (const e of wf.edges) {
    lines.push(`  ${e.from} -->${e.label ? `|${e.label}|` : ""} ${e.to}`);
  }
  return lines.join("\n");
}
