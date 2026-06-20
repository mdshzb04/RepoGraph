import type { ArchitectureAnalysis } from "./architecture-analyzer";
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
  source: "lifecycle";
};

function repoText(repo: RepoKnowledge): string {
  return `${repo.summary} ${(repo.allPaths ?? []).join(" ")} ${Object.keys(repo.manifests ?? {}).join(" ")}`.toLowerCase();
}

function hasAuth(text: string): boolean {
  return /auth|oauth|session|jwt|github.*sign|next-auth/i.test(text);
}

function hasRetrieval(text: string, repo: RepoKnowledge): boolean {
  return (
    Boolean(repo.embeddingsReady) ||
    /vector|embed|semantic|rag|retrieve|search/i.test(text)
  );
}

function hasLlm(text: string): boolean {
  return /anthropic|claude|openai|@ai-sdk|llm|gpt/i.test(text);
}

function hasTelemetry(text: string): boolean {
  return /opentelemetry|grafana|telemetry|otel/i.test(text);
}

function hasDatabase(text: string, arch: ArchitectureAnalysis | null): boolean {
  return (
    Boolean(arch?.services.some((s) => s.type === "database")) ||
    /postgres|supabase|prisma|mysql|sqlite|mongodb/i.test(text)
  );
}

export function buildWorkflowDiagram(repo: RepoKnowledge): WorkflowDiagram {
  const arch = repo.architecture ?? null;
  const text = repoText(repo);
  const steps: WorkflowStep[] = [];
  const edges: WorkflowEdge[] = [];
  const chain: string[] = [];

  const push = (id: string, label: string, layer: WorkflowStep["layer"], detail?: string) => {
    if (chain.includes(id)) return;
    steps.push({ id, label, layer, detail });
    chain.push(id);
  };

  push("user", "User", "entry");
  push("frontend", "Frontend", "app", arch?.services.find((s) => s.type === "frontend")?.label);

  if (hasAuth(text)) {
    push("auth", "Authentication", "service");
  }

  push("backend", "Backend API", "service", arch?.services.find((s) => s.type === "backend" || s.type === "api")?.label);

  if (hasRetrieval(text, repo)) {
    push("retrieval", "Retrieval / Search", "service", "vector + keyword");
  }

  if (hasLlm(text)) {
    push("llm", "LLM", "external", /anthropic|claude/i.test(text) ? "Claude reasoning" : "AI inference");
  }

  if (hasDatabase(text, arch)) {
    push("database", "Database / Storage", "data");
  }

  push("response", "Response", "app");

  if (hasTelemetry(text)) {
    push("telemetry", "Telemetry", "external", "OTel / metrics");
  }

  for (let i = 0; i < chain.length - 1; i++) {
    edges.push({ from: chain[i]!, to: chain[i + 1]! });
  }

  if (chain.includes("backend") && chain.includes("telemetry")) {
    edges.push({ from: "backend", to: "telemetry", label: "observability" });
  }

  return {
    title: `${repo.fullName} — request lifecycle`,
    steps,
    edges: [...new Map(edges.map((e) => [`${e.from}-${e.to}`, e])).values()],
    source: "lifecycle",
  };
}

export function buildWorkflowMermaid(_repo: RepoKnowledge, wf: WorkflowDiagram): string {
  const lines = ["flowchart TD"];
  for (const s of wf.steps) {
    const safe = s.label.replace(/"/g, "'");
    lines.push(`  ${s.id}["${safe}"]`);
  }
  for (const e of wf.edges) {
    const label = e.label ? `|${e.label}|` : "";
    lines.push(`  ${e.from} -->${label} ${e.to}`);
  }
  return lines.join("\n");
}
