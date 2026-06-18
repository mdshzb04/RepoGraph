import {
  type Counter,
  type Histogram,
  type Meter,
  type ObservableGauge,
  type UpDownCounter,
  metrics,
} from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  getTelemetryPublicStatus,
  loadTelemetryConfig,
  type TelemetryConfig,
  type TelemetryPublicStatus,
} from "./config";
import { bootstrapGrafanaPublicEmbed } from "./grafana-public";
import { MetricNames, type MetricAttributes } from "./metrics";
import {
  getLocalMetricSnapshots,
  getUptimeSnapshot,
  recordApiLatencySample,
  type UptimeSnapshot,
} from "./snapshot";
import {
  getRepoCacheSnapshot,
  getRepoOpenAISnapshot,
  getRepoVectorSearchSnapshot,
  recordRepoIndexCache,
  recordRepoOpenAICache,
  recordRepoVectorSearchCache,
  type OpenAIMetricsSnapshot,
  type RepoTelemetryCache,
  type VectorSearchSnapshot,
} from "./repo-cache";
import {
  recordApiAggregate,
  recordIndexAggregate,
  recordOpenAIAggregate,
  recordTraceEventAggregate,
  recordVectorSearchAggregate,
  getLiveTelemetrySnapshot,
  getRepoLiveTelemetry,
  type LiveTelemetrySnapshot,
  type RepoLiveSnapshot,
} from "./aggregates";
import { pushIndexRun, pushTelemetryHistoryPoint, seedTelemetryHistory, getIndexRunHistory } from "./history";
import {
  buildIndexRunId,
  getIndexRunMetrics,
  resolveIndexDurationMs,
  storeIndexRunMetric,
} from "./index-run-store";

let provider: MeterProvider | null = null;
let meter: Meter | null = null;
let config: TelemetryConfig | null = null;
let initAttempted = false;
let indexRunObservablesRegistered = false;

const instruments: {
  apiDuration?: Histogram;
  apiTotal?: Counter;
  indexDuration?: Histogram;
  indexFiles?: Counter;
  indexChunks?: Counter;
  indexRunDurationObs?: ObservableGauge;
  indexRunFilesObs?: ObservableGauge;
  indexRunChunksObs?: ObservableGauge;
  repoIndexCompletedTotal?: Counter;
  searchDuration?: Histogram;
  searchTotal?: Counter;
  vectorHealth?: UpDownCounter;
  openaiTokens?: Counter;
  openaiRequests?: Counter;
  jobDuration?: Histogram;
  jobTotal?: Counter;
  uptime?: UpDownCounter;
  apiErrors?: Counter;
  traceEvents?: Counter;
  repoActivity?: Counter;
} = {};

function attr(attrs?: MetricAttributes): Record<string, string> {
  if (!attrs) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[k] = String(v);
  }
  return out;
}

async function exportWithRetry(fn: () => Promise<void>, retries = 2): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 100 * 2 ** i));
      }
    }
  }
  console.warn("[telemetry] export failed:", lastErr);
}

