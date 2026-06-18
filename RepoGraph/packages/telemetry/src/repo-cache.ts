/** Per-repository in-memory telemetry aggregation with TTL-based expiry. */

const CACHE_TTL_MS = 30 * 60 * 1000;
const RING_MAX = 32;

export type RepoTelemetryCache = {
  repoId: string;
  repoName: string;
  updatedAt: number;
  indexingDurationMs?: number;
  indexStatus?: "success" | "error" | "running";
  fileCount?: number;
  chunkCount?: number;
  completedJobs?: number;
  vectorSamples: number[];
  vectorHitCounts: number[];
  vectorLastAt: number;
  openaiTokens: number;
  openaiRequests: number;
  openaiLastOperation?: string;
  openaiLastModel?: string;
};

const caches = new Map<string, RepoTelemetryCache>();

function fresh(repoId: string, repoName: string): RepoTelemetryCache {
  return {
    repoId,
    repoName,
    updatedAt: Date.now(),
    vectorSamples: [],
    vectorHitCounts: [],
    vectorLastAt: 0,
    openaiTokens: 0,
    openaiRequests: 0,
  };
}

function getOrCreate(repoId: string, repoName = ""): RepoTelemetryCache {
  const existing = caches.get(repoId);
  if (existing && Date.now() - existing.updatedAt < CACHE_TTL_MS) {
    if (repoName) existing.repoName = repoName;
    return existing;
  }
  const entry = fresh(repoId, repoName);
  caches.set(repoId, entry);
  return entry;
}

export function touchRepoCache(repoId: string, repoName = ""): RepoTelemetryCache {
  return getOrCreate(repoId, repoName);
}

export function recordRepoIndexCache(
  repoId: string,
  repoName: string,
  durationMs: number,
  fileCount: number,
  chunkCount: number,
  status: "success" | "error" | "running"
): void {
  const c = getOrCreate(repoId, repoName);
  c.indexingDurationMs = durationMs;
  c.indexStatus = status;
  c.fileCount = fileCount;
  c.chunkCount = chunkCount;
  if (status === "success") c.completedJobs = (c.completedJobs ?? 0) + 1;
  c.updatedAt = Date.now();
}

export function recordRepoVectorSearchCache(
  repoId: string,
  durationMs: number,
  hitCount: number
): void {
  const c = getOrCreate(repoId);
  c.vectorSamples.push(Math.round(durationMs));
  if (c.vectorSamples.length > RING_MAX) c.vectorSamples.shift();
  c.vectorHitCounts.push(hitCount);
  if (c.vectorHitCounts.length > RING_MAX) c.vectorHitCounts.shift();
  c.vectorLastAt = Date.now();
  c.updatedAt = Date.now();
}

export function recordRepoOpenAICache(
  repoId: string,
  tokens: number,
  operation: string,
  model?: string
): void {
  const c = getOrCreate(repoId);
  c.openaiTokens += tokens;
  c.openaiRequests += 1;
  c.openaiLastOperation = operation;
  c.openaiLastModel = model;
  c.updatedAt = Date.now();
}

export type VectorSearchSnapshot = {
  lastMs: number;
  avgMs: number;
  searchCount: number;
  lastHitCount: number;
  status: "healthy" | "degraded" | "offline";
  recordedAt: string;
};

export type OpenAIMetricsSnapshot = {
  totalTokens: number;
  requestCount: number;
  estimatedCostUsd: number;
  lastOperation?: string;
  model?: string;
  recordedAt: string;
};

function vectorStatus(avgMs: number): VectorSearchSnapshot["status"] {
  if (avgMs <= 0) return "offline";
  if (avgMs < 200) return "healthy";
  if (avgMs < 800) return "degraded";
  return "offline";
}

/** Rough gpt-4o-mini pricing: $0.15/1M input + $0.60/1M output — use blended $0.30/1M. */
function estimateCostUsd(tokens: number): number {
  return (tokens / 1_000_000) * 0.3;
}

export function getRepoVectorSearchSnapshot(
  repoId: string
): VectorSearchSnapshot | null {
  const c = caches.get(repoId);
  if (!c?.vectorSamples.length || Date.now() - c.vectorLastAt > CACHE_TTL_MS) {
    return null;
  }
  const lastMs = c.vectorSamples[c.vectorSamples.length - 1]!;
  const avgMs = Math.round(
    c.vectorSamples.reduce((a, b) => a + b, 0) / c.vectorSamples.length
  );
  return {
    lastMs,
    avgMs,
    searchCount: c.vectorSamples.length,
    lastHitCount: c.vectorHitCounts[c.vectorHitCounts.length - 1] ?? 0,
    status: vectorStatus(avgMs),
    recordedAt: new Date(c.vectorLastAt).toISOString(),
  };
}

export function getRepoOpenAISnapshot(repoId: string): OpenAIMetricsSnapshot | null {
  const c = caches.get(repoId);
  if (!c || c.openaiRequests === 0 || Date.now() - c.updatedAt > CACHE_TTL_MS) {
    return null;
  }
  return {
    totalTokens: c.openaiTokens,
    requestCount: c.openaiRequests,
    estimatedCostUsd: estimateCostUsd(c.openaiTokens),
    lastOperation: c.openaiLastOperation,
    model: c.openaiLastModel,
    recordedAt: new Date(c.updatedAt).toISOString(),
  };
}

export function hydrateRepoIndexCaches(
  repos: {
    repoId: string;
    fullName: string;
    fileCount: number;
    chunkCount: number;
    indexingDurationMs?: number;
  }[]
): void {
  for (const r of repos) {
    const c = getOrCreate(r.repoId, r.fullName);
    c.fileCount = r.fileCount;
    c.chunkCount = r.chunkCount;
    c.indexingDurationMs = r.indexingDurationMs;
    c.indexStatus = "success";
    c.completedJobs = Math.max(c.completedJobs ?? 0, 1);
    c.updatedAt = Date.now();
  }
}

export function getRepoCacheSnapshot(repoId: string): RepoTelemetryCache | null {
  const c = caches.get(repoId);
  if (!c || Date.now() - c.updatedAt > CACHE_TTL_MS) return null;
  return { ...c };
}

export function getCacheAgeMs(repoId: string): number | null {
  const c = caches.get(repoId);
  if (!c) return null;
  return Date.now() - c.updatedAt;
}
