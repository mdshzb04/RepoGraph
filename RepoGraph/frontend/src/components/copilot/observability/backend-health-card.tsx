"use client";

import { Activity, CheckCircle2, Circle, Minus, XCircle } from "lucide-react";
import { formatDuration } from "./format";
import { cn } from "@/lib/utils";
import type { BackendHealth } from "../types";

const SERVICE_ICON = {
  up: CheckCircle2,
  down: XCircle,
  idle: Minus,
} as const;

export function BackendHealthCard({ health }: { health: BackendHealth }) {
  return (
    <div className="copilot-glass rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Activity className="size-3.5" />
          Backend health
        </p>
        <span className="font-mono text-[10px] text-muted-foreground">
          up {formatDuration(health.processUptimeMs)}
        </span>
      </div>

      <ul className="space-y-2">
        {health.services.map((svc) => {
          const Icon = SERVICE_ICON[svc.status] ?? Circle;
          return (
            <li key={svc.name} className="flex items-start gap-2 text-xs">
              <Icon
                className={cn(
                  "mt-0.5 size-3 shrink-0",
                  svc.status === "up" && "text-foreground/70",
                  svc.status === "down" && "text-destructive",
                  svc.status === "idle" && "text-muted-foreground"
                )}
              />
              <div className="min-w-0 flex-1">
                <span>{svc.name}</span>
                {svc.detail && (
                  <span className="text-muted-foreground"> · {svc.detail}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
