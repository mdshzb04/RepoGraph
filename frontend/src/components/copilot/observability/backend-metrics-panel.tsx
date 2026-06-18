"use client";

import { cn } from "@/lib/utils";
import type { ObservabilityData } from "../types";
import { StatCard } from "../ui/stat-card";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(2)} K`;
  return String(n);
}

export function BackendMetricsPanel({ data }: { data: ObservabilityData }) {
  const live = data.live;
  const latency = data.apiLatency ?? live?.api.latency ?? null;
  const openai = data.openai;
  const uptimeMs = data.processUptime?.uptimeMs ?? 0;
  const uptimePct =
    live && live.api.totalRequests > 0
      ? Math.max(0, 100 - live.api.errorRatePct).toFixed(0)
      : uptimeMs > 0
        ? "100"
        : null;

  const cards: {
    label: string;
    value: string;
    sub?: string;
    accent?: "uptime" | "api" | "openai";
  }[] = [];

  if (uptimePct) {
    cards.push({
      label: "Platform Uptime",
      value: `${uptimePct}%`,
      sub: uptimeMs > 0 ? `process up ${Math.floor(uptimeMs / 1000)}s` : undefined,
      accent: "uptime",
    });
  }

  if (live && (live.api.requestsPerSec > 0 || live.api.totalRequests > 0)) {
    cards.push({
      label: "Request Rate",
      value: `${live.api.requestsPerSec} req/s`,
      sub: `${live.api.totalRequests} total requests`,
      accent: "api",
    });
  }

  if (latency) {
    cards.push({
      label: "P95 Latency",
      value: `${latency.p95Ms ?? latency.avgMs} ms`,
      sub: `avg ${latency.avgMs} ms · ${latency.requestCount} samples`,
      accent: "api",
    });
  }

  if (live && (live.indexing.totalJobs > 0 || (live.indexing.repoJobsCompleted ?? 0) > 0)) {
    cards.push({
      label: "Jobs Completed",
      value: String(live.indexing.totalJobs),
      sub: `${live.indexing.repoJobsCompleted ?? 0} this repo · ${live.indexing.totalFiles} files`,
      accent: "api",
    });
  }

  if (openai && openai.requestCount > 0) {
    cards.push({
      label: "OpenAI Requests",
      value: String(openai.requestCount),
      sub: openai.lastOperation ?? "this session",
      accent: "openai",
    });
    cards.push({
      label: "OpenAI Tokens",
      value: formatTokens(openai.totalTokens),
      sub: `$${openai.estimatedCostUsd.toFixed(4)} est.`,
      accent: "openai",
    });
  }

  if (!cards.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No backend metrics yet — index, search, or chat to populate.
      </p>
    );
  }

  const accentClass = {
    uptime: "border-l-primary/50 bg-primary/5",
    api: "border-l-chart-2/50 bg-chart-2/5",
    openai: "border-l-chart-4/50 bg-chart-4/5",
  } as const;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Engintel Backend Metrics
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            sub={c.sub}
            className={cn(
              "border-l-2",
              c.accent ? accentClass[c.accent] : undefined
            )}
          />
        ))}
      </div>
    </div>
  );
}