function ensureInstruments(): void {
  if (!meter) return;
  if (!instruments.apiDuration) {
    instruments.apiDuration = meter.createHistogram(MetricNames.apiRequestDuration, {
      description: "HTTP API request duration",
      unit: "ms",
    });
    instruments.apiTotal = meter.createCounter(MetricNames.apiRequestTotal, {
      description: "HTTP API request count",
    });
    instruments.indexDuration = meter.createHistogram(MetricNames.repoIndexDuration, {
      description: "Repository indexing duration",
      unit: "ms",
    });
    instruments.indexFiles = meter.createCounter(MetricNames.repoIndexFiles, {
      description: "Files indexed per repository",
    });
    instruments.indexChunks = meter.createCounter(MetricNames.repoIndexChunks, {
      description: "Chunks generated per repository",
    });
    instruments.indexRunDurationObs = meter.createObservableGauge(
      MetricNames.repoIndexRunDurationMs,
      { description: "Per-run repository index duration", unit: "ms" }
    );
    instruments.indexRunFilesObs = meter.createObservableGauge(
      MetricNames.repoIndexRunFilesTotal,
      { description: "Files indexed in a single index run" }
    );
    instruments.indexRunChunksObs = meter.createObservableGauge(
      MetricNames.repoIndexRunChunksTotal,
      { description: "Chunks generated in a single index run" }
    );
    registerIndexRunObservableCallback();
    instruments.repoIndexCompletedTotal = meter.createCounter(
      MetricNames.repoIndexCompletedTotal,
      { description: "Successful repository index completions (one per sync)" }
    );
    instruments.searchDuration = meter.createHistogram(MetricNames.vectorSearchDuration, {
      description: "Vector / semantic search duration",
      unit: "ms",
    });
    instruments.searchTotal = meter.createCounter(MetricNames.vectorSearchTotal, {
      description: "Vector search operations",
    });
    instruments.vectorHealth = meter.createUpDownCounter(MetricNames.vectorHealth, {
      description: "Vector index health (1=online, 0=offline)",
    });
    instruments.openaiTokens = meter.createCounter(MetricNames.openaiTokens, {
      description: "OpenAI tokens consumed",
    });
    instruments.openaiRequests = meter.createCounter(MetricNames.openaiRequests, {
      description: "OpenAI API requests",
    });
    instruments.jobDuration = meter.createHistogram(MetricNames.backgroundJobDuration, {
      description: "Background job duration",
      unit: "ms",
    });
    instruments.jobTotal = meter.createCounter(MetricNames.backgroundJobTotal, {
      description: "Background job executions",
    });
    instruments.uptime = meter.createUpDownCounter(MetricNames.platformUptime, {
      description: "Platform availability signal",
    });
    instruments.apiErrors = meter.createCounter(MetricNames.apiErrorTotal, {
      description: "HTTP API error responses (4xx/5xx)",
    });
    instruments.traceEvents = meter.createCounter(MetricNames.traceEventsTotal, {
      description: "In-process trace / activity events",
    });
    instruments.repoActivity = meter.createCounter(MetricNames.repoActivityTotal, {
      description: "Repository-scoped activity events",
    });
  }
}

function registerIndexRunObservableCallback(): void {
  if (!meter || indexRunObservablesRegistered) return;
  const dur = instruments.indexRunDurationObs;
  const files = instruments.indexRunFilesObs;
  const chunks = instruments.indexRunChunksObs;
  if (!dur || !files || !chunks) return;

  indexRunObservablesRegistered = true;
  meter.addBatchObservableCallback(
    (observableResult) => {
      for (const run of getIndexRunMetrics()) {
        const attributes = attr({
          run_id: run.runId,
          repo: run.repo,
          repo_id: run.repoId,
          indexed_at: run.indexedAt,
        });
        observableResult.observe(dur, run.durationMs, attributes);
        observableResult.observe(files, run.files, attributes);
        observableResult.observe(chunks, run.chunks, attributes);
      }
    },
    [dur, files, chunks]
  );
}

/**
 * Initialize Grafana Cloud OTLP metrics. Safe to call multiple times.
 */
export function initTelemetry(): TelemetryConfig {
  if (initAttempted && config) return config;
  initAttempted = true;
  config = loadTelemetryConfig();

  if (!config.enabled || !config.grafanaCloud) {
    return config;
  }

  try {
    const exporter = new OTLPMetricExporter({
      url: config.grafanaCloud.otlpMetricsUrl,
      headers: config.grafanaCloud.headers,
      timeoutMillis: 8_000,
    });

    const readers = [
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis:
          config.runtimeMode === "serverless" ? 5_000 : config.exportIntervalMs,
        exportTimeoutMillis: 7_000,
      }),
    ];

    provider = new MeterProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        [ATTR_SERVICE_VERSION]: config.serviceVersion,
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment,
      }),
      readers,
    });

    metrics.setGlobalMeterProvider(provider);
    meter = provider.getMeter("engintel-telemetry", config.serviceVersion);
    ensureInstruments();
    safeRecord(() => instruments.uptime?.add(1, {}));
    seedTelemetryHistory();
  } catch (err) {
    console.warn("[telemetry] init failed — running without export:", err);
    config = { ...config, enabled: false, grafanaCloud: null };
  }

  void bootstrapGrafanaPublicEmbed(
    config.dashboardUrl,
    process.env.GRAFANA_CLOUD_DASHBOARD_UID?.trim()
  );

  return config;
}

