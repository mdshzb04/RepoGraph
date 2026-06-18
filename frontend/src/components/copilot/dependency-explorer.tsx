"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Box,
  Database,
  Monitor,
  Route,
  Server,
  Sparkles,
  User,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DependencyGraph } from "./types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  monitor: Monitor,
  server: Server,
  route: Route,
  workflow: Workflow,
  sparkles: Sparkles,
  database: Database,
  activity: Activity,
  box: Box,
};

type Pos = { x: number; y: number };

export function DependencyExplorer({ graph }: { graph: DependencyGraph | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const [hover, setHover] = useState<string | null>(null);

  const byCluster = useMemo(() => {
    if (!graph) return new Map<string, DependencyGraph["nodes"]>();
    const m = new Map<string, DependencyGraph["nodes"]>();
    for (const c of graph.clusters) m.set(c.id, []);
    for (const n of graph.nodes) {
      const list = m.get(n.cluster) ?? [];
      list.push(n);
      m.set(n.cluster, list);
    }
    return m;
  }, [graph]);

  const activeEdges = useMemo(() => {
    if (!graph || !hover) return new Set<string>();
    const s = new Set<string>();
    for (const e of graph.edges) {
      if (e.from === hover || e.to === hover) s.add(`${e.from}-${e.to}`);
    }
    return s;
  }, [graph, hover]);

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const next: Record<string, Pos> = {};
      nodeRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        next[id] = { x: r.left - wr.left + r.width / 2, y: r.top - wr.top + r.height / 2 };
      });
      setPos(next);
    };
    measure();
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 100);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, [graph]);

  if (!graph?.nodes.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No dependency graph — index repository first.
      </p>
    );
  }

  const hovered = graph.nodes.find((n) => n.id === hover);

  return (
    <div
      ref={wrapRef}
      className="copilot-dep-map relative min-h-[400px] overflow-x-auto rounded-lg"
    >
      <svg className="pointer-events-none absolute inset-0 h-full min-w-full" aria-hidden>
        {graph.edges.map((e, i) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const key = `${e.from}-${e.to}`;
          const on = !hover || activeEdges.has(key);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 40;
          const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
          return (
            <path
              key={`${key}-${i}`}
              d={d}
              fill="none"
              className={cn(
                "copilot-topology-edge",
                e.animated && on && "copilot-topology-edge--flow",
                !on && "opacity-15"
              )}
            />
          );
        })}
      </svg>

      <div className="relative z-[1] grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {graph.clusters.map((c) => {
          const nodes = byCluster.get(c.id) ?? [];
          if (!nodes.length) return null;
          return (
            <section
              key={c.id}
              className="copilot-dep-cluster rounded-lg border border-dashed border-border/50 bg-muted/5 p-3"
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {c.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {nodes.map((n) => {
                  const Icon = ICONS[n.icon] ?? Box;
                  const lit =
                    !hover ||
                    hover === n.id ||
                    graph.edges.some(
                      (e) =>
                        (e.from === hover && e.to === n.id) ||
                        (e.from === n.id && e.to === hover)
                    );
                  return (
                    <div
                      key={n.id}
                      ref={(el) => {
                        if (el) nodeRefs.current.set(n.id, el);
                        else nodeRefs.current.delete(n.id);
                      }}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                      title={n.meta}
                      className={cn(
                        "copilot-topology-node min-w-[120px] cursor-default rounded-lg border px-2.5 py-2 transition-opacity",
                        lit ? "opacity-100" : "opacity-35"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary">
                          <Icon className="size-3" />
                        </span>
                        <span className="truncate text-[11px] font-medium">{n.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {hovered?.meta && (
        <div className="absolute bottom-3 left-3 right-3 z-[2] rounded-md border border-border/50 bg-card/95 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-sm">
          <span className="font-medium text-foreground">{hovered.label}</span>
          <span className="mx-2 text-foreground/30">·</span>
          {hovered.meta}
        </div>
      )}
    </div>
  );
}
