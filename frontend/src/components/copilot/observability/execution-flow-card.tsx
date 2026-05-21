"use client";

import { GitBranch, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionFlowStep } from "../types";
import { formatTraceTime } from "./format";

const STATUS_ICON: Record<
  ExecutionFlowStep["status"],
  React.ComponentType<{ className?: string }>
> = {
  complete: CheckCircle2,
  running: Loader2,
  pending: Circle,
  error: XCircle,
};

const STATUS_CLASS: Record<ExecutionFlowStep["status"], string> = {
  complete: "text-foreground/70",
  running: "text-foreground animate-spin",
  pending: "text-muted-foreground/50",
  error: "text-destructive",
};

export function ExecutionFlowCard({ steps }: { steps: ExecutionFlowStep[] }) {
  return (
    <div className="copilot-glass rounded-xl p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <GitBranch className="size-3.5" />
        Indexing execution flow
      </p>
      <ol className="relative space-y-0">
        {steps.map((step, i) => {
          const Icon = STATUS_ICON[step.status];
          const isLast = i === steps.length - 1;
          return (
            <li key={step.id} className="relative flex gap-3 pb-3">
              {!isLast && (
                <span
                  className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-border/50"
                  aria-hidden
                />
              )}
              <Icon className={cn("relative z-10 size-3.5 shrink-0", STATUS_CLASS[step.status])} />
              <div className="min-w-0 flex-1 pt-[-2px]">
                <p className="text-xs text-foreground/90">{step.label}</p>
                {step.at && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTraceTime(step.at)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
