"use client";

import { Gauge } from "lucide-react";
import type { ApiLatencySnapshot } from "../types";

const STATUS_LABEL: Record<ApiLatencySnapshot["status"], string> = {
  healthy: "Within usual range for this process",
  degraded: "Above recent baseline",
  slow: "Notably high for this process",
};

const CONFIDENCE_COPY: Record<string, string> = {
  low: "Preliminary",
  moderate: "Developing",
  high: "Stable window",
};

export function ApiLatencyCard({ latency }: { latency: ApiLatencySnapshot }) {
  return (
    <div className="copilot-glass rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Gauge className="size-3.5" />
            Backend request timing
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {latency.note ?? "Measured by middleware on this API instance during your session."}
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {CONFIDENCE_COPY[latency.sampleConfidence ?? "low"]} · n={latency.requestCount}
        </span>
      </div>

      <div className="flex flex-wrap gap-8 text-xs">
        <div>
          <p className="text-[10px] text-muted-foreground">Latest</p>
          <p className="mt-0.5 font-mono text-lg text-foreground/90">
            {latency.lastMs}
            <span className="ml-1 text-sm font-normal text-muted-foreground">ms</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Session mean</p>
          <p className="mt-0.5 font-mono text-lg text-foreground/90">
            {latency.avgMs}
            <span className="ml-1 text-sm font-normal text-muted-foreground">ms</span>
          </p>
        </div>
        <div className="max-w-[200px]">
          <p className="text-[10px] text-muted-foreground">Interpretation</p>
          <p className="mt-0.5 text-muted-foreground">{STATUS_LABEL[latency.status]}</p>
        </div>
      </div>

      <p className="mt-3 font-mono text-[10px] text-muted-foreground">
        {latency.lastMethod} {latency.lastRoute} · {latency.statusCode}
      </p>
    </div>
  );
}
