export type VectorDbHealth = "healthy" | "degraded" | "offline";

export type HealthScoreSummary = {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
};

export type RepoMeta = {
  id: string;
  fullName: string;
  status: string;
  fileCount: number;
  chunkCount: number;
  indexedAt?: string;
  summary?: string;
  architectureMermaid?: string;
  embeddingsReady?: boolean;
  vectorDbHealth?: VectorDbHealth;
  languages?: Record<string, number>;
  folderTree?: string[];
  healthScore?: HealthScoreSummary;
};

export type KnowledgeData = {
  fileCount: number;
  chunkCount: number;
  embeddingsReady: boolean;
  vectorDbHealth: VectorDbHealth;
  languages: Record<string, number>;
  summary: string;
  activityLog: string[];
  indexingDurationMs?: number;
  indexedAt?: string;
  files: {
    path: string;
    chunkCount: number;
    language: string;
    embedded: boolean;
    processedAt: string;
  }[];
  folderTree: string[];
};

export type SearchHit = {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

export type ExcalidrawScene = {
  elements: Record<string, unknown>[];
  appState?: { viewBackgroundColor?: string; currentItemStrokeColor?: string };
};

export type ArchitectureTopology = {
  layers: { id: string; title: string }[];
  nodes: {
    id: string;
    layer: string;
    label: string;
    sub?: string;
    icon: string;
    badges?: { label: string; tone: "ok" | "warn" | "neutral" }[];
  }[];
  edges: { from: string; to: string; label?: string; animated?: boolean }[];
};

export type DependencyGraph = {
  clusters: { id: string; title: string }[];
  nodes: {
    id: string;
    label: string;
    cluster: string;
    icon: string;
    meta?: string;
  }[];
  edges: { from: string; to: string; kind?: string; animated?: boolean }[];
};

export type WorkflowStep = {
  id: string;
  label: string;
  detail?: string;
  layer: "entry" | "app" | "service" | "data" | "external";
};

export type WorkflowDiagram = {
  title: string;
  steps: WorkflowStep[];
  edges: { from: string; to: string; label?: string }[];
  source: "routes" | "services" | "mixed";
};

export type ArchitectureData = {
  fullName: string;
  summary: string;
  architectureMermaid: string;
  folderTree: string[];
  topology?: ArchitectureTopology;
  dependencyGraph?: DependencyGraph;
  workflow?: WorkflowDiagram;
  excalidrawScene?: ExcalidrawScene;
  analysis: {
    structure: string;
    separation: string;
    services: {
      id: string;
      label: string;
      type: string;
      paths: string[];
    }[];
    dependencies: { from: string; to: string; kind: string }[];
    apiRoutes: { method: string; path: string; file: string }[];
    folderHierarchy: { path: string; depth: number; kind: string }[];
    insights: string[];
    graphReady: boolean;
  } | null;
};

export type DeploymentAnalysis = {
  framework: string;
  techStack: string[];
  packageManager: string;
  structure: string;
  database?: string;
  hasDocker: boolean;
  hasCi: boolean;
  hasTypeScript: boolean;
  envVars: string[];
  blockers: string[];
  checks: { label: string; status: "ok" | "warn" | "fail" }[];
  recommendations: {
    role: string;
    provider: string;
    reason: string;
    url: string;
  }[];
};

export type HealthScoreData = {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: {
    id: string;
    label: string;
    score: number;
    maxScore: number;
    status: string;
    detail: string;
  }[];
  recommendations: string[];
};

export type TelemetryStatusPayload = {
  enabled: boolean;
  provider: "grafana_cloud" | "none";
  serviceName: string;
  environment: string;
  runtimeMode: string;
  dashboardUrl: string | null;
  dashboardEmbedUrl?: string | null;
  otlpConfigured: boolean;
};

export type RepoIntelCategory = {
  label: string;
  statusLabel: string;
  detail: string;
  status: string;
};

export type IntelCheck = {
  label: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
};

export type RepoIntel = {
  summary: string;
  indexedAt?: string;
  indexingDurationMs?: number;
  fileCount: number;
  chunkCount: number;
  embeddingsReady: boolean;
  languages: { name: string; count: number; pct: number }[];
  health?: {
    overall: number;
    posture: string;
    indexConfidence: "low" | "medium" | "high";
    summary: string;
    categories: RepoIntelCategory[];
  };
  deployment: {
    structure: string;
    checks: { label: string; status: "ok" | "warn" | "fail" }[];
    blockers: string[];
    isMonorepo: boolean;
  };
  security: { findings: IntelCheck[]; envVarCount: number };
  activity: { topDirs: { dir: string; files: number }[]; manifestFiles: number };
  hotModules: { path: string; chunks: number; language: string }[];
  aiCost: {
    model: string;
    indexRangeUsd: [number, number];
    monthlyRangeUsd: [number, number];
    disclaimer: string;
  };
  providers: {
    name: string;
    confidence: "detected" | "inferred";
    evidence: string;
  }[];
  rag: {
    indicativeScore: number;
    band: string;
    summary: string;
    factors: {
      label: string;
      level: "ready" | "limited" | "absent";
      statusLabel: string;
      note?: string;
    }[];
  };
  infrastructure: {
    id: string;
    label: string;
    confidence: "detected" | "inferred";
    evidence: string;
  }[];
  analysis: {
    method: string;
    pathsScanned: number;
    chunksSampled: number;
    manifestCount: number;
  };
};

export type ApiLatencySnapshot = {
  lastMs: number;
  avgMs: number;
  p95Ms: number;
  requestCount: number;
  lastRoute: string;
  lastMethod: string;
  statusCode: number;
  recordedAt: string;
  status: "healthy" | "degraded" | "slow";
  sampleConfidence?: "low" | "moderate" | "high";
  note?: string;
};

export type LiveTelemetryPayload = {
  source: "live";
  collectedAt: string;
  repoId?: string;
  api: {
    totalRequests: number;
    totalErrors: number;
    errorRatePct: number;
    requestsPerMin: number;
    requestsPerSec: number;
    latency?: ApiLatencySnapshot | null;
  };
  indexing: {
    totalJobs: number;
    totalFiles: number;
    totalChunks: number;
    lastDurationMs: number;
    repoJobsCompleted?: number;
    repoFiles?: number;
    repoChunks?: number;
    repoDurationMs?: number;
  };
  openai: {
    totalTokens: number;
    totalRequests: number;
    estimatedCostUsd: number;
    lastOperation?: string;
    model?: string;
    recordedAt?: string;
  };
  vector: { totalSearches: number };
  traces: { totalEvents: number };
};

export type TelemetryHistoryPoint = {
  at: string;
  apiRequests: number;
  indexJobs: number;
  indexFiles: number;
  indexChunks: number;
  openaiTokens: number;
  openaiRequests: number;
  vectorSearches: number;
  avgLatencyMs: number;
  indexDurationMs: number;
  p95LatencyMs: number;
};

export type ApiRouteBreakdown = { route: string; count: number };

export type IndexRunRecord = {
  runId: string;
  at: string;
  durationMs: number;
  files: number;
  chunks: number;
};

export type ObservabilityData = {
  collectedAt: string;
  live?: LiveTelemetryPayload;
  history?: TelemetryHistoryPoint[];
  indexRuns?: IndexRunRecord[];
  apiRoutes?: ApiRouteBreakdown[];
  lastSyncAt?: string;
  indexingPerformanceMs?: number;
  fileCount?: number;
  chunkCount?: number;
  telemetry?: TelemetryStatusPayload;
  apiLatency?: ApiLatencySnapshot;
  vectorSearch?: VectorSearchMetrics;
  openai?: OpenAIMetrics;
  processUptime?: ProcessUptime;
  backendHealth?: BackendHealth;
  executionFlow?: ExecutionFlowStep[];
  traces?: TraceEvent[];
};

export type VectorSearchMetrics = {
  lastMs: number;
  avgMs: number;
  searchCount: number;
  lastHitCount: number;
  status: "healthy" | "degraded" | "offline";
  recordedAt: string;
};

export type OpenAIMetrics = {
  totalTokens: number;
  requestCount: number;
  estimatedCostUsd: number;
  lastOperation?: string;
  model?: string;
  recordedAt: string;
};

export type ProcessUptime = {
  uptimeMs: number;
  startedAt: string;
};

export type BackendHealth = {
  status: "healthy" | "degraded" | "offline";
  processUptimeMs: number;
  lastCheckAt: string;
  services: { name: string; status: "up" | "down" | "idle"; detail?: string }[];
};

export type ExecutionFlowStep = {
  id: string;
  label: string;
  status: "complete" | "running" | "pending" | "error";
  durationMs?: number;
  at?: string;
};

export type TraceEvent = {
  id: string;
  at: string;
  kind: "metric" | "span" | "log" | "index" | "retrieval" | "cost";
  name: string;
  value?: number | string;
  unit?: string;
  severity?: "info" | "warn" | "error";
};