export function getTelemetryConfig(): TelemetryConfig {
  return config ?? loadTelemetryConfig();
}

export function isTelemetryEnabled(): boolean {
  return getTelemetryConfig().enabled;
}

export function getStatus(): TelemetryPublicStatus {
  return getTelemetryPublicStatus(getTelemetryConfig());
}

/** Flush pending metrics (call after serverless requests). Never throws. */
export async function flushTelemetry(): Promise<void> {
  if (!provider) return;
  await exportWithRetry(() => provider!.forceFlush());
}

function safeRecord(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.warn("[telemetry] record failed:", err);
  }
}

export function recordApiRequest(
  durationMs: number,
  route: string,
  statusCode: number,
  method = "GET"
): void {
  recordApiLatencySample(durationMs, route, statusCode, method);
  recordApiAggregate(statusCode);
  pushTelemetryHistoryPoint();
  ensureInstruments();
  const attributes = attr({ route, method, status_code: statusCode });
  safeRecord(() => {
    if (config?.enabled) {
      instruments.apiDuration?.record(durationMs, attributes);
      instruments.apiTotal?.add(1, attributes);
      if (statusCode >= 400) instruments.apiErrors?.add(1, attributes);
    }
  });
}

let baselineSyncedToOtel = false;

export function exportIndexBaselineToOtel(
  jobs: number,
  files: number,
  chunks: number
): void {
  if (baselineSyncedToOtel || !jobs) return;
  ensureInstruments();
  const attributes = attr({ source: "baseline", status: "success" });
  safeRecord(() => {
    if (!config?.enabled) return;
    instruments.repoIndexCompletedTotal?.add(jobs, attributes);
    if (files > 0) instruments.indexFiles?.add(files, attributes);
    if (chunks > 0) instruments.indexChunks?.add(chunks, attributes);
    baselineSyncedToOtel = true;
  });
}

function buildIndexRunMetricInput(
  input: IndexRunMetricInput & { indexedAt?: string }
): void {
  const indexedAt = input.indexedAt ?? new Date().toISOString();
  const durationMs = resolveIndexDurationMs(input.durationMs, input.chunks, input.files);
  storeIndexRunMetric({
    runId: input.runId,
    repo: input.repo ?? "unknown",
    repoId: input.repoId ?? "unknown",
    indexedAt,
    durationMs,
    files: input.files,
    chunks: input.chunks,
  });
}

export type IndexRunMetricInput = {
  runId: string;
  durationMs: number;
  files: number;
  chunks: number;
  repo?: string;
  repoId?: string;
  indexedAt?: string;
};

export function recordIndexRunMetrics(input: IndexRunMetricInput): void {
  ensureInstruments();
  buildIndexRunMetricInput(input);
}

export function hydrateIndexRuns(
  repos: {
    repoId: string;
    fullName?: string;
    fileCount: number;
    chunkCount: number;
    indexingDurationMs?: number;
    indexedAt?: string;
  }[]
): void {
  if (getIndexRunHistory().length) return;
  for (const r of repos) {
    const runId = buildIndexRunId(r.repoId, r.indexedAt);
    const indexedAt = r.indexedAt ?? new Date().toISOString();
    const record = pushIndexRun(r.indexingDurationMs ?? 0, r.fileCount, r.chunkCount, {
      runId,
      at: indexedAt,
      repo: r.fullName,
      repoId: r.repoId,
    });
    recordIndexRunMetrics({
      runId: record.runId,
      durationMs: record.durationMs,
      files: record.files,
      chunks: record.chunks,
      repo: record.repo,
      repoId: record.repoId,
      indexedAt,
    });
  }
}

