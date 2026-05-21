/** OpenTelemetry-compatible metric instrument names for Grafana Cloud. */
export const MetricNames = {
  apiRequestDuration: "engintel.api.request.duration",
  apiRequestTotal: "engintel.api.request.total",
  repoIndexDuration: "engintel.repo.index.duration",
  repoIndexFiles: "engintel.repo.index.files",
  repoIndexChunks: "engintel.repo.index.chunks",
  /** Per-run gauge snapshots (label: run_id) — not cumulative counters. */
  repoIndexRunDurationMs: "engintel.repo.index.duration_ms",
  repoIndexRunFilesTotal: "engintel.repo.index.files_total",
  repoIndexRunChunksTotal: "engintel.repo.index.chunks_total",
  repoIndexCompletedTotal: "engintel.repo_index.completed_total",
  vectorSearchDuration: "engintel.vector.search.duration",
  vectorSearchTotal: "engintel.vector.search.total",
  vectorHealth: "engintel.vector.health",
  openaiTokens: "engintel.openai.tokens",
  openaiRequests: "engintel.openai.requests",
  backgroundJobDuration: "engintel.background.job.duration",
  backgroundJobTotal: "engintel.background.job.total",
  platformUptime: "engintel.platform.uptime",
  apiErrorTotal: "engintel.api.request.errors",
  traceEventsTotal: "engintel.traces.events",
  repoActivityTotal: "engintel.repo.activity",
} as const;

export type MetricAttributes = Record<string, string | number | boolean>;
