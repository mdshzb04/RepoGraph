"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ObservabilityData, RepoMeta, TraceEvent } from "./types";
import { BackendHealthCard } from "./observability/backend-health-card";
import { ExecutionFlowCard } from "./observability/execution-flow-card";
import { BackendMetricsPanel } from "./observability/backend-metrics-panel";
import { ObservabilityCharts } from "./observability/observability-charts";
import { GrafanaLink } from "./observability/grafana-link";
import { TraceStream } from "./observability/trace-stream";
import { SectionHeader } from "./ui/section-header";

export function ObservabilityPanel({ repo }: { repo: RepoMeta | null }) {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamLive, setStreamLive] = useState(false);

  const loadSnapshot = useCallback(async () => {
    if (!repo?.id) return;
    const res = await fetch(`/api/repos/${repo.id}/observability`);
    if (res.ok) {
      const json = (await res.json()) as ObservabilityData;
      setData(json);
      if (json.traces?.length) setTraces(json.traces);
    }
  }, [repo?.id]);

  useEffect(() => {
    if (!repo?.id) {
      setData(null);
      setTraces([]);
      return;
    }
    setLoading(true);
    loadSnapshot().finally(() => setLoading(false));
    const poll = setInterval(loadSnapshot, 8_000);
    return () => clearInterval(poll);
  }, [repo?.id, loadSnapshot]);

  useEffect(() => {
    if (!repo?.id) return;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`/api/repos/${repo.id}/observability/stream`);
      source.onopen = () => setStreamLive(true);
      source.onerror = () => setStreamLive(false);
      source.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as {
            type: string;
            events?: TraceEvent[];
            event?: TraceEvent;
          };
          if (payload.type === "hello" && payload.events?.length) setTraces(payload.events);
          if (payload.type === "event" && payload.event) {
            setTraces((prev) => [...prev.slice(-29), payload.event!]);
          }
        } catch {
          /* ignore */
        }
      };
    } catch {
      setStreamLive(false);
    }
    return () => {
      source?.close();
      setStreamLive(false);
    };
  }, [repo?.id]);

  if (!repo) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Connect a repository to view telemetry.
      </p>
    );
  }

  if (loading && !data) {
    return <p className="p-8 font-mono text-sm text-muted-foreground">{">"} Loading…</p>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <SectionHeader title="Observability" description={repo.fullName} />
        <GrafanaLink telemetry={data?.telemetry} />
        {data && <BackendMetricsPanel data={data} />}
        {data && <ObservabilityCharts data={data} />}
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.backendHealth && <BackendHealthCard health={data.backendHealth} />}
          {data?.executionFlow && data.executionFlow.length > 0 && (
            <ExecutionFlowCard steps={data.executionFlow} />
          )}
        </div>
        <TraceStream traces={traces} live={streamLive} />
      </div>
    </ScrollArea>
  );
}
