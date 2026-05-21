"use client";

import { formatDuration } from "./format";
import type { ObservabilityData } from "../types";
import { StatCard } from "../ui/stat-card";

export function MetricsOverview({ data }: { data: ObservabilityData }) {
  const live = data.live;
  const cards: { label: string; value: string; sub?: string }[] = [];

  if (live && live.api.totalRequests > 0) {
    cards.push({
      label: "Request rate",
      value: `${live.api.requestsPerMin}/min`,
      sub: `${live.api.totalRequests} total · ${live.api.errorRatePct}% server errors`,
    });
  }

  if (data.apiLatency) {
    cards.push({
      label: "API latency",
      value: `${data.apiLatency.avgMs}ms`,
      sub: `last ${data.apiLatency.lastMs}ms`,
    });
  }

  if (data.indexingPerformanceMs) {
    cards.push({
      label: "Index duration",
      value: `${(data.indexingPerformanceMs / 1000).toFixed(1)}s`,
      sub: live
        ? `${live.indexing.totalFiles} files · ${live.indexing.totalChunks} chunks (cumulative)`
        : data.fileCount
          ? `${data.fileCount} files · ${data.chunkCount ?? 0} chunks`
          : undefined,
    });
  } else if (live && live.indexing.totalJobs > 0) {
    cards.push({
      label: "Indexing",
      value: `${live.indexing.totalJobs} jobs`,
      sub: `${live.indexing.totalFiles} files · ${live.indexing.totalChunks} chunks`,
    });
  }

  if (data.vectorSearch) {
    cards.push({
      label: "Vector search",
      value: `${data.vectorSearch.avgMs}ms`,
      sub: `${data.vectorSearch.searchCount} queries · ${data.vectorSearch.lastHitCount} hits`,
    });
  } else if (live && live.vector.totalSearches > 0) {
    cards.push({
      label: "Vector searches",
      value: `${live.vector.totalSearches}`,
      sub: "cumulative this session",
    });
  }

  if (data.openai) {
    cards.push({
      label: "OpenAI",
      value:
        data.openai.totalTokens >= 1000
          ? `${(data.openai.totalTokens / 1000).toFixed(1)}k tokens`
          : `${data.openai.totalTokens} tokens`,
      sub: `${data.openai.requestCount} calls · $${data.openai.estimatedCostUsd.toFixed(4)}`,
    });
  }

  if (data.processUptime) {
    cards.push({
      label: "Uptime",
      value: formatDuration(data.processUptime.uptimeMs),
      sub: live ? `${live.traces.totalEvents} trace events` : undefined,
    });
  }

  if (!cards.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No live telemetry yet — use the API, index a repo, search, or chat to record metrics.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} />
      ))}
    </div>
  );
}
