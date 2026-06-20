export {
  loadTelemetryConfig,
  getTelemetryPublicStatus,
  parseOtlpHeaders,
  parseResourceAttributes,
  isOtlpConfigured,
  type TelemetryConfig,
  type TelemetryPublicStatus,
  type TelemetryRuntimeMode,
} from "./config";

export { MetricNames, type MetricAttributes } from "./metrics";

export {
  initTelemetry,
  getTelemetryConfig,
  isTelemetryEnabled,
  getStatus,
  flushTelemetry,
  shutdownTelemetry,
  recordApiRequest,
  recordRepoIndex,
  recordIndexRunMetrics,
  hydrateIndexRuns,
  recordVectorSearch,
  recordOpenAIUsage,
  recordBackgroundJob,
  recordTraceEvent,
  exportIndexBaselineToOtel,
  getLiveTelemetrySnapshot,
  getRepoLiveTelemetry,
} from "./client";

export {
  getTelemetryHistory,
  getIndexRunHistory,
  pushTelemetryHistoryPoint,
  seedTelemetryHistory,
  type TelemetryHistoryPoint,
  type IndexRunRecord,
} from "./history";

export type { LiveTelemetrySnapshot, RepoLiveSnapshot } from "./aggregates";

export { hydrateIndexingBaseline } from "./aggregates";
export { getApiRouteBreakdown, type ApiRouteBreakdown } from "./snapshot";

export { telemetryMiddleware } from "./express";
export { withTelemetry, type ServerlessHandler } from "./serverless";

export {
  updateLocalSample,
  getApiLatencySnapshot,
  recordApiLatencySample,
  getUptimeSnapshot,
  formatDuration,
  getLocalMetricSnapshots,
  type MetricSnapshot,
  type ApiLatencySnapshot,
  type UptimeSnapshot,
} from "./snapshot";

export { buildGrafanaEmbedUrl, buildGrafanaDashboardViewUrl, isEmbeddableGrafanaUrl } from "./grafana-embed";
export type { GrafanaEmbedOptions } from "./grafana-embed";
export {
  bootstrapGrafanaPublicEmbed,
  resolvePublicDashboardEmbedUrl,
  resolveDashboardEmbedUrl,
  resolveDashboardViewUrl,
  getCachedPublicEmbedUrl,
  getCachedDashboardUid,
} from "./grafana-public";

export {
  getRepoVectorSearchSnapshot,
  getRepoOpenAISnapshot,
  getRepoCacheSnapshot,
  getCacheAgeMs,
  touchRepoCache,
  type VectorSearchSnapshot,
  type OpenAIMetricsSnapshot,
  type RepoTelemetryCache,
} from "./repo-cache";
