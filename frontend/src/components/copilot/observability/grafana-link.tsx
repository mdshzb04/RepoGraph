"use client";

import { ExternalLink, LineChart } from "lucide-react";
import type { TelemetryStatusPayload } from "../types";

export function GrafanaLink({ telemetry }: { telemetry?: TelemetryStatusPayload | null }) {
  const url = telemetry?.dashboardUrl;

  if (!url) {
    return (
      <p className="text-xs text-muted-foreground">
        Set GRAFANA_CLOUD_DASHBOARD_URL in backend .env to link your dashboard.
      </p>
    );
  }

  return (
    <div className="copilot-glass flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2">
        <LineChart className="size-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Full metrics & history in Grafana Cloud</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-4 py-2 text-xs font-medium transition-colors hover:bg-muted"
      >
        Open Grafana dashboard
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}
