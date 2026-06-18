/** Cumulative telemetry history for in-app charts (session-scoped). */

import { getLiveTelemetrySnapshot } from "./aggregates";
import { resolveIndexDurationMs } from "./index-run-store";

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

const MAX_POINTS = 120;
const MAX_RUNS = 60;
const points: TelemetryHistoryPoint[] = [];

export type IndexRunRecord = {
  runId: string;
  at: string;
  durationMs: number;
  files: number;
  chunks: number;
  repo?: string;
  repoId?: string;
};

export type IndexRunInput = {
  runId?: string;
  at?: string;
  repo?: string;
  repoId?: string;
};

const indexRuns: IndexRunRecord[] = [];

export function pushIndexRun(
  durationMs: number,
  files: number,
  chunks: number,
  meta: IndexRunInput = {}
): IndexRunRecord {
  const duration = resolveIndexDurationMs(durationMs, chunks, files);
  const record: IndexRunRecord = {
    runId: meta.runId ?? crypto.randomUUID(),
    at: meta.at ?? new Date().toISOString(),
    durationMs: duration,
    files,
    chunks,
    repo: meta.repo,
    repoId: meta.repoId,
  };
  indexRuns.push(record);
  if (indexRuns.length > MAX_RUNS) indexRuns.shift();
  return record;
}

export function getIndexRunHistory(): IndexRunRecord[] {
  return [...indexRuns];
}

export function pushTelemetryHistoryPoint(): void {
  const snap = getLiveTelemetrySnapshot();
  const latency = snap.api.latency;
  points.push({
    at: snap.collectedAt,
    apiRequests: snap.api.totalRequests,
    indexJobs: snap.indexing.totalJobs,
    indexFiles: snap.indexing.totalFiles,
    indexChunks: snap.indexing.totalChunks,
    openaiTokens: snap.openai.totalTokens,
    openaiRequests: snap.openai.totalRequests,
    vectorSearches: snap.vector.totalSearches,
    avgLatencyMs: latency?.avgMs ?? 0,
    indexDurationMs: snap.indexing.lastDurationMs,
    p95LatencyMs: latency?.p95Ms ?? 0,
  });
  if (points.length > MAX_POINTS) points.shift();
}

export function getTelemetryHistory(): TelemetryHistoryPoint[] {
  return [...points];
}

export function seedTelemetryHistory(): void {
  if (!points.length) pushTelemetryHistoryPoint();
}
