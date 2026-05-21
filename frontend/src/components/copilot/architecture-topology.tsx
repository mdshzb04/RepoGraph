"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Box,
  Brain,
  Cloud,
  Database,
  GitBranch,
  HardDrive,
  Monitor,
  Route,
  Search,
  Server,
  Sparkles,
  User,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArchitectureTopology } from "./types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  monitor: Monitor,
  server: Server,
  route: Route,
  workflow: Workflow,
  sparkles: Sparkles,
  search: Search,
  brain: Brain,
  database: Database,
  "hard-drive": HardDrive,
  activity: Activity,
  "bar-chart": BarChart3,
  cloud: Cloud,
  "git-branch": GitBranch,
  box: Box,
};

type Pos = { x: number; y: number; w: number; h: number };

export function ArchitectureTopologyMap({
  topology,
}: {
  topology: ArchitectureTopology | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [positions, setPositions] = useState<Record<string, Pos>>({});

  const byLayer = useMemo(() => {
    if (!topology) return new Map<string, ArchitectureTopology["nodes"]>();
    const m = new Map<string, ArchitectureTopology["nodes"]>();
    for (const layer of topology.layers) m.set(layer.id, []);
    for (const n of topology.nodes) {
      m.get(n.layer)?.push(n);
    }
    return m;
  }, [topology]);

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const next: Record<string, Pos> = {};
      nodeRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        next[id] = {
          x: r.left - wr.left + r.width / 2,
          y: r.top - wr.top + r.height / 2,
          w: r.width,
          h: r.height,
        };
      });
      setPositions(next);
    };
    measure();
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 120);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, [topology]);

  if (!topology?.nodes.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Index repository to generate topology.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="copilot-topology relative min-h-[520px] overflow-hidden rounded-lg">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {topology.edges.map((e, i) => {
          const a = positions[e.from];
          const b = positions[e.to];
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const d = `M ${a.x} ${a.y} Q ${mx} ${a.y} ${mx} ${(a.y + b.y) / 2} T ${b.x} ${b.y}`;
          return (
            <g key={`${e.from}-${e.to}-${i}`}>
              <path
                d={d}
                fill="none"
                className={cn(
                  "copilot-topology-edge",
                  e.animated && "copilot-topology-edge--flow"
                )}
              />
              {e.label && (
                <text
                  x={mx}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px]"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="relative z-[1] flex flex-col gap-3 p-4">
        {topology.layers.map((layer) => {
          const nodes = byLayer.get(layer.id) ?? [];
          if (!nodes.length) return null;
          return (
            <section
              key={layer.id}
              className="copilot-topology-layer rounded-lg border border-border/40 bg-muted/10 p-3"
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {layer.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {nodes.map((n) => {
                  const Icon = ICONS[n.icon] ?? Box;
                  return (
                    <div
                      key={n.id}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(n.id, el);
                        else nodeRefs.current.delete(n.id);
                      }}
                      className="copilot-topology-node min-w-[140px] max-w-[200px] rounded-lg border border-border/50 bg-card/80 px-3 py-2 shadow-sm backdrop-blur-sm"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{n.label}</p>
                          {n.sub && (
                            <p className="truncate text-[10px] text-muted-foreground">
                              {n.sub}
                            </p>
                          )}
                          {n.badges && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {n.badges.map((b) => (
                                <span
                                  key={b.label}
                                  className={cn(
                                    "copilot-stat rounded border px-1 py-0.5 text-[9px]",
                                    b.tone === "ok" && "border-primary/30 text-primary",
                                    b.tone === "warn" &&
                                      "border-muted-foreground/40 text-muted-foreground",
                                    b.tone === "neutral" && "border-border text-muted-foreground"
                                  )}
                                >
                                  {b.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
