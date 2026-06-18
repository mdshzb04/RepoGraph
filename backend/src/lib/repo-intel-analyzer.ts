import type { RepoKnowledge } from "./knowledge";
import { analyzeDeployment, type ReadinessCheck } from "./deployment-analyzer";
import { detectStack, extractEnvVars, hasFile, type ManifestMap } from "./repo-scanner";

export type Confidence = "detected" | "inferred";
export type RepoIntelLanguage = { name: string; count: number; pct: number };
export type RepoIntelCategory = {
  label: string;
  statusLabel: string;
  detail: string;
  status: string;
};
export type IntelCheck = { label: string; status: "ok" | "warn" | "fail"; detail?: string };
export type HotModule = { path: string; chunks: number; language: string };
export type InferenceProvider = {
  name: string;
  confidence: Confidence;
  evidence: string;
};
export type InfraItem = {
  id: string;
  label: string;
  confidence: Confidence;
  evidence: string;
};
export type RagFactor = {
  label: string;
  level: "ready" | "limited" | "absent";
  statusLabel: string;
  note?: string;
};

export type RepoIntel = {
  summary: string;
  indexedAt?: string;
  indexingDurationMs?: number;
  fileCount: number;
  chunkCount: number;
  embeddingsReady: boolean;
  languages: RepoIntelLanguage[];
  health?: {
    overall: number;
    posture: string;
    indexConfidence: "low" | "medium" | "high";
    summary: string;
    categories: RepoIntelCategory[];
  };
  deployment: {
    structure: string;
    checks: ReadinessCheck[];
    blockers: string[];
    isMonorepo: boolean;
  };
  security: { findings: IntelCheck[]; envVarCount: number };
  activity: { topDirs: { dir: string; files: number }[]; manifestFiles: number };
  hotModules: HotModule[];
  aiCost: {
    model: string;
    indexRangeUsd: [number, number];
    monthlyRangeUsd: [number, number];
    disclaimer: string;
  };
  providers: InferenceProvider[];
  rag: {
    indicativeScore: number;
    band: string;
    summary: string;
    factors: RagFactor[];
  };
  infrastructure: InfraItem[];
  analysis: {
    method: string;
    pathsScanned: number;
    chunksSampled: number;
    manifestCount: number;
  };
};

function paths(repo: RepoKnowledge): string[] {
  return [
    ...new Set([
      ...(repo.allPaths ?? []),
      ...(repo.files?.map((f) => f.path) ?? []),
      ...repo.chunks.map((c) => c.path),
    ]),
  ];
}

function codeBlob(repo: RepoKnowledge): string {
  return repo.chunks.map((c) => `${c.path}\n${c.content}`).join("\n").slice(0, 20000);
}

function categoryLabel(score: number, maxScore: number): string {
  const ratio = score / Math.max(maxScore, 1);
  if (score === 0) return "Not in index sample";
  if (ratio >= 0.85) return "Configured";
  if (ratio >= 0.6) return "Mostly in place";
  if (ratio >= 0.35) return "Partial coverage";
  return "Gap to close";
}

function healthPosture(overall: number): string {
  if (overall >= 78) return "Established operational baseline";
  if (overall >= 62) return "Runnable with known gaps";
  if (overall >= 48) return "Foundational — packaging or CI incomplete";
  return "Immature — limited signals in indexed tree";
}

function healthSummary(overall: number): string {
  if (overall >= 78)
    return "Manifest and structure signals look workable; confirm with your own deploy checklist.";
  if (overall >= 62)
    return "Core pieces exist but automation, tests, or containers may need attention.";
  if (overall >= 48)
    return "Treat as advisory — several categories were weak or absent in the index.";
  return "Sparse index or missing manifests; re-sync or widen file coverage before trusting this view.";
}

function indexConfidence(paths: number, chunks: number): "low" | "medium" | "high" {
  if (paths < 25 || chunks < 30) return "low";
  if (paths < 100 || chunks < 80) return "medium";
  return "high";
}

