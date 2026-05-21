export type MetricSnapshot = {
  id: string;
  label: string;
  value: string;
  unit?: string;
  status: "healthy" | "degraded" | "offline" | "neutral";
  description?: string;
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
  sampleConfidence: "low" | "moderate" | "high";
  note: string;
};

type InternalSample = {
  id: string;
  label: string;
  unit?: string;
  lastValue: number;
  description?: string;
  updatedAt: number;
};

const samples = new Map<string, InternalSample>();

const API_RING_MAX = 32;
const apiRing: number[] = [];
let apiMeta = {
  lastRoute: "",
  lastMethod: "GET",
  statusCode: 200,
  updatedAt: 0,
};

const LIVE_MAX_AGE_MS = 30 * 60 * 1000;

const routeRequestCounts = new Map<string, number>();

export type ApiRouteBreakdown = { route: string; count: number };

export function getApiRouteBreakdown(): ApiRouteBreakdown[] {
  return [...routeRequestCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([route, count]) => ({ route, count }));
}

function latencyStatus(ms: number): ApiLatencySnapshot["status"] {
  if (ms <= 0) return "slow";
  if (ms < 500) return "healthy";
  if (ms < 2000) return "degraded";
  return "slow";
}

export function recordApiLatencySample(
  durationMs: number,
  route: string,
  statusCode: number,
  method = "GET"
): void {
  const ms = Math.round(durationMs);
  apiRing.push(ms);
  if (apiRing.length > API_RING_MAX) apiRing.shift();
  apiMeta = {
    lastRoute: route,
    lastMethod: method,
    statusCode,
    updatedAt: Date.now(),
  };
  routeRequestCounts.set(route, (routeRequestCounts.get(route) ?? 0) + 1);
  updateLocalSample("api_latency", "API request latency", ms, {
    unit: "ms",
    description: `${method} ${route}`,
  });
}

export function getApiLatencySnapshot(): ApiLatencySnapshot | null {
  const now = Date.now();
  if (!apiRing.length || now - apiMeta.updatedAt > LIVE_MAX_AGE_MS) {
    return null;
  }
  const lastMs = apiRing[apiRing.length - 1]!;
  const avgMs = Math.round(
    apiRing.reduce((a, b) => a + b, 0) / apiRing.length
  );
  const n = apiRing.length;
  const sampleConfidence: ApiLatencySnapshot["sampleConfidence"] =
    n >= 12 ? "high" : n >= 4 ? "moderate" : "low";
  const note =
    n < 4
      ? "Few samples — average may shift as you use the API"
      : n < 12
        ? "Rolling window from recent backend requests"
        : "Stable rolling average from recent backend requests";

  const sorted = [...apiRing].sort((a, b) => a - b);
  const p95Idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const p95Ms = sorted[p95Idx]!;

  return {
    lastMs,
    avgMs,
    p95Ms,
    requestCount: n,
    lastRoute: apiMeta.lastRoute,
    lastMethod: apiMeta.lastMethod,
    statusCode: apiMeta.statusCode,
    recordedAt: new Date(apiMeta.updatedAt).toISOString(),
    status: latencyStatus(avgMs),
    sampleConfidence,
    note,
  };
}

export function updateLocalSample(
  id: string,
  label: string,
  value: number,
  opts?: { unit?: string; description?: string }
): void {
  samples.set(id, {
    id,
    label,
    unit: opts?.unit,
    lastValue: value,
    description: opts?.description,
    updatedAt: Date.now(),
  });
}

function statusFor(id: string, value: number): MetricSnapshot["status"] {
  if (id === "api_latency") {
    if (value <= 0) return "offline";
    return value < 500 ? "healthy" : value < 2000 ? "degraded" : "offline";
  }
  return "neutral";
}

const SERVER_STARTED_AT = Date.now();

export type UptimeSnapshot = {
  uptimeMs: number;
  startedAt: string;
};

export function getUptimeSnapshot(): UptimeSnapshot {
  return {
    uptimeMs: Date.now() - SERVER_STARTED_AT,
    startedAt: new Date(SERVER_STARTED_AT).toISOString(),
  };
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** In-process API latency only — no synthetic uptime metrics. */
export function getLocalMetricSnapshots(): MetricSnapshot[] {
  const api = getApiLatencySnapshot();
  if (!api) return [];
  return [
    {
      id: "api_latency",
      label: "API request latency",
      value: `${api.lastMs}`,
      unit: "ms",
      status: api.status === "slow" ? "offline" : api.status,
      description: `${api.lastMethod} ${api.lastRoute} · avg ${api.avgMs}ms (${api.requestCount} samples)`,
    },
  ];
}
