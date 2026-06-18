"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  edgeLabelPoint,
  edgePath,
  layoutTopology,
  layoutWorkflow,
  wrapText,
  type DiagramLayout,
} from "@/lib/diagram-layout";
import type { ArchitectureTopology, WorkflowDiagram } from "./types";

const LAYER_FILL: Record<string, string> = {
  client: "var(--diagram-client)",
  api: "var(--diagram-api)",
  ai: "var(--diagram-ai)",
  data: "var(--diagram-data)",
  infra: "var(--diagram-infra)",
  entry: "var(--diagram-client)",
  app: "var(--diagram-api)",
  service: "var(--diagram-ai)",
  external: "var(--diagram-infra)",
};

function DiagramCanvas({ layout }: { layout: DiagramLayout }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 1 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pad = 32;
    const sx = (el.clientWidth - pad * 2) / layout.width;
    const sy = (el.clientHeight - pad * 2) / layout.height;
    const scale = Math.min(sx, sy, 1.5);
    setTransform({
      x: (el.clientWidth - layout.width * scale) / 2,
      y: (el.clientHeight - layout.height * scale) / 2,
      scale: Math.max(0.12, scale),
    });
  }, [layout]);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  return (
    <div className="copilot-diagram relative rounded-lg border border-border/40 bg-muted/10">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setTransform((t) => ({ ...t, scale: Math.min(3, t.scale * 1.15) }))} aria-label="Zoom in">
          <Plus className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.1, t.scale * 0.85) }))} aria-label="Zoom out">
          <Minus className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={fitToView} aria-label="Fit">
          <Maximize2 className="size-3.5" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="h-[min(640px,70vh)] w-full cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={(e) => {
          e.preventDefault();
          const el = containerRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const factor = e.deltaY > 0 ? 0.92 : 1.08;
          setTransform((t) => {
            const scale = Math.min(3, Math.max(0.1, t.scale * factor));
            const ratio = scale / t.scale;
            return { scale, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio };
          });
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { px: e.clientX, py: e.clientY, x: transform.x, y: transform.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setTransform((t) => ({
            ...t,
            x: drag.current!.x + (e.clientX - drag.current!.px),
            y: drag.current!.y + (e.clientY - drag.current!.py),
          }));
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <svg
          width={layout.width}
          height={layout.height}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
          }}
          className="select-none"
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" className="fill-border/70" />
            </marker>
          </defs>

          <g>
            {layout.groups.map((g) => (
              <g key={g.id}>
                <rect x={g.x - 12} y={g.y - 28} width={g.width + 24} height={g.height + 40} rx={12} className="fill-muted/20 stroke-border/50" strokeWidth={1} strokeDasharray="4 3" />
                <text x={g.x} y={g.y - 10} className="fill-muted-foreground text-[10px] font-medium uppercase tracking-widest">{g.title}</text>
              </g>
            ))}
          </g>

          <g>
            {layout.edges.map((e, i) => (
              <path key={`${e.from}-${e.to}-${i}`} d={edgePath(e.points)} fill="none" className="stroke-border/60" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
            ))}
          </g>

          <g>
            {layout.nodes.map((n) => {
              const lines = wrapText(n.label, 22);
              return (
                <g key={n.id}>
                  <rect x={n.x} y={n.y} width={n.width} height={n.height} rx={8} className="stroke-border/60" fill={LAYER_FILL[n.layer] ?? "var(--diagram-infra)"} strokeWidth={1.5} />
                  {lines.map((line, li) => (
                    <text key={li} x={n.x + n.width / 2} y={n.y + 18 + li * 14} textAnchor="middle" className="fill-foreground text-[11px] font-medium">{line}</text>
                  ))}
                  {n.sub && (
                    <text x={n.x + n.width / 2} y={n.y + n.height - 10} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                      {n.sub.length > 28 ? `${n.sub.slice(0, 26)}…` : n.sub}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          <g>
            {layout.edges.map((e, i) => {
              if (!e.label) return null;
              const pt = edgeLabelPoint(e.points);
              return (
                <g key={`lbl-${e.from}-${e.to}-${i}`}>
                  <rect x={pt.x - 24} y={pt.y - 10} width={48} height={14} rx={3} className="fill-card/95" />
                  <text x={pt.x} y={pt.y} textAnchor="middle" className="fill-muted-foreground text-[9px]">{e.label}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

export function ArchitectureDiagramCanvas({ topology }: { topology: ArchitectureTopology | null }) {
  const layout = useMemo(() => (topology ? layoutTopology(topology) : null), [topology]);
  if (!layout) return <p className="py-12 text-center text-sm text-muted-foreground">Index repository to generate diagram.</p>;
  return <DiagramCanvas layout={layout} />;
}

export function WorkflowDiagramCanvas({ workflow }: { workflow: WorkflowDiagram | null }) {
  const layout = useMemo(() => (workflow ? layoutWorkflow(workflow) : null), [workflow]);
  if (!layout) return <p className="py-12 text-center text-sm text-muted-foreground">No workflow detected.</p>;
  return <DiagramCanvas layout={layout} />;
}