function dampenScore(raw: number, cap = 88): number {
  return Math.min(cap, Math.max(0, Math.round(raw * 0.94)));
}

function analyzeSecurity(p: string[], text: string): RepoIntel["security"] {
  const findings: IntelCheck[] = [];
  const committedEnv = p.some(
    (x) => /(^|\/)\.env$/.test(x) && !/\.example|\.sample/.test(x)
  );
  findings.push({
    label: committedEnv ? ".env file in tree" : "No committed .env",
    status: committedEnv ? "fail" : "ok",
    detail: committedEnv ? "Rotate secrets if this repo is public" : "Based on indexed paths only",
  });
  findings.push({
    label: /sk-[a-zA-Z0-9]{20,}/.test(text) ? "Possible API key in source" : "No inline API keys in sample",
    status: /sk-[a-zA-Z0-9]{20,}/.test(text) ? "fail" : "ok",
    detail: "Scanned chunk sample, not full git history",
  });
  findings.push({
    label: hasFile(p, ".env.example") || hasFile(p, ".env.sample") ? ".env.example present" : "No .env.example in index",
    status: hasFile(p, ".env.example") || hasFile(p, ".env.sample") ? "ok" : "warn",
  });
  findings.push({
    label: /helmet|cors|rate.?limit|auth|clerk|next-auth/i.test(text)
      ? "Auth / hardening references"
      : "Limited auth middleware in sample",
    status: /helmet|cors|rate.?limit|auth/i.test(text) ? "ok" : "warn",
  });
  return { findings, envVarCount: extractEnvVars(text).length };
}

function analyzeActivity(repo: RepoKnowledge): RepoIntel["activity"] {
  const counts = new Map<string, number>();
  for (const f of repo.files ?? []) {
    const dir = f.path.includes("/") ? f.path.split("/")[0]! : "(root)";
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  return {
    topDirs: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dir, files]) => ({ dir, files })),
    manifestFiles: Object.keys(repo.manifests ?? {}).length,
  };
}

function hotModules(repo: RepoKnowledge): HotModule[] {
  const files = repo.files ?? [];
  if (!files.length) return [];
  return [...files]
    .filter((f) => f.chunkCount > 0)
    .sort((a, b) => b.chunkCount - a.chunkCount)
    .slice(0, 6)
    .map((f) => ({ path: f.path, chunks: f.chunkCount, language: f.language }));
}

const PROVIDER_PATTERNS: [string, RegExp][] = [
  ["OpenAI", /openai|@ai-sdk\/openai/gi],
  ["Anthropic", /anthropic|@ai-sdk\/anthropic/gi],
  ["Google Gemini", /gemini|@ai-sdk\/google/gi],
  ["Cohere", /cohere/gi],
  ["Ollama", /ollama/gi],
];

function detectProviders(mans: ManifestMap, text: string): InferenceProvider[] {
  const out: InferenceProvider[] = [];
  for (const [name, re] of PROVIDER_PATTERNS) {
    const manifestHit = Object.entries(mans).find(([, v]) => re.test(v ?? ""));
    if (manifestHit) {
      out.push({
        name,
        confidence: "detected",
        evidence: `Declared in ${manifestHit[0].split("/").pop()}`,
      });
      re.lastIndex = 0;
      continue;
    }
    if (re.test(text.slice(0, 12000))) {
      out.push({
        name,
        confidence: "inferred",
        evidence: "Referenced in indexed source sample",
      });
    }
    re.lastIndex = 0;
  }
  return out;
}

