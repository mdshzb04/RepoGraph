import {
  getRepoLiveTelemetry,
  getStatus,
  getTelemetryHistory,
  getIndexRunHistory,
  getApiRouteBreakdown,
  getUptimeSnapshot,
  type ApiLatencySnapshot,
  type LiveTelemetrySnapshot,
  type OpenAIMetricsSnapshot,
  type RepoLiveSnapshot,
  type VectorSearchSnapshot,
} from "@engintel/telemetry";
import type { RepoKnowledge } from "./knowledge";
import {
  getRecentOtelEventsForRepo,
  type OtelStreamEvent,
} from "./telemetry-stream";

export type TelemetryStatus = ReturnType<typeof getStatus>;

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
  at?: string;
};

export type TraceEvent = {
  id: string;
  at: string;
  kind: OtelStreamEvent["kind"];
  name: string;
  value?: number | string;
  unit?: string;
  severity?: OtelStreamEvent["severity"];
};

export type ObservabilitySnapshot = {
  collectedAt: string;
  live: RepoLiveSnapshot;
  apiLatency?: ApiLatencySnapshot;
  vectorSearch?: VectorSearchSnapshot;
  openai?: OpenAIMetricsSnapshot;
  processUptime?: ReturnType<typeof getUptimeSnapshot>;
  indexingPerformanceMs?: number;
  fileCount?: number;
  chunkCount?: number;
  lastSyncAt?: string;
  telemetry: TelemetryStatus;
  backendHealth: BackendHealth;
  executionFlow: ExecutionFlowStep[];
  traces: TraceEvent[];
  history: ReturnType<typeof getTelemetryHistory>;
  indexRuns: ReturnType<typeof getIndexRunHistory>;
  apiRoutes: ReturnType<typeof getApiRouteBreakdown>;
};

export type { ApiLatencySnapshot, LiveTelemetrySnapshot, RepoLiveSnapshot };

const INDEX_FLOW_STEPS = [
  { id: "fetch", label: "Fetch repository tree" },
  { id: "chunk", label: "Generate semantic chunks" },
  { id: "summary", label: "LLM project summary" },
  { id: "architecture", label: "Architecture analysis" },
  { id: "persist", label: "Persist index" },
] as const;

function buildExecutionFlow(repo: RepoKnowledge): ExecutionFlowStep[] {
  const log = repo.activityLog ?? [];
  const hasError = repo.status === "error";
  const isIndexing = repo.status === "indexing";
  const isReady = repo.status === "ready";
  const stepSignals: Record<string, RegExp> = {
    fetch: /fetching repository|files fetched/i,
    chunk: /semantic chunks/i,
    summary: /summary via LLM|LLM summary/i,
    architecture: /architecture context/i,
    persist: /sync complete|repository sync/i,
  };
  return INDEX_FLOW_STEPS.map((step) => {
    const matched = log.find((line) => stepSignals[step.id]?.test(line));
    let status: ExecutionFlowStep["status"] = "pending";
    if (hasError && matched) status = "error";
    else if (matched) status = "complete";
    else if (isIndexing && !matched) {
      const firstPending = INDEX_FLOW_STEPS.find(
        (s) => !log.some((line) => stepSignals[s.id]?.test(line))
      );
      status = firstPending?.id === step.id ? "running" : "pending";
    } else if (isReady) status = "complete";
    return { id: step.id, label: step.label, status, at: matched?.split(" · ")[0] };
  });
}

