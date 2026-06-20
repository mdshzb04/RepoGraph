import type { ArchitectureAnalysis } from "./architecture-analyzer";
import type { RepoKnowledge } from "./knowledge";
import { detectStack } from "./repo-scanner";

export type DepNode = {
  id: string;
  label: string;
  cluster: string;
  icon: string;
  meta?: string;
  /** Nested under a group node in the same cluster. */
  parentId?: string;
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
  presentation: "Frontend",
  api: "Backend",
  ai: "AI",
  data: "Data",
  platform: "Infrastructure",
};

const CLUSTER_GROUPS: Record<string, string[]> = {
  presentation: ["UI", "Auth", "Dashboard"],
  api: ["API", "Services", "Workers"],
  ai: ["OpenAI", "Claude", "Embeddings"],
  data: ["PostgreSQL", "Vector Store", "File Storage"],
  platform: ["CI/CD", "Telemetry", "Hosting"],
};

function repoText(repo: RepoKnowledge): string {
  const paths = (repo.allPaths ?? repo.folderTree ?? []).join(" ");
  return `${repo.summary} ${repo.architectureMermaid} ${paths}`.toLowerCase();
}

function iconFor(cluster: string, label: string): string {
  const l = label.toLowerCase();
  if (cluster === "presentation") return /auth/i.test(l) ? "user" : "monitor";
  if (cluster === "ai") return /embed|vector/i.test(l) ? "database" : "sparkles";
  if (cluster === "data") return "database";
  if (cluster === "platform") return /ci/i.test(l) ? "git-branch" : "activity";
  if (/worker|queue/i.test(l)) return "workflow";
  return "server";
}

function pickGroupItems(cluster: string, text: string, arch: ArchitectureAnalysis | null): string[] {
  const defaults = CLUSTER_GROUPS[cluster] ?? ["Core"];
  const picked: string[] = [];

  if (cluster === "presentation") {
    if (/next|react|frontend|ui/i.test(text)) picked.push("UI");
    if (/auth|oauth|session|jwt|github/i.test(text)) picked.push("Auth");
    if (/dashboard|copilot|panel/i.test(text)) picked.push("Dashboard");
  }
  if (cluster === "api") {
    if (arch?.apiRoutes?.length || /express|api|route/i.test(text)) picked.push("API");
    if (arch?.services.some((s) => s.type === "backend" || s.type === "api")) picked.push("Services");
    if (/worker|queue|inngest|job/i.test(text)) picked.push("Workers");
  }
  if (cluster === "ai") {
    if (/openai|@ai-sdk\/openai|embed/i.test(text)) picked.push("OpenAI");
    if (/anthropic|claude/i.test(text)) picked.push("Claude");
    if (/embed|vector|semantic|rag/i.test(text)) picked.push("Embeddings");
  }
  if (cluster === "data") {
    if (/postgres|supabase|prisma|mysql/i.test(text)) picked.push("PostgreSQL");
    if (/pinecone|vector|pgvector/i.test(text)) picked.push("Vector Store");
    if (/storage|s3|blob|repo json/i.test(text)) picked.push("File Storage");
  }
  if (cluster === "platform") {
    if (/github\/workflows|ci\/cd|actions/i.test(text)) picked.push("CI/CD");
    if (/opentelemetry|grafana|telemetry/i.test(text)) picked.push("Telemetry");
    if (/vercel|render|railway|docker/i.test(text)) picked.push("Hosting");
  }

  const unique = [...new Set(picked.length ? picked : defaults.slice(0, 2))];
  return unique.slice(0, 4);
}

export function buildDependencyGraph(repo: RepoKnowledge): DependencyGraph {
  const arch = repo.architecture ?? null;
  const text = repoText(repo);
  const stack = detectStack(repo.allPaths ?? repo.folderTree ?? [], repo.manifests ?? {});
  const nodes: DepNode[] = [];
  const edges: DepEdge[] = [];
  const seen = new Set<string>();
  const activeClusters = new Set<string>();

  const add = (node: DepNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
    activeClusters.add(node.cluster);
  };

  for (const svc of arch?.services ?? []) {
    const cluster =
      svc.type === "frontend"
        ? "presentation"
        : svc.type === "database"
          ? "data"
          : svc.type === "worker"
            ? "ai"
            : svc.type === "infra"
              ? "platform"
              : "api";
    activeClusters.add(cluster);
  }

  if (/openai|anthropic|embed|llm|rag/i.test(text)) activeClusters.add("ai");
  if (/postgres|supabase|prisma|storage|data/i.test(text)) activeClusters.add("data");
  if (stack.hasCi || /telemetry|grafana/i.test(text)) activeClusters.add("platform");
  if (arch?.services.some((s) => s.type === "frontend") || /next|frontend/i.test(text)) {
    activeClusters.add("presentation");
  }
  if (arch?.apiRoutes?.length || /express|backend|api/i.test(text)) activeClusters.add("api");

  if (!activeClusters.size) activeClusters.add("api");

  for (const clusterId of activeClusters) {
    const groupId = `group-${clusterId}`;
    add({
      id: groupId,
      label: CLUSTER_TITLES[clusterId] ?? clusterId,
      cluster: clusterId,
      icon: iconFor(clusterId, CLUSTER_TITLES[clusterId] ?? ""),
      meta: "cluster",
    });

    for (const item of pickGroupItems(clusterId, text, arch)) {
      const childId = `${clusterId}-${item.toLowerCase().replace(/\W+/g, "-")}`;
      add({
        id: childId,
        label: item,
        cluster: clusterId,
        parentId: groupId,
        icon: iconFor(clusterId, item),
      });
    }
  }

  const clusterOrder = ["presentation", "api", "ai", "data", "platform"];
  const ordered = clusterOrder.filter((c) => activeClusters.has(c));
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = `group-${ordered[i]}`;
    const to = `group-${ordered[i + 1]}`;
    if (seen.has(from) && seen.has(to)) {
      edges.push({ from, to, kind: "depends", animated: true });
    }
  }

  if (activeClusters.has("presentation") && activeClusters.has("api")) {
    edges.push({
      from: `group-presentation`,
      to: `group-api`,
      kind: "HTTP",
      animated: true,
    });
  }
  if (activeClusters.has("api") && activeClusters.has("ai")) {
    edges.push({ from: `group-api`, to: `group-ai`, kind: "inference", animated: true });
  }
  if (activeClusters.has("api") && activeClusters.has("data")) {
    edges.push({ from: `group-api`, to: `group-data`, kind: "persist", animated: true });
  }

  const clusters = clusterOrder
    .filter((id) => activeClusters.has(id))
    .map((id) => ({ id, title: CLUSTER_TITLES[id] ?? id }));

  return {
    clusters,
    nodes,
    edges: [...new Map(edges.map((e) => [`${e.from}-${e.to}`, e])).values()],
  };
}
