"use client";

import { ExternalLink } from "lucide-react";
import type { TelemetryStatusPayload } from "../types";

export function TelemetryPipelineCard({
  telemetry,
}: {
  telemetry?: TelemetryStatusPayload;
}) {
  if (!telemetry?.enabled && !telemetry?.dashboardUrl) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
      <p>
        {telemetry.enabled
          ? `Metrics export → Grafana Cloud (${telemetry.serviceName})`
          : "Grafana Cloud linked for deep inspection"}
      </p>
      {telemetry.dashboardUrl && (
        <a
          href={telemetry.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
        >
          Open full Grafana
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