function buildBackendHealth(live: RepoLiveSnapshot): BackendHealth {
  const otel = getStatus();
  const api = live.api.latency;
  const services: BackendHealth["services"] = [
    {
      name: "API",
      status: live.api.totalRequests === 0 ? "idle" : live.api.errorRatePct > 10 ? "down" : "up",
      detail: `${live.api.requestsPerMin}/min · ${live.api.totalRequests} total · ${live.api.errorRatePct}% server errors (60s)`,
    },
  ];
  if (live.vectorSearch) {
    services.push({
      name: "Vector search",
      status: "up",
      detail: `${live.vectorSearch.avgMs}ms avg · ${live.vectorSearch.searchCount} queries`,
    });
  }
  if (live.openai.totalRequests > 0) {
    services.push({
      name: "OpenAI",
      status: "up",
      detail: `${live.openai.totalTokens} tokens · $${live.openai.estimatedCostUsd.toFixed(4)}`,
    });
  }
  services.push({
    name: "Grafana export",
    status: otel.enabled && otel.otlpConfigured ? "up" : "idle",
    detail: otel.enabled ? "OTLP metrics active" : "Local only",
  });
  const downCount = services.filter((s) => s.status === "down").length;
  return {
    status: downCount > 0 ? "degraded" : "healthy",
    processUptimeMs: live.uptime.uptimeMs,
    lastCheckAt: new Date().toISOString(),
    services,
  };
}

function toTraces(events: OtelStreamEvent[]): TraceEvent[] {
  return events.map((e) => ({
    id: e.id,
    at: e.at,
    kind: e.kind,
    name: e.name,
    value: e.value,
    unit: e.unit,
    severity: e.severity,
  }));
}

export function buildObservabilitySnapshot(
  repo: RepoKnowledge,
  indexingDurationMs?: number
): ObservabilitySnapshot {
  const liveBase = getRepoLiveTelemetry(repo.id);
  const repoJobs =
    repo.status === "ready"
      ? Math.max(liveBase.indexing.repoJobsCompleted ?? 0, 1)
      : liveBase.indexing.repoJobsCompleted ?? 0;
  const live: RepoLiveSnapshot = {
    ...liveBase,
    indexing: {
      ...liveBase.indexing,
      repoJobsCompleted: repoJobs,
      repoFiles: liveBase.indexing.repoFiles ?? repo.fileCount,
      repoChunks: liveBase.indexing.repoChunks ?? repo.chunkCount,
      repoDurationMs:
        liveBase.indexing.repoDurationMs ?? repo.indexingDurationMs,
      lastDurationMs:
        liveBase.indexing.repoDurationMs ??
        repo.indexingDurationMs ??
        liveBase.indexing.lastDurationMs,
    },
  };
  const liveTraces = toTraces(getRecentOtelEventsForRepo(repo.id, 30));
  const traces =
    liveTraces.length > 0
      ? liveTraces
      : (repo.activityLog ?? []).slice(-30).map((line, i) => {
          const sep = line.indexOf(" · ");
          const at = sep > 0 ? line.slice(0, sep) : new Date().toISOString();
          const name = sep > 0 ? line.slice(sep + 3) : line;
          return {
            id: `log-${i}`,
            at,
            kind: "index" as const,
            name,
            severity: /error/i.test(name) ? ("error" as const) : ("info" as const),
          };
        });

  const openaiSnap =
    live.openai.totalRequests > 0
      ? {
          totalTokens: live.openai.totalTokens,
          requestCount: live.openai.totalRequests,
          estimatedCostUsd: live.openai.estimatedCostUsd,
          lastOperation: live.openai.lastOperation,
          model: live.openai.model,
          recordedAt: live.openai.recordedAt ?? live.collectedAt,
        }
      : undefined;

  return {
    collectedAt: live.collectedAt,
    live,
    apiLatency: live.api.latency ?? undefined,
    vectorSearch: live.vectorSearch ?? undefined,
    openai: openaiSnap,
    processUptime: live.uptime,
    indexingPerformanceMs:
      live.indexing.repoDurationMs ??
      indexingDurationMs ??
      repo.indexingDurationMs,
    fileCount: live.indexing.repoFiles ?? repo.fileCount ?? undefined,
    chunkCount: live.indexing.repoChunks ?? repo.chunkCount ?? undefined,
    lastSyncAt: repo.indexedAt,
    telemetry: getStatus(),
    backendHealth: buildBackendHealth(live),
    executionFlow: buildExecutionFlow(repo),
    traces,
    history: getTelemetryHistory(),
    indexRuns: getIndexRunHistory(),
    apiRoutes: getApiRouteBreakdown(),
  };
}
