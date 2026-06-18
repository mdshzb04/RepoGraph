"use client";

import { cn } from "@/lib/utils";

export function TerminalLog({
  lines,
  title = "System output",
  className,
}: {
  lines: string[];
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("copilot-glass copilot-terminal rounded-lg p-4", className)}>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {">"} {title}
      </p>
      <ul className="max-h-48 space-y-1 overflow-auto font-mono text-xs">
        {lines.map((line, i) => (
          <li
            key={`${line}-${i}`}
            className="copilot-terminal-line text-muted-foreground"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="text-foreground/40">$</span> {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
