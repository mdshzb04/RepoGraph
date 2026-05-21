"use client";

import { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ObservabilityData, IndexRunRecord } from "../types";
import { StatCard } from "../ui/stat-card";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatRunLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDurationTick(ms: number): string {
  if (ms >= 1000) return `${Math.round(ms / 1000)}k`;
  return String(ms);
}

function prepareChartRuns(runs: IndexRunRecord[]) {
  return [...runs]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((run) => ({
      ...run,
      label: formatRunLabel(run.at),
    }));
}

function EmptyChart({ label }: { label: string }) {
  return (
    <p className="flex h-[150px] items-center justify-center text-[11px] text-muted-foreground">
      {label}
    </p>
  );
}

export function ObservabilityCharts({ data }: { data: ObservabilityData }) {
  const history = data.history ?? [];
  const chartRuns = useMemo(() => prepareChartRuns(data.indexRuns ?? []), [data.indexRuns]);
  const idx = data.live?.indexing;
  const hasJobHistory = history.length >= 2;

  const jobSeries = history.map((p) => ({ at: p.at, jobs: p.indexJobs }));

  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Repo Indexing
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Jobs completed"
          value={idx?.totalJobs ?? 0}
          sub={`${idx?.repoJobsCompleted ?? 0} this repo · platform total`}
        />
        <StatCard
          label="Files indexed"
          value={idx?.repoFiles ?? data.fileCount ?? 0}
          sub={`${idx?.totalFiles ?? 0} platform total`}
        />
        <StatCard
          label="Chunks generated"
          value={idx?.repoChunks ?? data.chunkCount ?? 0}
          sub={`${idx?.totalChunks ?? 0} platform total`}
        />
      </div>

      <div className="copilot-glass rounded-xl p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Jobs completed (count)</p>
        {hasJobHistory ? (
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={jobSeries} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} vertical={false} />
              <XAxis
                dataKey="at"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                labelFormatter={(l) => formatTime(String(l))}
                formatter={(v) => [v, "Jobs"]}
              />
              <Area
                type="stepAfter"
                dataKey="jobs"
                stroke="var(--chart-5)"
                fill="color-mix(in oklch, var(--chart-5) 20%, transparent)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Job count grows after indexing completes" />
        )}
      </div>

      <div className="copilot-glass rounded-xl p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Index duration (ms)</p>
        {chartRuns.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={chartRuns} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} vertical={false} />
              <XAxis
                type="category"
                dataKey="label"
                interval={0}
                angle={-35}
                textAnchor="end"
                height={52}
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatDurationTick}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={[0, "auto"]}
              />
              <Tooltip
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ? String(payload[0].payload.label) : ""
                }
                formatter={(v) => [`${Number(v).toLocaleString()} ms`, "Duration"]}
              />
              <Bar
                dataKey="durationMs"
                fill="color-mix(in oklch, var(--chart-3) 50%, transparent)"
                stroke="var(--chart-3)"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Duration recorded per completed index run" />
        )}
      </div>

      <div className="copilot-glass rounded-xl p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          Per-run throughput (files & chunks)
        </p>
        {chartRuns.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={chartRuns} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.35} vertical={false} />
              <XAxis
                type="category"
                dataKey="label"
                interval={0}
                angle={-35}
                textAnchor="end"
                height={52}
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={[0, "auto"]}
              />
              <Tooltip
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ? String(payload[0].payload.label) : ""
                }
              />
              <Bar
                dataKey="files"
                fill="color-mix(in oklch, var(--chart-2) 50%, transparent)"
                stroke="var(--chart-2)"
                name="Files"
                isAnimationActive={false}
              />
              <Bar
                dataKey="chunks"
                fill="color-mix(in oklch, var(--chart-4) 50%, transparent)"
                stroke="var(--chart-4)"
                name="Chunks"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Files and chunks shown per index run" />
        )}
      </div>
    </section>
  );
}
