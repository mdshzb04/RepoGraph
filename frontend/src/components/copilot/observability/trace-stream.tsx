"use client";

import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TraceEvent } from "../types";
import { formatTraceTime } from "./format";

const KIND_LABEL: Record<TraceEvent["kind"], string> = {
  metric: "Metric",
  span: "Span",
  log: "Log",
  index: "Index",
  retrieval: "Search",
  cost: "Cost",
};

const SEVERITY_CLASS: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-muted-foreground",
  error: "text-destructive",
};

export function TraceStream({
  traces,
  live,
}: {
  traces: TraceEvent[];
  live?: boolean;
}) {
  return (
    <div className="copilot-glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Radio className={cn("size-3.5", live && "text-foreground/80")} />
          Request traces
        </p>
        {live && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-foreground/60" />
            Live
          </span>
        )}
      </div>

      {traces.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No traces yet — index a repository or run a search to populate events.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto font-mono text-[11px]">
          {traces.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-2 py-1",
                SEVERITY_CLASS[t.severity ?? "info"]
              )}
            >
              <span className="text-muted-foreground">{formatTraceTime(t.at)}</span>
              <span className="rounded border border-border/60 px-1 text-[9px] uppercase tracking-wide">
                {KIND_LABEL[t.kind]}
              </span>
              <span className="truncate text-foreground/80">{t.name}</span>
              {t.value != null && (
                <span className="text-muted-foreground">
                  {t.value}
                  {t.unit ? ` ${t.unit}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