function recordRepoIndexCompletedOtel(
  repo: string,
  repoId: string | undefined,
  durationMs: number,
  fileCount: number,
  chunkCount: number
): void {
  ensureInstruments();
  const attributes = attr({ repo, repo_id: repoId ?? "unknown", status: "success" });
  safeRecord(() => {
    if (!config?.enabled) return;
    instruments.repoIndexCompletedTotal?.add(1, attributes);
    instruments.indexDuration?.record(durationMs, attributes);
    instruments.indexFiles?.add(fileCount, attributes);
    instruments.indexChunks?.add(chunkCount, attributes);
  });
}

export function recordRepoIndex(
  durationMs: number,
  fileCount: number,
  chunkCount: number,
  repo: string,
  status: "success" | "error",
  repoId?: string
): void {
  if (repoId) {
    recordRepoIndexCache(repoId, repo, durationMs, fileCount, chunkCount, status);
  }
  if (status === "success") {
    recordIndexAggregate(durationMs, fileCount, chunkCount);
    const runId = crypto.randomUUID();
    const indexedAt = new Date().toISOString();
    const record = pushIndexRun(durationMs, fileCount, chunkCount, {
      runId,
      at: indexedAt,
      repo,
      repoId,
    });
    recordIndexRunMetrics({
      runId: record.runId,
      durationMs: record.durationMs,
      files: record.files,
      chunks: record.chunks,
      repo: record.repo,
      repoId: record.repoId,
      indexedAt,
    });
    pushTelemetryHistoryPoint();
    recordRepoIndexCompletedOtel(repo, repoId, durationMs, fileCount, chunkCount);
    return;
  }
  ensureInstruments();
  const attributes = attr({ repo, status, repo_id: repoId ?? "unknown" });
  safeRecord(() => {
    if (config?.enabled) {
      instruments.indexDuration?.record(durationMs, attributes);
      instruments.repoActivity?.add(1, attributes);
    }
  });
}

export function recordVectorSearch(
  durationMs: number,
  resultCount: number,
  healthy: boolean,
  repoId?: string
): void {
  if (repoId) {
    recordRepoVectorSearchCache(repoId, durationMs, resultCount);
  }
  recordVectorSearchAggregate();
  pushTelemetryHistoryPoint();
  ensureInstruments();
  const attributes = attr({
    healthy: healthy ? "true" : "false",
    repo_id: repoId ?? "unknown",
  });
  safeRecord(() => {
    if (config?.enabled) {
      instruments.searchDuration?.record(durationMs, attributes);
      instruments.searchTotal?.add(1, attributes);
      if (healthy) instruments.vectorHealth?.add(1, attributes);
    }
  });
}

export function recordOpenAIUsage(
  tokens: number,
  operation: string,
  model?: string,
  repoId?: string
): void {
  if (repoId) {
    recordRepoOpenAICache(repoId, tokens, operation, model);
  }
  recordOpenAIAggregate(tokens);
  pushTelemetryHistoryPoint();
  ensureInstruments();
  const attributes = attr({
    operation,
    model: model ?? "unknown",
    repo_id: repoId ?? "unknown",
  });
  safeRecord(() => {
    if (config?.enabled) {
      instruments.openaiTokens?.add(tokens, attributes);
      instruments.openaiRequests?.add(1, attributes);
    }
  });
}

/** Call from trace stream when events are emitted. */
export function recordTraceEvent(repoId?: string, kind = "event"): void {
  recordTraceEventAggregate();
  ensureInstruments();
  safeRecord(() => {
    if (config?.enabled) {
      instruments.traceEvents?.add(1, attr({ repo_id: repoId ?? "global", kind }));
    }
  });
}

export { getLiveTelemetrySnapshot, getRepoLiveTelemetry };
export type { LiveTelemetrySnapshot, RepoLiveSnapshot };

export function recordBackgroundJob(
  durationMs: number,
  jobId: string,
  status: "success" | "error"
): void {
  ensureInstruments();
  const attributes = attr({ job_id: jobId, status });
  safeRecord(() => {
    if (config?.enabled) {
      instruments.jobDuration?.record(durationMs, attributes);
      instruments.jobTotal?.add(1, attributes);
    }
  });
}

export async function shutdownTelemetry(): Promise<void> {
  if (!provider) return;
  await exportWithRetry(async () => {
    await provider!.shutdown();
  });
  provider = null;
  meter = null;
}
