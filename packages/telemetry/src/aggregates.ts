/** Cumulative in-process telemetry — mirrors OTel counters for the Observability UI. */

import type { ApiLatencySnapshot } from "./snapshot";
import { getApiLatencySnapshot, getUptimeSnapshot } from "./snapshot";
import {
  getRepoCacheSnapshot,
  getRepoOpenAISnapshot,
  getRepoVectorSearchSnapshot,
  hydrateRepoIndexCaches,
} from "./repo-cache";

const startedAt = Date.now();

let totalApiRequests = 0;
let totalApiErrors = 0;
let totalApiServerErrors = 0;
const requestTimestamps: number[] = [];
const recentOutcomes: { at: number; serverError: boolean }[] = [];
const RATE_WINDOW_MS = 60_000;

let totalIndexFiles = 0;
let totalIndexChunks = 0;
let totalIndexJobs = 0;
let lastIndexDurationMs = 0;

let totalOpenaiTokens = 0;
let totalOpenaiRequests = 0;

let totalVectorSearches = 0;
let totalTraceEvents = 0;

export function recordApiAggregate(statusCode: number): void {
  totalApiRequests += 1;
  const serverError = statusCode >= 500;
  if (statusCode >= 400) totalApiErrors += 1;
  if (serverError) totalApiServerErrors += 1;
  const now = Date.now();
  requestTimestamps.push(now);
  recentOutcomes.push({ at: now, serverError });
  while (requestTimestamps.length && now - requestTimestamps[0]! > RATE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  while (recentOutcomes.length && now - recentOutcomes[0]!.at > RATE_WINDOW_MS) {
    recentOutcomes.shift();
  }
}

export function recordIndexAggregate(
  durationMs: number,
  fileCount: number,
  chunkCount: number
): void {
  totalIndexJobs += 1;
  totalIndexFiles += fileCount;
  totalIndexChunks += chunkCount;
  lastIndexDurationMs = durationMs;
}

/** Restore cumulative indexing totals from persisted repos after restart. */
export function hydrateIndexingBaseline(
  repos: {
    repoId: string;
    fullName: string;
    fileCount: number;
    chunkCount: number;
    indexingDurationMs?: number;
  }[]
): void {
  if (!repos.length) return;
  const jobs = repos.length;
  const files = repos.reduce((s, r) => s + r.fileCount, 0);
  const chunks = repos.reduce((s, r) => s + r.chunkCount, 0);
  if (jobs > totalIndexJobs) totalIndexJobs = jobs;
  if (files > totalIndexFiles) totalIndexFiles = files;
  if (chunks > totalIndexChunks) totalIndexChunks = chunks;
  const last = repos[repos.length - 1];
  if (last?.indexingDurationMs) lastIndexDurationMs = last.indexingDurationMs;
  hydrateRepoIndexCaches(repos);
}

export function recordOpenAIAggregate(tokens: number): void {
  totalOpenaiTokens += tokens;
  totalOpenaiRequests += 1;
}

export function recordVectorSearchAggregate(): void {
  totalVectorSearches += 1;
}

export function recordTraceEventAggregate(): void {
  totalTraceEvents += 1;
}

export type LiveTelemetrySnapshot = {
  source: "live";
  collectedAt: string;
  uptime: ReturnType<typeof getUptimeSnapshot>;
  api: {
    totalRequests: number;
    totalErrors: number;
    totalServerErrors: number;
    errorRatePct: number;
    requestsPerMin: number;
    requestsPerSec: number;
    latency: ApiLatencySnapshot | null;
  };
  indexing: {
    totalJobs: number;
    totalFiles: number;
    totalChunks: number;
    lastDurationMs: number;
  };
  openai: {
    totalTokens: number;
    totalRequests: number;
    estimatedCostUsd: number;
  };
  vector: {
    totalSearches: number;
  };
  traces: {
    totalEvents: number;
  };
};

export type RepoLiveSnapshot = {
  source: "live";
  collectedAt: string;
  repoId: string;
  uptime: ReturnType<typeof getUptimeSnapshot>;
  api: LiveTelemetrySnapshot["api"];
  indexing: LiveTelemetrySnapshot["indexing"] & {
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
  vector: LiveTelemetrySnapshot["vector"];
  vectorSearch: ReturnType<typeof getRepoVectorSearchSnapshot>;
  traces: LiveTelemetrySnapshot["traces"];
};

function errorRatePct(): number {
  const now = Date.now();
  const recent = recentOutcomes.filter((o) => now - o.at <= RATE_WINDOW_MS);
  if (recent.length) {
    const errors = recent.filter((o) => o.serverError).length;
    return Math.round((errors / recent.length) * 1000) / 10;
  }
  if (totalApiRequests === 0) return 0;
  return Math.round((totalApiServerErrors / totalApiRequests) * 1000) / 10;
}

function requestsPerMin(): number {
  const now = Date.now();
  const recent = requestTimestamps.filter((t) => now - t <= RATE_WINDOW_MS);
  return recent.length;
}

function estimateCost(tokens: number): number {
  return Math.round((tokens / 1_000_000) * 0.3 * 10000) / 10000;
}

function requestsPerSec(): number {
  return Math.round((requestsPerMin() / 60) * 10000) / 10000;
}

export function getLiveTelemetrySnapshot(): LiveTelemetrySnapshot {
  return {
    source: "live",
    collectedAt: new Date().toISOString(),
    uptime: getUptimeSnapshot(),
    api: {
      totalRequests: totalApiRequests,
      totalErrors: totalApiErrors,
      totalServerErrors: totalApiServerErrors,
      errorRatePct: errorRatePct(),
      requestsPerMin: requestsPerMin(),
      requestsPerSec: requestsPerSec(),
      latency: getApiLatencySnapshot(),
    },
    indexing: {
      totalJobs: totalIndexJobs,
      totalFiles: totalIndexFiles,
      totalChunks: totalIndexChunks,
      lastDurationMs: lastIndexDurationMs,
    },
    openai: {
      totalTokens: totalOpenaiTokens,
      totalRequests: totalOpenaiRequests,
      estimatedCostUsd: estimateCost(totalOpenaiTokens),
    },
    vector: { totalSearches: totalVectorSearches },
    traces: { totalEvents: totalTraceEvents },
  };
}

export function getRepoLiveTelemetry(repoId: string): RepoLiveSnapshot {
  const global = getLiveTelemetrySnapshot();
  const repoCache = getRepoCacheSnapshot(repoId);
  const repoOpenai = getRepoOpenAISnapshot(repoId);
  const repoVector = getRepoVectorSearchSnapshot(repoId);

  const repoTokens = repoOpenai?.totalTokens ?? 0;
  const repoRequests = repoOpenai?.requestCount ?? 0;

  return {
    source: "live",
    collectedAt: global.collectedAt,
    repoId,
    uptime: global.uptime,
    api: global.api,
    vector: global.vector,
    traces: global.traces,
    vectorSearch: repoVector,
    openai: {
      totalTokens: repoTokens,
      totalRequests: repoRequests,
      estimatedCostUsd: estimateCost(repoTokens),
      lastOperation: repoOpenai?.lastOperation,
      model: repoOpenai?.model,
      recordedAt: repoOpenai?.recordedAt,
    },
    indexing: {
      ...global.indexing,
      repoJobsCompleted: repoCache?.completedJobs ?? 0,
      repoFiles: repoCache?.fileCount,
      repoChunks: repoCache?.chunkCount,
      repoDurationMs: repoCache?.indexingDurationMs,
      lastDurationMs:
        repoCache?.indexingDurationMs ?? global.indexing.lastDurationMs,
    },
  };
}

export { startedAt };