function analyzeInfrastructure(p: string[], text: string, mans: ManifestMap): InfraItem[] {
  const items: InfraItem[] = [];
  const depBlob = Object.values(mans).join("\n").toLowerCase();

  if (hasFile(p, "Dockerfile")) {
    items.push({ id: "docker", label: "Docker", confidence: "detected", evidence: "Dockerfile" });
  } else if (hasFile(p, "docker-compose.yml") || hasFile(p, "docker-compose.yaml")) {
    items.push({
      id: "docker",
      label: "Docker Compose",
      confidence: "detected",
      evidence: "compose manifest",
    });
  }

  if (hasFile(p, "vercel.json")) {
    items.push({ id: "vercel", label: "Vercel", confidence: "detected", evidence: "vercel.json" });
  }

  if (p.some((x) => x.endsWith(".tf"))) {
    items.push({ id: "terraform", label: "Terraform", confidence: "detected", evidence: ".tf files" });
  }

  if (
    p.some((x) => /(^|\/)k8s\//.test(x)) ||
    hasFile(p, "Chart.yaml") ||
    Object.entries(mans).some(
      ([k, v]) => /deployment\.ya?ml$/i.test(k) && /kind:\s*Deployment/i.test(v)
    )
  ) {
    items.push({
      id: "kubernetes",
      label: "Kubernetes",
      confidence: "detected",
      evidence: "K8s manifests or charts",
    });
  } else if (/kubernetes|k8s|helm/i.test(depBlob)) {
    items.push({
      id: "kubernetes",
      label: "Kubernetes",
      confidence: "inferred",
      evidence: "Mentioned in config/deps",
    });
  }

  if (
    p.some((x) => /prisma\/schema/i.test(x)) ||
    hasFile(p, "supabase") ||
    /image:\s*postgres/i.test(depBlob)
  ) {
    items.push({
      id: "postgres",
      label: "Postgres",
      confidence: "detected",
      evidence: "Schema, Supabase, or compose service",
    });
  } else if (/postgres|pgvector|prisma|supabase/i.test(text.slice(0, 8000) + depBlob)) {
    items.push({
      id: "postgres",
      label: "Postgres",
      confidence: "inferred",
      evidence: "Driver/ORM references in sample",
    });
  }

  if (/redis|ioredis/i.test(depBlob) || /image:\s*redis/i.test(depBlob)) {
    items.push({
      id: "redis",
      label: "Redis",
      confidence: /image:\s*redis|"redis"/i.test(depBlob) ? "detected" : "inferred",
      evidence: /image:\s*redis/i.test(depBlob) ? "Compose/service config" : "Client library in deps",
    });
  }

  return items;
}

const RAG_STATUS: Record<RagFactor["level"], string> = {
  ready: "In place",
  limited: "Limited coverage",
  absent: "Not observed",
};

function scoreRag(repo: RepoKnowledge, text: string): RepoIntel["rag"] {
  const factor = (
    label: string,
    ready: boolean,
    limited: boolean,
    note?: string
  ): RagFactor => {
    const level: RagFactor["level"] = ready ? "ready" : limited ? "limited" : "absent";
    return { label, level, statusLabel: RAG_STATUS[level], note };
  };

  const factors: RagFactor[] = [
    factor(
      "Embeddings indexed",
      Boolean(repo.embeddingsReady),
      repo.chunkCount > 0 && !repo.embeddingsReady,
      repo.embeddingsReady ? "Vector index marked online" : undefined
    ),
    factor(
      "Chunk coverage",
      repo.chunkCount >= 40,
      repo.chunkCount >= 10,
      `${repo.chunkCount} chunks from ${repo.fileCount} files`
    ),
    factor(
      "Architecture summary",
      repo.summary.length > 120,
      repo.summary.length > 40
    ),
    factor(
      "Vector store signals",
      /pgvector/i.test(text),
      /vector|embedding/i.test(text) && !/pgvector/i.test(text)
    ),
    factor(
      "Retrieval implementation",
      /retrieveChunks|retrieve.*chunk|semantic.?search/i.test(text),
      /embedding|similarity/i.test(text)
    ),
  ];

  const raw = factors.reduce(
    (s, f) => s + (f.level === "ready" ? 18 : f.level === "limited" ? 9 : 0),
    0
  );
  const indicativeScore = dampenScore(raw, 82);
  const band =
    indicativeScore >= 68
      ? "Pipeline likely usable — validate with real retrieval queries"
      : indicativeScore >= 42
        ? "Foundation present — tune chunking and embedding coverage"
        : "Thin index — expand scope before relying on semantic search";

  return { indicativeScore, band, summary: band, factors };
}

function estimateAiCost(repo: RepoKnowledge, model: string): RepoIntel["aiCost"] {
  const inputPerM = model.includes("gpt-4o") && !model.includes("mini") ? 2.5 : 0.15;
  const outputPerM = model.includes("gpt-4o") && !model.includes("mini") ? 10 : 0.6;
  const embedPerM = 0.02;

  const indexInputTok = Math.ceil((repo.summary.length + repo.chunkCount * 120) / 4);
  const indexOutputTok = Math.ceil(repo.summary.length / 4);
  const indexMid =
    (indexInputTok * inputPerM + indexOutputTok * outputPerM) / 1_000_000 +
    (repo.chunkCount * 400 * embedPerM) / 1_000_000;

  const tokPerQuery = Math.min(6000, 400 + repo.chunkCount * 35);
  const monthlyMid =
    indexMid * 1.5 +
    (20 * tokPerQuery * inputPerM) / 1_000_000 +
    (20 * 350 * outputPerM) / 1_000_000;

  const fudge = (n: number) => [
    Math.max(0.001, Math.round(n * 0.6 * 1000) / 1000),
    Math.round(n * 1.4 * 1000) / 1000,
  ] as [number, number];

  return {
    model,
    indexRangeUsd: fudge(indexMid),
    monthlyRangeUsd: fudge(monthlyMid),
    disclaimer:
      "Order-of-magnitude from index size and public list pricing — not billing data.",
  };
}

export function buildRepoIntel(repo: RepoKnowledge): RepoIntel {
  const p = paths(repo);
  const mans = repo.manifests ?? {};
  const text = codeBlob(repo);
  const stack = detectStack(p, mans);
  const deployment = analyzeDeployment(repo, `https://github.com/${repo.fullName}`);

  const langEntries = Object.entries(repo.languages ?? {})
    .filter(([name]) => name !== "JSON")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const langTotal = langEntries.reduce((s, [, n]) => s + n, 0) || 1;

  return {
    summary: repo.summary.replace(/```[\s\S]*?```/g, "").trim().slice(0, 480),
    indexedAt: repo.indexedAt,
    indexingDurationMs: repo.indexingDurationMs,
    fileCount: repo.fileCount,
    chunkCount: repo.chunkCount,
    embeddingsReady: Boolean(repo.embeddingsReady && repo.status === "ready"),
    languages: langEntries.map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / langTotal) * 100),
    })),
    health: repo.healthScore
      ? {
          overall: dampenScore(repo.healthScore.overall),
          posture: healthPosture(repo.healthScore.overall),
          indexConfidence: indexConfidence(p.length, repo.chunks.length),
          summary: healthSummary(repo.healthScore.overall),
          categories: repo.healthScore.categories.map((c) => ({
            label: c.label,
            statusLabel: categoryLabel(c.score, c.maxScore),
            detail: c.detail,
            status: c.status,
          })),
        }
      : undefined,
    deployment: {
      structure: deployment.structure,
      checks: deployment.checks,
      blockers: deployment.blockers,
      isMonorepo: stack.isMonorepo,
    },
    security: analyzeSecurity(p, text),
    activity: analyzeActivity(repo),
    hotModules: hotModules(repo),
    aiCost: estimateAiCost(repo, process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    providers: detectProviders(mans, text),
    rag: scoreRag(repo, text),
    infrastructure: analyzeInfrastructure(p, text, mans),
    analysis: {
      method:
        "Heuristic pass over indexed paths, manifests, and a bounded code sample (not runtime telemetry)",
      pathsScanned: p.length,
      chunksSampled: repo.chunks.length,
      manifestCount: Object.keys(mans).length,
    },
  };
}
